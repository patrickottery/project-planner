import csv
import io
import json
import uuid

from flask import Blueprint, Response, jsonify

from app import db
from app.models import Note, Project, RiskIssue, Task
from app.routes.attachments import remove_upload_dirs
from app.routes.risks import VALID_ENTRY_TYPES, VALID_IMPACTS, VALID_PROBS, statuses_for
from app.validation import (
    TASK_STATUSES, TASK_TYPES, as_bool, as_float, as_int, bad, content_disposition,
    json_body, opt_str, parse_date, require_str,
)

projects_bp = Blueprint("projects", __name__)

EXPORT_FORMAT = 2
ATTACHMENTS_NOTE = ("Attachment files are not included in JSON exports — only their names and "
                    "sizes. Back up the uploads folder to keep the files.")


@projects_bp.route("/projects", methods=["GET"])
def list_projects():
    projects = Project.query.order_by(Project.created_at.desc()).all()
    return jsonify([p.to_dict() for p in projects])


@projects_bp.route("/projects", methods=["POST"])
def create_project():
    data = json_body()
    p = Project(
        name=require_str(data, "name", 255),
        description=opt_str(data, "description"),
        colour=opt_str(data, "colour", 7) or "#6366f1",
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@projects_bp.route("/projects/<pid>", methods=["GET"])
def get_project(pid):
    p = db.get_or_404(Project, pid)
    return jsonify(p.to_dict())


@projects_bp.route("/projects/<pid>", methods=["PUT"])
def update_project(pid):
    p = db.get_or_404(Project, pid)
    data = json_body()
    if "name" in data:
        p.name = require_str(data, "name", 255)
    if "description" in data:
        p.description = opt_str(data, "description")
    if "colour" in data:
        p.colour = opt_str(data, "colour", 7)
    db.session.commit()
    return jsonify(p.to_dict())


@projects_bp.route("/projects/<pid>", methods=["DELETE"])
def delete_project(pid):
    p = db.get_or_404(Project, pid)
    task_ids = [t.id for t in Task.query.filter_by(project_id=pid).all()]
    # Children before parents, so the self-referencing FK is never violated mid-delete.
    Task.query.filter_by(project_id=pid).update({Task.parent_id: None})
    db.session.flush()
    db.session.delete(p)  # cascades tasks (→ notes, attachments) and risks
    db.session.commit()
    remove_upload_dirs(task_ids)
    return "", 204


def _build_tree(tasks_by_parent, parent_id=None, seen=None):
    seen = set() if seen is None else seen
    result = []
    for t in tasks_by_parent.get(parent_id, []):
        if t.id in seen:
            continue
        seen.add(t.id)
        d = t.to_dict()
        d["children"] = _build_tree(tasks_by_parent, t.id, seen)
        result.append(d)
    return result


@projects_bp.route("/projects/<pid>/tasks", methods=["GET"])
def get_project_tasks(pid):
    db.get_or_404(Project, pid)
    tasks = Task.query.filter_by(project_id=pid).order_by(Task.position).all()
    by_parent = {}
    for t in tasks:
        by_parent.setdefault(t.parent_id, []).append(t)
    return jsonify(_build_tree(by_parent))


# ── JSON export / import ─────────────────────────────────────────────────────

@projects_bp.route("/projects/<pid>/export/json", methods=["GET"])
def export_json(pid):
    p = db.get_or_404(Project, pid)
    tasks = Task.query.filter_by(project_id=pid).order_by(Task.position).all()

    def task_export(t):
        d = t.to_dict()
        d["notes"] = [n.to_dict() for n in t.notes]
        d["attachment_metadata"] = [a.to_dict() for a in t.attachments]
        return d

    payload = {
        "format_version": EXPORT_FORMAT,
        "attachments_note": ATTACHMENTS_NOTE,
        "project": p.to_dict(),
        "tasks": [task_export(t) for t in tasks],
        "risks": [r.to_dict() for r in RiskIssue.query.filter_by(project_id=pid).all()],
    }
    return Response(
        json.dumps(payload, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": content_disposition(f"{p.name}.json")},
    )


def _topological(tasks_data):
    """Order tasks so every parent comes before its children. A parent id that isn't
    in the file makes the task top-level; a parent cycle is an error."""
    by_id = {}
    for t in tasks_data:
        if not isinstance(t, dict) or not isinstance(t.get("id"), str):
            bad("Every task needs a string 'id'")
        if t["id"] in by_id:
            bad(f"Duplicate task id {t['id']!r}")
        by_id[t["id"]] = t
    children = {}
    roots = []
    for t in tasks_data:
        parent = t.get("parent_id")
        (children.setdefault(parent, []) if parent in by_id else roots).append(t)
    ordered, stack = [], list(reversed(roots))
    while stack:
        t = stack.pop()
        ordered.append(t)
        stack.extend(reversed(children.get(t["id"], [])))
    if len(ordered) != len(tasks_data):
        bad("The task hierarchy in this file contains a cycle")
    return ordered


@projects_bp.route("/projects/import/json", methods=["POST"])
def import_json():
    data = json_body()
    proj_data = data.get("project")
    if not isinstance(proj_data, dict):
        bad("'project' must be an object")
    tasks_data = data.get("tasks", [])
    risks_data = data.get("risks", [])
    if not isinstance(tasks_data, list) or not isinstance(risks_data, list):
        bad("'tasks' and 'risks' must be lists")

    new_project = Project(
        name=require_str(proj_data, "name", 240) + " (imported)",
        description=opt_str(proj_data, "description"),
        colour=opt_str(proj_data, "colour", 7) or "#6366f1",
    )
    db.session.add(new_project)
    db.session.flush()

    ordered = _topological(tasks_data)
    id_map = {t["id"]: str(uuid.uuid4()) for t in ordered}
    notes_count = attachments_skipped = 0

    for t_data in ordered:
        task_type = t_data.get("task_type") or "task"
        status = t_data.get("status") or "not_started"
        if task_type not in TASK_TYPES or status not in TASK_STATUSES:
            bad(f"Task {t_data['id']!r} has an unknown task_type or status")
        deps = t_data.get("dependencies") or []
        if not isinstance(deps, list):
            bad(f"Task {t_data['id']!r}: 'dependencies' must be a list")
        t = Task(
            id=id_map[t_data["id"]],
            project_id=new_project.id,
            parent_id=id_map.get(t_data.get("parent_id")),
            position=as_int(t_data.get("position") or 0, "position"),
            title=require_str(t_data, "title", 500),
            description=opt_str(t_data, "description"),
            assignee=opt_str(t_data, "assignee", 255),
            task_type=task_type,
            status=status,
            start_date=parse_date(t_data.get("start_date"), "start_date"),
            end_date=parse_date(t_data.get("end_date"), "end_date"),
            effort_hours=as_float(t_data.get("effort_hours"), "effort_hours"),
            progress_pct=as_int(t_data.get("progress_pct") or 0, "progress_pct", 0, 100),
            progress_manual=as_bool(t_data.get("progress_manual") or False, "progress_manual"),
            colour=opt_str(t_data, "colour", 7),
            # Dependencies point at old ids: remap, and drop any that aren't in the file.
            dependencies=[id_map[d] for d in deps if isinstance(d, str) and d in id_map],
        )
        db.session.add(t)
        db.session.flush()  # parent row exists before its children (FKs are enforced)
        for note_data in t_data.get("notes") or []:
            if isinstance(note_data, dict) and isinstance(note_data.get("body"), str):
                db.session.add(Note(task_id=t.id, body=note_data["body"]))
                notes_count += 1
        attachments_skipped += len(t_data.get("attachment_metadata") or [])

    for r_data in risks_data:
        if not isinstance(r_data, dict):
            bad("Every risk must be an object")
        entry_type = r_data.get("entry_type") or "risk"
        if entry_type not in VALID_ENTRY_TYPES:
            bad("A risk has an unknown entry_type")
        status = r_data.get("status") or "open"
        impact = r_data.get("impact") or "medium"
        probability = r_data.get("probability") or "medium"
        if status not in statuses_for(entry_type) or impact not in VALID_IMPACTS or probability not in VALID_PROBS:
            bad("A risk has an unknown status, impact or probability")
        db.session.add(RiskIssue(
            project_id=new_project.id,
            entry_type=entry_type,
            title=require_str(r_data, "title", 500),
            description=opt_str(r_data, "description"),
            status=status,
            impact=impact,
            probability=probability,
            owner=opt_str(r_data, "owner", 255),
            response=opt_str(r_data, "response"),
            raised_date=parse_date(r_data.get("raised_date"), "raised_date"),
            due_date=parse_date(r_data.get("due_date"), "due_date"),
        ))

    db.session.commit()
    result = new_project.to_dict()
    result["import_summary"] = {
        "tasks": len(ordered),
        "notes": notes_count,
        "risks": len(risks_data),
        "attachments_skipped": attachments_skipped,
        "attachments_note": ATTACHMENTS_NOTE if attachments_skipped else None,
    }
    return jsonify(result), 201


# ── CSV export ───────────────────────────────────────────────────────────────

@projects_bp.route("/projects/<pid>/export/csv", methods=["GET"])
def export_csv(pid):
    p = db.get_or_404(Project, pid)
    tasks = Task.query.filter_by(project_id=pid).order_by(Task.position).all()

    task_map = {t.id: t for t in tasks}

    def depth(t):
        d, cur, seen = 0, t, {t.id}
        while cur.parent_id:
            cur = task_map.get(cur.parent_id)
            if not cur or cur.id in seen:  # missing parent or a cycle in old data
                break
            seen.add(cur.id)
            d += 1
        return d

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "level", "id", "title", "task_type", "status", "assignee",
        "start_date", "end_date", "effort_hours", "progress_pct",
    ])
    writer.writeheader()
    for t in tasks:
        writer.writerow({
            "level": depth(t),
            "id": t.id,
            "title": t.title,
            "task_type": t.task_type,
            "status": t.status,
            "assignee": t.assignee or "",
            "start_date": t.start_date.isoformat() if t.start_date else "",
            "end_date": t.end_date.isoformat() if t.end_date else "",
            "effort_hours": t.effort_hours if t.effort_hours is not None else "",
            "progress_pct": t.progress_pct,
        })

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": content_disposition(f"{p.name}.csv")},
    )
