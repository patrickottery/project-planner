from flask import Blueprint, jsonify, request
from app import db
from app.models import Task
from app.routes.attachments import remove_upload_dirs
from app.validation import (
    TASK_STATUSES, TASK_TYPES, as_bool, as_float, as_id_list, as_int, bad, json_body,
    opt_str, parse_date,
)

tasks_bp = Blueprint("tasks", __name__)


def _reposition_siblings(parent_id, project_id):
    siblings = Task.query.filter_by(
        parent_id=parent_id, project_id=project_id
    ).order_by(Task.position).all()
    for i, t in enumerate(siblings):
        t.position = i * 10
    db.session.flush()


def _recalculate_progress(task, _seen=None):
    seen = _seen if _seen is not None else set()
    if task.id in seen:  # corrupt data with a parent cycle must not recurse forever
        return
    seen.add(task.id)
    if task.progress_manual:
        return
    children = Task.query.filter_by(parent_id=task.id).all()
    if not children:
        return
    total_effort = sum(c.effort_hours or 1.0 for c in children)
    weighted = sum((c.progress_pct or 0) * (c.effort_hours or 1.0) for c in children)
    task.progress_pct = round(weighted / total_effort) if total_effort > 0 else 0
    if task.parent_id:
        parent = db.session.get(Task, task.parent_id)
        if parent:
            _recalculate_progress(parent, seen)


def subtree_ids(task_id):
    """task_id plus every descendant (cycle-safe)."""
    ids, frontier = {task_id}, [task_id]
    while frontier:
        children = [c.id for c in Task.query.filter(Task.parent_id.in_(frontier)).all() if c.id not in ids]
        ids.update(children)
        frontier = children
    return ids


def _check_parent(parent_id, project_id, task_id=None):
    """parent must exist, be in the same project, and (for a move) not be the task
    itself or one of its descendants."""
    if parent_id is None:
        return None
    if not isinstance(parent_id, str):
        bad("'parent_id' must be a task id or null")
    parent = db.session.get(Task, parent_id)
    if not parent:
        bad("'parent_id' does not exist")
    if parent.project_id != project_id:
        bad("'parent_id' must be a task in the same project")
    if task_id is not None and parent_id in subtree_ids(task_id):
        bad("A task can't be moved under itself or one of its subtasks")
    return parent


def _apply_fields(t, data):
    """Validate and set the editable fields present in data."""
    if "title" in data:
        title = opt_str(data, "title", 500)
        if not title or not title.strip():
            bad("'title' must be a non-empty string")
        t.title = title.strip()
    if "description" in data:
        t.description = opt_str(data, "description")
    if "assignee" in data:
        t.assignee = opt_str(data, "assignee", 255)
    if "task_type" in data:
        if data["task_type"] not in TASK_TYPES:
            bad(f"'task_type' must be one of: {', '.join(sorted(TASK_TYPES))}")
        t.task_type = data["task_type"]
    if "status" in data:
        if data["status"] not in TASK_STATUSES:
            bad(f"'status' must be one of: {', '.join(sorted(TASK_STATUSES))}")
        t.status = data["status"]
    if "start_date" in data:
        t.start_date = parse_date(data["start_date"], "start_date")
    if "end_date" in data:
        t.end_date = parse_date(data["end_date"], "end_date")
    if "effort_hours" in data:
        t.effort_hours = as_float(data["effort_hours"], "effort_hours")
    if "progress_pct" in data:
        t.progress_pct = as_int(data["progress_pct"], "progress_pct", 0, 100)
    if "progress_manual" in data:
        t.progress_manual = as_bool(data["progress_manual"], "progress_manual")
    if "colour" in data:
        t.colour = opt_str(data, "colour", 7)
    if "dependencies" in data:
        t.dependencies = as_id_list(data["dependencies"], "dependencies")
    if "position" in data:
        t.position = as_int(data["position"], "position")
    if t.start_date and t.end_date and t.end_date < t.start_date:
        bad("'end_date' must not be before 'start_date'")


@tasks_bp.route("/projects/<pid>/tasks", methods=["POST"])
def create_task(pid):
    from app.models import Project
    db.get_or_404(Project, pid)
    data = json_body()
    parent_id = data.get("parent_id")
    _check_parent(parent_id, pid)
    max_pos = db.session.query(db.func.max(Task.position)).filter_by(
        project_id=pid, parent_id=parent_id
    ).scalar() or 0
    t = Task(project_id=pid, parent_id=parent_id, position=max_pos + 10, title="New Task",
             task_type="task", status="not_started", progress_pct=0, progress_manual=False,
             dependencies=[])
    _apply_fields(t, {k: v for k, v in data.items() if k != "position"})
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201


@tasks_bp.route("/tasks/<tid>", methods=["GET"])
def get_task(tid):
    t = db.get_or_404(Task, tid)
    return jsonify(t.to_dict())


