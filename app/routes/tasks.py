from datetime import date
from flask import Blueprint, jsonify, request
from app import db
from app.models import Task

tasks_bp = Blueprint("tasks", __name__)


def _reposition_siblings(parent_id, project_id):
    siblings = Task.query.filter_by(
        parent_id=parent_id, project_id=project_id
    ).order_by(Task.position).all()
    for i, t in enumerate(siblings):
        t.position = i * 10
    db.session.flush()


def _recalculate_progress(task):
    if task.progress_manual:
        return
    children = Task.query.filter_by(parent_id=task.id).all()
    if not children:
        return
    total_effort = sum(c.effort_hours or 1.0 for c in children)
    weighted = sum((c.progress_pct or 0) * (c.effort_hours or 1.0) for c in children)
    task.progress_pct = round(weighted / total_effort) if total_effort > 0 else 0
    if task.parent_id:
        parent = Task.query.get(task.parent_id)
        if parent:
            _recalculate_progress(parent)


@tasks_bp.route("/projects/<pid>/tasks", methods=["POST"])
def create_task(pid):
    data = request.json
    max_pos = db.session.query(db.func.max(Task.position)).filter_by(
        project_id=pid, parent_id=data.get("parent_id")
    ).scalar() or 0
    t = Task(
        project_id=pid,
        parent_id=data.get("parent_id"),
        position=max_pos + 10,
        title=data.get("title", "New Task"),
        description=data.get("description"),
        assignee=data.get("assignee"),
        task_type=data.get("task_type", "task"),
        status=data.get("status", "not_started"),
        start_date=date.fromisoformat(data["start_date"]) if data.get("start_date") else None,
        end_date=date.fromisoformat(data["end_date"]) if data.get("end_date") else None,
        effort_hours=data.get("effort_hours"),
        progress_pct=data.get("progress_pct", 0),
        progress_manual=data.get("progress_manual", False),
        colour=data.get("colour"),
        dependencies=data.get("dependencies", []),
    )
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201


@tasks_bp.route("/tasks/<tid>", methods=["GET"])
def get_task(tid):
    t = Task.query.get_or_404(tid)
    return jsonify(t.to_dict())


@tasks_bp.route("/tasks/<tid>", methods=["PUT"])
def update_task(tid):
    t = Task.query.get_or_404(tid)
    data = request.json
    simple_fields = [
        "title", "description", "assignee", "task_type", "status",
        "effort_hours", "progress_pct", "progress_manual", "colour", "dependencies",
    ]
    for field in simple_fields:
        if field in data:
            setattr(t, field, data[field])
    if "start_date" in data:
        t.start_date = date.fromisoformat(data["start_date"]) if data["start_date"] else None
    if "end_date" in data:
        t.end_date = date.fromisoformat(data["end_date"]) if data["end_date"] else None
    if "position" in data:
        t.position = data["position"]
    db.session.flush()
    if t.parent_id:
        parent = Task.query.get(t.parent_id)
        if parent:
            _recalculate_progress(parent)
    db.session.commit()
    return jsonify(t.to_dict())


@tasks_bp.route("/tasks/<tid>", methods=["DELETE"])
def delete_task(tid):
    cascade = request.args.get("cascade", "true").lower() == "true"
    t = Task.query.get_or_404(tid)
    parent_id = t.parent_id
    project_id = t.project_id
    if not cascade:
        children = Task.query.filter_by(parent_id=tid).all()
        for child in children:
            child.parent_id = t.parent_id
        db.session.flush()
    db.session.delete(t)
    db.session.flush()
    if parent_id:
        parent = Task.query.get(parent_id)
        if parent:
            _recalculate_progress(parent)
    db.session.commit()
    return "", 204


@tasks_bp.route("/tasks/<tid>/promote", methods=["POST"])
def promote_task(tid):
    t = Task.query.get_or_404(tid)
    if not t.parent_id:
        return jsonify({"error": "Already a root task"}), 400
    parent = Task.query.get(t.parent_id)
    old_parent_id = t.parent_id
    t.position = parent.position + 5
    t.parent_id = parent.parent_id
    db.session.flush()
    _reposition_siblings(t.parent_id, t.project_id)
    old_parent = Task.query.get(old_parent_id)
    if old_parent:
        _recalculate_progress(old_parent)
    if t.parent_id:
        new_parent = Task.query.get(t.parent_id)
        if new_parent:
            _recalculate_progress(new_parent)
    db.session.commit()
    return jsonify(t.to_dict())


@tasks_bp.route("/tasks/<tid>/demote", methods=["POST"])
def demote_task(tid):
    t = Task.query.get_or_404(tid)
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
        old_parent = Task.query.get(old_parent_id)
        if old_parent:
            _recalculate_progress(old_parent)
    db.session.commit()
    return jsonify(t.to_dict())


@tasks_bp.route("/tasks/<tid>/move", methods=["POST"])
def move_task(tid):
    t = Task.query.get_or_404(tid)
    data = request.json
    old_parent_id = t.parent_id
    t.parent_id = data.get("parent_id")
    t.position = data.get("position", 0)
    db.session.flush()
    if old_parent_id:
        old_parent = Task.query.get(old_parent_id)
        if old_parent:
            _recalculate_progress(old_parent)
    if t.parent_id:
        new_parent = Task.query.get(t.parent_id)
        if new_parent:
            _recalculate_progress(new_parent)
    db.session.commit()
    return jsonify(t.to_dict())
