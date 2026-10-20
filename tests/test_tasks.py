from app import db
from app.models import Task


def test_move_refuses_cycles(client, make_project, make_task):
    pid = make_project()
    a = make_task(pid, title="A")
    b = make_task(pid, title="B", parent_id=a)
    c = make_task(pid, title="C", parent_id=b)
    for target in (a, b, c):
        r = client.post(f"/api/v1/tasks/{a}/move", json={"parent_id": target, "position": 0})
        assert r.status_code == 400, target
    assert client.post(f"/api/v1/tasks/{c}/move", json={"parent_id": None, "position": 0}).status_code == 200


def test_move_refuses_cross_project(client, make_project, make_task):
    p1, p2 = make_project("one"), make_project("two")
    a, b = make_task(p1), make_task(p2)
    assert client.post(f"/api/v1/tasks/{a}/move", json={"parent_id": b}).status_code == 400
    assert client.post(f"/api/v1/projects/{p1}/tasks", json={"parent_id": b}).status_code == 400
    assert client.post(f"/api/v1/tasks/{a}/move", json={"parent_id": "nope"}).status_code == 400


def test_move_position_must_be_numeric(client, make_project, make_task):
    pid = make_project()
    a = make_task(pid)
    assert client.post(f"/api/v1/tasks/{a}/move", json={"position": "x"}).status_code == 400
    assert client.post(f"/api/v1/tasks/{a}/move", json={"position": 1.5}).status_code == 400
    assert client.post(f"/api/v1/tasks/{a}/move", json={"position": 20}).status_code == 200


def test_validation_400s(client, make_project, make_task):
    pid = make_project()
    t = make_task(pid)
    bad = [
        ("post", f"/api/v1/projects/{pid}/tasks", {"start_date": "2026-13-45"}),
        ("put", f"/api/v1/tasks/{t}", {"end_date": "tomorrow"}),
        ("put", f"/api/v1/tasks/{t}", {"start_date": 20260101}),
        ("put", f"/api/v1/tasks/{t}", {"start_date": "2026-02-01", "end_date": "2026-01-01"}),
        ("put", f"/api/v1/tasks/{t}", {"position": "first"}),
        ("put", f"/api/v1/tasks/{t}", {"progress_pct": 150}),
        ("put", f"/api/v1/tasks/{t}", {"status": "nonsense"}),
        ("put", f"/api/v1/tasks/{t}", {"dependencies": "abc"}),
        ("put", f"/api/v1/tasks/{t}", {"title": ""}),
        ("post", "/api/v1/projects", {}),
        ("post", "/api/v1/projects", {"name": 5}),
        ("post", f"/api/v1/tasks/{t}/notes", {}),
    ]
    for method, url, body in bad:
        r = getattr(client, method)(url, json=body)
        assert r.status_code == 400, (url, body, r.status_code)
        assert "error" in r.get_json()
    # Not JSON at all
    assert client.post("/api/v1/projects", data="x", content_type="text/plain").status_code == 400
    assert client.put(f"/api/v1/tasks/{t}", data="[1]", content_type="application/json").status_code == 400


def test_delete_cascades_and_keep_children(client, app, make_project, make_task):
    pid = make_project()
    a = make_task(pid, title="A")
    b = make_task(pid, title="B", parent_id=a)
    c = make_task(pid, title="C", parent_id=b)
    assert client.delete(f"/api/v1/tasks/{b}?cascade=false").status_code == 204
    with app.app_context():
        assert db.session.get(Task, c).parent_id == a
    assert client.delete(f"/api/v1/tasks/{a}").status_code == 204
    with app.app_context():
        assert Task.query.count() == 0


def test_csv_export_survives_a_parent_cycle(client, app, make_project, make_task):
    pid = make_project()
    a = make_task(pid, title="A")
    b = make_task(pid, title="B", parent_id=a)
    with app.app_context():  # corrupt data the old move endpoint could create
        db.session.get(Task, a).parent_id = b
        db.session.commit()
    r = client.get(f"/api/v1/projects/{pid}/export/csv")
    assert r.status_code == 200
    assert client.get(f"/api/v1/projects/{pid}/tasks").status_code == 200
