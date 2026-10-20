import mimetypes
import os
import shutil
import uuid

from flask import Blueprint, current_app, jsonify, request, send_file
from werkzeug.utils import secure_filename

from app import db
from app.models import Attachment, Task

attachments_bp = Blueprint("attachments", __name__)

# Served inline by /preview. Everything else is a download. No SVG: it can carry script.
INLINE_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/bmp",
    "application/pdf",
}
# Types a browser would execute or render as a document if it ever opened them; always
# sent as opaque bytes.
ACTIVE_TYPES = {
    "text/html", "application/xhtml+xml", "image/svg+xml", "text/xml", "application/xml",
    "text/javascript", "application/javascript", "application/x-javascript",
}


def mime_for(filename: str) -> str:
    """The MIME type is decided here, from the extension — never from the uploader."""
    return mimetypes.guess_type(filename)[0] or "application/octet-stream"


def _upload_dir(task_id: str) -> str:
    return os.path.join(current_app.config["UPLOADS_PATH"], task_id)


def _file_path(a: Attachment) -> str:
    return os.path.join(_upload_dir(a.task_id), a.stored_name)


def remove_upload_dirs(task_ids):
    """Delete the upload folders of tasks that no longer exist (call after commit)."""
    root = os.path.realpath(current_app.config["UPLOADS_PATH"])
    for tid in task_ids:
        path = os.path.realpath(os.path.join(root, tid))
        if os.path.dirname(path) == root and os.path.isdir(path):
            shutil.rmtree(path, ignore_errors=True)


@attachments_bp.route("/tasks/<tid>/attachments", methods=["GET"])
def list_attachments(tid):
    db.get_or_404(Task, tid)
    attachments = Attachment.query.filter_by(task_id=tid).order_by(Attachment.created_at.desc()).all()
    return jsonify([a.to_dict() for a in attachments])


@attachments_bp.route("/tasks/<tid>/attachments", methods=["POST"])
def upload_attachment(tid):
    db.get_or_404(Task, tid)
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No filename"}), 400

    original_name = secure_filename(file.filename) or "file"
    stored_name = f"{uuid.uuid4()}_{original_name}"

    upload_dir = _upload_dir(tid)
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, stored_name)
    file.save(file_path)
    size_bytes = os.path.getsize(file_path)

    a = Attachment(
        task_id=tid,
        filename=original_name,
        stored_name=stored_name,
        mime_type=mime_for(original_name),
        size_bytes=size_bytes,
    )
    db.session.add(a)
    db.session.commit()
    return jsonify(a.to_dict()), 201


@attachments_bp.route("/attachments/<aid>/download", methods=["GET"])
def download_attachment(aid):
    a = db.get_or_404(Attachment, aid)
    mime = mime_for(a.filename)
    if mime in ACTIVE_TYPES:
        mime = "application/octet-stream"
    resp = send_file(_file_path(a), as_attachment=True, download_name=a.filename, mimetype=mime)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp


@attachments_bp.route("/attachments/<aid>/preview", methods=["GET"])
def preview_attachment(aid):
    """Raster images and PDFs inline; anything else as a download. Text files are
    previewed by the frontend via fetch(), which reads an attachment just as well."""
    a = db.get_or_404(Attachment, aid)
    mime = mime_for(a.filename)
    if mime in INLINE_TYPES:
        resp = send_file(_file_path(a), as_attachment=False, mimetype=mime)
    else:
        safe = "text/plain" if mime.startswith("text/") or mime in ACTIVE_TYPES or mime == "application/json" \
            else "application/octet-stream"
        resp = send_file(_file_path(a), as_attachment=True, download_name=a.filename, mimetype=safe)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Content-Security-Policy"] = "sandbox"
    return resp


@attachments_bp.route("/attachments/<aid>", methods=["DELETE"])
def delete_attachment(aid):
    a = db.get_or_404(Attachment, aid)
    file_path = _file_path(a)
    db.session.delete(a)
    db.session.commit()
    if os.path.exists(file_path):
        os.remove(file_path)
    return "", 204
