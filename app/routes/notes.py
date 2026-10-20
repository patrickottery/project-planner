from flask import Blueprint, jsonify
from app import db
from app.models import Note, Task
from app.validation import bad, json_body

notes_bp = Blueprint("notes", __name__)


@notes_bp.route("/tasks/<tid>/notes", methods=["GET"])
def list_notes(tid):
    db.get_or_404(Task, tid)
    notes = Note.query.filter_by(task_id=tid).order_by(Note.created_at.desc()).all()
    return jsonify([n.to_dict() for n in notes])


@notes_bp.route("/tasks/<tid>/notes", methods=["POST"])
def create_note(tid):
    db.get_or_404(Task, tid)
    data = json_body()
    if not isinstance(data.get("body"), str):
        bad("'body' is required and must be a string")
    n = Note(task_id=tid, body=data["body"])
    db.session.add(n)
    db.session.commit()
    return jsonify(n.to_dict()), 201


@notes_bp.route("/notes/<nid>", methods=["PUT"])
def update_note(nid):
    n = db.get_or_404(Note, nid)
    data = json_body()
    if "body" in data:
        if not isinstance(data["body"], str):
            bad("'body' must be a string")
        n.body = data["body"]
    db.session.commit()
    return jsonify(n.to_dict())


@notes_bp.route("/notes/<nid>", methods=["DELETE"])
def delete_note(nid):
    n = db.get_or_404(Note, nid)
    db.session.delete(n)
    db.session.commit()
    return "", 204
