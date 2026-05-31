import csv
import io
import json
import uuid
from datetime import date
from flask import Blueprint, jsonify, request, Response
from app import db
from app.models import Project, Task, Note, Attachment

projects_bp = Blueprint("projects", __name__)


@projects_bp.route("/projects", methods=["GET"])
def list_projects():
    projects = Project.query.order_by(Project.created_at.desc()).all()
    return jsonify([p.to_dict() for p in projects])


@projects_bp.route("/projects", methods=["POST"])
def create_project():
    data = request.json
    p = Project(
        name=data["name"],
        description=data.get("description"),
        colour=data.get("colour", "#6366f1"),
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@projects_bp.route("/projects/<pid>", methods=["GET"])
def get_project(pid):
    p = Project.query.get_or_404(pid)
    return jsonify(p.to_dict())


@projects_bp.route("/projects/<pid>", methods=["PUT"])
def update_project(pid):
    p = Project.query.get_or_404(pid)
    data = request.json
    for field in ("name", "description", "colour"):
        if field in data:
            setattr(p, field, data[field])
    db.session.commit()
    return jsonify(p.to_dict())


@projects_bp.route("/projects/<pid>", methods=["DELETE"])
def delete_project(pid):
    p = Project.query.get_or_404(pid)
    db.session.delete(p)
    db.session.commit()
    return "", 204


def _build_tree(tasks_by_parent, parent_id=None):
    result = []
    for t in tasks_by_parent.get(parent_id, []):
        d = t.to_dict()
        d["children"] = _build_tree(tasks_by_parent, t.id)
        result.append(d)
    return result


@projects_bp.route("/projects/<pid>/tasks", methods=["GET"])
def get_project_tasks(pid):
    Project.query.get_or_404(pid)
    tasks = Task.query.filter_by(project_id=pid).order_by(Task.position).all()
    by_parent = {}
    for t in tasks:
        by_parent.setdefault(t.parent_id, []).append(t)
    return jsonify(_build_tree(by_parent))


@projects_bp.route("/projects/<pid>/export/json", methods=["GET"])
def export_json(pid):
    p = Project.query.get_or_404(pid)
    tasks = Task.query.filter_by(project_id=pid).all()

    def task_export(t):
        d = t.to_dict()
        d["notes"] = [n.to_dict() for n in t.notes]
        d["attachment_metadata"] = [a.to_dict() for a in t.attachments]
        return d

    payload = {
        "project": p.to_dict(),
        "tasks": [task_export(t) for t in tasks],
    }
    return Response(
        json.dumps(payload, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": f'attachment; filename="{p.name}.json"'},
    )


@projects_bp.route("/projects/import/json", methods=["POST"])
def import_json():
    data = request.json
    proj_data = data["project"]
    new_project = Project(
        name=proj_data["name"] + " (imported)",
        description=proj_data.get("description"),
        colour=proj_data.get("colour", "#6366f1"),
    )
    db.session.add(new_project)
    db.session.flush()

    id_map = {}

    def import_task(t_data, parent_id=None):
        old_id = t_data["id"]
        new_id = str(uuid.uuid4())
        id_map[old_id] = new_id
        t = Task(
            id=new_id,
            project_id=new_project.id,
            parent_id=parent_id,
            position=t_data.get("position", 0),
            title=t_data["title"],
            description=t_data.get("description"),
            assignee=t_data.get("assignee"),
            task_type=t_data.get("task_type", "task"),
            status=t_data.get("status", "not_started"),
            start_date=date.fromisoformat(t_data["start_date"]) if t_data.get("start_date") else None,
            end_date=date.fromisoformat(t_data["end_date"]) if t_data.get("end_date") else None,
            effort_hours=t_data.get("effort_hours"),
            progress_pct=t_data.get("progress_pct", 0),
            progress_manual=t_data.get("progress_manual", False),
            colour=t_data.get("colour"),
            dependencies=[],
        )
        db.session.add(t)
        for note_data in t_data.get("notes", []):
            n = Note(
                task_id=new_id,
                body=note_data["body"],
            )
            db.session.add(n)
        return new_id

    for t_data in data.get("tasks", []):
        if t_data.get("parent_id") is None:
            import_task(t_data)

    db.session.commit()
    return jsonify(new_project.to_dict()), 201


@projects_bp.route("/projects/<pid>/export/csv", methods=["GET"])
def export_csv(pid):
    p = Project.query.get_or_404(pid)
    tasks = Task.query.filter_by(project_id=pid).order_by(Task.position).all()

    task_map = {t.id: t for t in tasks}

    def depth(t):
        d = 0
        cur = t
        while cur.parent_id:
            cur = task_map.get(cur.parent_id)
            if not cur:
                break
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
            "effort_hours": t.effort_hours or "",
            "progress_pct": t.progress_pct,
        })

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{p.name}.csv"'},
    )
