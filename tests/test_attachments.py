import io
import os

import pytest

from app import db
from app.models import Project, RiskIssue


def upload(client, tid, name, data=b"hello", content_type="text/html"):
    return client.post(f"/api/v1/tasks/{tid}/attachments",
                       data={"file": (io.BytesIO(data), name, content_type)},
                       content_type="multipart/form-data")


@pytest.mark.parametrize("name,inline,mime", [
    ("pic.png", True, "image/png"),
    ("doc.pdf", True, "application/pdf"),
    ("evil.html", False, "text/plain"),
    ("evil.svg", False, "text/plain"),
    ("notes.txt", False, "text/plain"),
    ("blob.bin", False, "application/octet-stream"),
])
def test_preview_only_inlines_safe_types(client, make_project, make_task, name, inline, mime):
    tid = make_task(make_project())
    a = upload(client, tid, name, b"<script>alert(1)</script>", content_type="text/html").get_json()
    r = client.get(f"/api/v1/attachments/{a['id']}/preview")
    assert r.status_code == 200
    cd = r.headers.get("Content-Disposition", "")
    assert ("attachment" in cd) is (not inline)
    assert r.mimetype == mime
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["Content-Security-Policy"] == "sandbox"


def test_mime_is_decided_server_side(client, make_project, make_task):
    tid = make_task(make_project())
    a = upload(client, tid, "photo.png", content_type="text/html").get_json()
    assert a["mime_type"] == "image/png"
    d = client.get(f"/api/v1/attachments/{upload(client, tid, 'x.html').get_json()['id']}/download")
    assert d.mimetype == "application/octet-stream"
    assert "attachment" in d.headers["Content-Disposition"]


def test_task_and_project_delete_remove_files(client, app, make_project, make_task):
    pid = make_project()
    parent = make_task(pid)
    child = make_task(pid, parent_id=parent)
    upload(client, parent, "a.txt")
    upload(client, child, "b.txt")
    uploads = app.config["UPLOADS_PATH"]
    assert sorted(os.listdir(uploads)) == sorted([parent, child])
    assert client.delete(f"/api/v1/tasks/{parent}").status_code == 204
    assert os.listdir(uploads) == []

    other = make_task(pid)
    upload(client, other, "c.txt")
    client.post(f"/api/v1/projects/{pid}/risks", json={"title": "R"})
    assert client.delete(f"/api/v1/projects/{pid}").status_code == 204
    assert os.listdir(uploads) == []
    with app.app_context():
        assert RiskIssue.query.count() == 0
        assert db.session.get(Project, pid) is None


def test_foreign_keys_enforced(app):
    with app.app_context():
        assert db.session.execute(db.text("PRAGMA foreign_keys")).scalar() == 1
