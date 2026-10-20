import os

from flask import Flask, g, jsonify, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.engine import Engine
from werkzeug.exceptions import HTTPException

db = SQLAlchemy()


@event.listens_for(Engine, "connect")
def _sqlite_foreign_keys(dbapi_connection, connection_record):
    """SQLite ignores FOREIGN KEY constraints unless asked, per connection."""
    if type(dbapi_connection).__module__.startswith("sqlite3"):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()


def create_app(overrides=None):
    app = Flask(__name__, static_folder="static")
    app.config.from_object("config.Config")
    if overrides:
        app.config.update(overrides)

    os.makedirs(os.path.dirname(app.config["DATA_PATH"]), exist_ok=True)
    os.makedirs(app.config["UPLOADS_PATH"], exist_ok=True)

    db.init_app(app)

    from app.auth import init_auth
    init_auth(app)

    from app.routes.projects import projects_bp
    from app.routes.tasks import tasks_bp
    from app.routes.notes import notes_bp
    from app.routes.attachments import attachments_bp
    from app.routes.risks import risks_bp

    app.register_blueprint(projects_bp, url_prefix="/api/v1")
    app.register_blueprint(tasks_bp, url_prefix="/api/v1")
    app.register_blueprint(notes_bp, url_prefix="/api/v1")
    app.register_blueprint(attachments_bp, url_prefix="/api/v1")
    app.register_blueprint(risks_bp, url_prefix="/api/v1")

    # gunicorn --preload runs this once in the master, not once per worker.
    with app.app_context():
        db.create_all()

    @app.errorhandler(HTTPException)
    def http_error(e):
        if request.path.startswith("/api/"):
            return jsonify(error=e.description), e.code
        return e

    @app.route("/health")
    def health():
        return {"status": "ok"}

    @app.route("/api/v1/me")
    def me():
        # APP_ENV != prod → the frontend shows the DEV banner / title / favicon.
        return {"email": g.get("user"), "env": app.config["APP_ENV"]}

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def spa(path):
        dist = os.path.join(app.static_folder, "dist")
        if path.startswith("api/"):
            return jsonify(error="Not found"), 404
        if path and os.path.isfile(os.path.join(dist, path)):
            return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")

    return app
