from urllib.parse import unquote

from app.models import Note, RiskIssue, Task


def test_round_trip_keeps_hierarchy_dependencies_notes_and_risks(client, app, make_project, make_task):
    pid = make_project("Plan")
    a = make_task(pid, title="Phase A", task_type="phase")
    a1 = make_task(pid, title="A1", parent_id=a, start_date="2026-01-05", end_date="2026-01-09")
    a1x = make_task(pid, title="A1x", parent_id=a1)
    b = make_task(pid, title="B", dependencies=[a1, a1x])
    client.post(f"/api/v1/tasks/{a1x}/notes", json={"body": "deep note"})
    client.post(f"/api/v1/projects/{pid}/risks", json={"title": "Supplier late", "impact": "high"})
    client.post(f"/api/v1/projects/{pid}/risks", json={"title": "Bug", "entry_type": "issue", "status": "in_progress"})

    export = client.get(f"/api/v1/projects/{pid}/export/json")
    data = export.get_json()
    assert data["format_version"] == 2 and len(data["risks"]) == 2
    # Children listed before parents must still import
    data["tasks"].reverse()

    r = client.post("/api/v1/projects/import/json", json=data)
    assert r.status_code == 201, r.get_json()
    new = r.get_json()
    assert new["import_summary"]["tasks"] == 4
    assert new["import_summary"]["risks"] == 2

    with app.app_context():
        tasks = {t.title: t for t in Task.query.filter_by(project_id=new["id"]).all()}
        assert set(tasks) == {"Phase A", "A1", "A1x", "B"}
        assert tasks["A1"].parent_id == tasks["Phase A"].id
        assert tasks["A1x"].parent_id == tasks["A1"].id
        assert tasks["Phase A"].parent_id is None
        assert sorted(tasks["B"].dependencies) == sorted([tasks["A1"].id, tasks["A1x"].id])
        assert str(tasks["A1"].start_date) == "2026-01-05"
        assert Note.query.filter_by(task_id=tasks["A1x"].id).one().body == "deep note"
        risks = RiskIssue.query.filter_by(project_id=new["id"]).all()
        assert {(r.title, r.entry_type, r.status) for r in risks} == {
            ("Supplier late", "risk", "open"), ("Bug", "issue", "in_progress")}
        assert {t.id for t in tasks.values()}.isdisjoint({a, a1, a1x, b})


def test_import_reports_skipped_attachments(client, make_project, make_task):
    pid = make_project()
    tid = make_task(pid)
    import io
    client.post(f"/api/v1/tasks/{tid}/attachments", data={"file": (io.BytesIO(b"x"), "f.txt")},
                content_type="multipart/form-data")
    data = client.get(f"/api/v1/projects/{pid}/export/json").get_json()
    assert "not included" in data["attachments_note"]
    summary = client.post("/api/v1/projects/import/json", json=data).get_json()["import_summary"]
    assert summary["attachments_skipped"] == 1
    assert summary["attachments_note"]


def test_import_rejects_bad_files(client):
    base = {"project": {"name": "X"}}
    cases = [
        {},
        {"project": "x"},
        {**base, "tasks": [{"title": "no id"}]},
        {**base, "tasks": [{"id": "a", "title": "A", "parent_id": "b"}, {"id": "b", "title": "B", "parent_id": "a"}]},
        {**base, "tasks": [{"id": "a", "title": "A", "start_date": "31/12/2026"}]},
        {**base, "tasks": [{"id": "a", "title": "A"}, {"id": "a", "title": "dup"}]},
        {**base, "risks": [{"title": "R", "impact": "apocalyptic"}]},
    ]
    for body in cases:
        assert client.post("/api/v1/projects/import/json", json=body).status_code == 400, body


def test_import_missing_parent_becomes_top_level(client, app):
    body = {"project": {"name": "X"}, "tasks": [{"id": "a", "title": "Orphan", "parent_id": "gone"}]}
    r = client.post("/api/v1/projects/import/json", json=body)
    assert r.status_code == 201
    with app.app_context():
        assert Task.query.filter_by(title="Orphan").one().parent_id is None


def test_content_disposition_is_rfc5987(client, make_project):
    pid = make_project('Q3 "big" plan—Ünïcode')
    cd = client.get(f"/api/v1/projects/{pid}/export/csv").headers["Content-Disposition"]
    assert '"big"' not in cd and "\n" not in cd
    assert cd.startswith('attachment; filename="')
    assert unquote(cd.split("filename*=UTF-8''")[1]) == 'Q3 "big" plan—Ünïcode.csv'
