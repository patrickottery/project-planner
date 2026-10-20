import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db  # noqa: E402
from app.auth import read_auth_config  # noqa: E402

DEV_AUTH = {"DEV_AUTH_EMAIL": "dev@localhost", "APP_ENV": "dev"}


def make_app(tmp_path, auth_env=None, **extra):
    db_path = tmp_path / "app.db"
    app = create_app({
        "TESTING": True,
        "DATA_PATH": str(db_path),
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path}",
        "UPLOADS_PATH": str(tmp_path / "uploads"),
        "AUTH": read_auth_config(DEV_AUTH if auth_env is None else auth_env),
        **extra,
    })
    return app


@pytest.fixture
def app(tmp_path):
    app = make_app(tmp_path)
    yield app
    with app.app_context():
        db.session.remove()
        db.engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def make_project(client):
    def _make(name="P"):
        r = client.post("/api/v1/projects", json={"name": name})
        assert r.status_code == 201, r.get_json()
        return r.get_json()["id"]
    return _make


@pytest.fixture
def make_task(client):
    def _make(pid, **fields):
        r = client.post(f"/api/v1/projects/{pid}/tasks", json=fields)
        assert r.status_code == 201, r.get_json()
        return r.get_json()["id"]
    return _make