@tasks_bp.route("/tasks/<tid>", methods=["PUT"])
def update_task(tid):
    t = db.get_or_404(Task, tid)
    data = json_body()
    _apply_fields(t, data)
    db.session.flush()
    if t.parent_id:
        parent = db.session.get(Task, t.parent_id)
        if parent:
            _recalculate_progress(parent)
    db.session.commit()
    return jsonify(t.to_dict())


@tasks_bp.route("/tasks/<tid>", methods=["DELETE"])
def delete_task(tid):
    cascade = request.args.get("cascade", "true").lower() == "true"
    t = db.get_or_404(Task, tid)
    parent_id = t.parent_id
    if cascade:
        doomed = subtree_ids(tid)
    else:
        doomed = {tid}
        for child in Task.query.filter_by(parent_id=tid).all():
            child.parent_id = t.parent_id
        db.session.flush()
    db.session.delete(t)
    db.session.flush()
    if parent_id:
        parent = db.session.get(Task, parent_id)
        if parent:
            _recalculate_progress(parent)
    db.session.commit()
    remove_upload_dirs(doomed)  # only once the rows are really gone
    return "", 204


@tasks_bp.route("/tasks/<tid>/promote", methods=["POST"])
def promote_task(tid):
    t = db.get_or_404(Task, tid)
    if not t.parent_id:
        return jsonify({"error": "Already a root task"}), 400
    parent = db.session.get(Task, t.parent_id)
    old_parent_id = t.parent_id
    t.position = parent.position + 5
    t.parent_id = parent.parent_id
    db.session.flush()
    _reposition_siblings(t.parent_id, t.project_id)
    old_parent = db.session.get(Task, old_parent_id)
    if old_parent:
        _recalculate_progress(old_parent)
    if t.parent_id:
        new_parent = db.session.get(Task, t.parent_id)
        if new_parent:
            _recalculate_progress(new_parent)
    db.session.commit()
    return jsonify(t.to_dict())


@tasks_bp.route("/tasks/<tid>/demote", methods=["POST"])
def demote_task(tid):
    t = db.get_or_404(Task, tid)
    prev_sibling = Task.query.filter(
        Task.parent_id == t.parent_id,
        Task.project_id == t.project_id,
        Task.position < t.position,
        Task.id != t.id,
    ).order_by(Task.position.desc()).first()
    if not prev_sibling:
        return jsonify({"error": "No previous sibling to demote into"}), 400
    old_parent_id = t.parent_id
    t.parent_id = prev_sibling.id
    max_pos = db.session.query(db.func.max(Task.position)).filter_by(
        parent_id=prev_sibling.id
    ).scalar() or 0
    t.position = max_pos + 10
    db.session.flush()
    _recalculate_progress(prev_sibling)
    if old_parent_id:
        old_parent = db.session.get(Task, old_parent_id)
        if old_parent:
            _recalculate_progress(old_parent)
    db.session.commit()
    return jsonify(t.to_dict())


@tasks_bp.route("/tasks/<tid>/duplicate", methods=["POST"])
def duplicate_task(tid):
    recursive = request.args.get("recursive", "false").lower() == "true"
    original = db.get_or_404(Task, tid)

    def _copy(src, parent_id, position, top_level=False, seen=frozenset()):
        t = Task(
            project_id=src.project_id,
            parent_id=parent_id,
            position=position,
            title=src.title + " (copy)" if top_level else src.title,
            description=src.description,
            assignee=src.assignee,
            task_type=src.task_type,
            status=src.status,
            start_date=src.start_date,
            end_date=src.end_date,
            effort_hours=src.effort_hours,
            progress_pct=src.progress_pct,
            progress_manual=src.progress_manual,
            colour=src.colour,
            dependencies=[],
        )
        db.session.add(t)
        db.session.flush()
        if recursive and src.id not in seen:
            children = Task.query.filter_by(parent_id=src.id).order_by(Task.position).all()
            for child in children:
                _copy(child, t.id, child.position, seen=seen | {src.id})
        return t

    new_task = _copy(original, original.parent_id, original.position + 5, top_level=True)
    db.session.commit()
    return jsonify(new_task.to_dict()), 201


@tasks_bp.route("/tasks/<tid>/move", methods=["POST"])
def move_task(tid):
    t = db.get_or_404(Task, tid)
    data = json_body()
    new_parent_id = data.get("parent_id")
    _check_parent(new_parent_id, t.project_id, task_id=t.id)  # no cycles, no cross-project
    position = as_int(data.get("position", 0), "position")
    old_parent_id = t.parent_id
    t.parent_id = new_parent_id
    t.position = position
    db.session.flush()
    if old_parent_id:
        old_parent = db.session.get(Task, old_parent_id)
        if old_parent:
            _recalculate_progress(old_parent)
    if t.parent_id:
        new_parent = db.session.get(Task, t.parent_id)
        if new_parent:
            _recalculate_progress(new_parent)
    db.session.commit()
    return jsonify(t.to_dict())
