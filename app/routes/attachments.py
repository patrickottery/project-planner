import os
import uuid
import mimetypes
from flask import Blueprint, jsonify, request, send_file, current_app
from werkzeug.utils import secure_filename
from app import db
from app.models import Attachment, Task

attachments_bp = Blueprint("attachments", __name__)


@attachments_bp.route("/tasks/<tid>/attachments", methods=["GET"])
def list_attachments(tid):
    Task.query.get_or_404(tid)
    attachments = Attachment.query.filter_by(task_id=tid).order_by(Attachment.created_at.desc()).all()
    return jsonify([a.to_dict() for a in attachments])


@attachments_bp.route("/tasks/<tid>/attachments", methods=["POST"])
def upload_attachment(tid):
    Task.query.get_or_404(tid)
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No filename"}), 400

    original_name = secure_filename(file.filename)
    stored_name = f"{uuid.uuid4()}_{original_name}"
    mime_type = file.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"

    upload_dir = os.path.join(current_app.config["UPLOADS_PATH"], tid)
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, stored_name)
    file.save(file_path)
    size_bytes = os.path.getsize(file_path)

    a = Attachment(
        task_id=tid,
        filename=original_name,
        stored_name=stored_name,
        mime_type=mime_type,
        size_bytes=size_bytes,
    )
    db.session.add(a)
    db.session.commit()
    return jsonify(a.to_dict()), 201


@attachments_bp.route("/attachments/<aid>/download", methods=["GET"])
def download_attachment(aid):
    a = Attachment.query.get_or_404(aid)
    upload_dir = os.path.join(current_app.config["UPLOADS_PATH"], a.task_id)
    file_path = os.path.join(upload_dir, a.stored_name)
    return send_file(file_path, as_attachment=True, download_name=a.filename, mimetype=a.mime_type)


@attachments_bp.route("/attachments/<aid>", methods=["DELETE"])
def delete_attachment(aid):
    a = Attachment.query.get_or_404(aid)
    upload_dir = os.path.join(current_app.config["UPLOADS_PATH"], a.task_id)
    file_path = os.path.join(upload_dir, a.stored_name)
    if os.path.exists(file_path):
        os.remove(file_path)
    db.session.delete(a)
    db.session.commit()
    return "", 204
