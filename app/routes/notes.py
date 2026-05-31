from flask import Blueprint, jsonify, request
from app import db
from app.models import Note, Task

notes_bp = Blueprint("notes", __name__)


@notes_bp.route("/tasks/<tid>/notes", methods=["GET"])
def list_notes(tid):
    Task.query.get_or_404(tid)
    notes = Note.query.filter_by(task_id=tid).order_by(Note.created_at.desc()).all()
    return jsonify([n.to_dict() for n in notes])


@notes_bp.route("/tasks/<tid>/notes", methods=["POST"])
def create_note(tid):
    Task.query.get_or_404(tid)
    data = request.json
    n = Note(task_id=tid, body=data["body"])
    db.session.add(n)
    db.session.commit()
    return jsonify(n.to_dict()), 201


@notes_bp.route("/notes/<nid>", methods=["PUT"])
def update_note(nid):
    n = Note.query.get_or_404(nid)
    data = request.json
    if "body" in data:
        n.body = data["body"]
    db.session.commit()
    return jsonify(n.to_dict())


@notes_bp.route("/notes/<nid>", methods=["DELETE"])
def delete_note(nid):
    n = Note.query.get_or_404(nid)
    db.session.delete(n)
    db.session.commit()
    return "", 204
