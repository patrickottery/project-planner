import os
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app():
    app = Flask(__name__, static_folder="static")
    app.config.from_object("config.Config")

    os.makedirs(os.path.dirname(app.config["DATA_PATH"]), exist_ok=True)
    os.makedirs(app.config["UPLOADS_PATH"], exist_ok=True)

    db.init_app(app)

    from app.routes.projects import projects_bp
    from app.routes.tasks import tasks_bp
    from app.routes.notes import notes_bp
    from app.routes.attachments import attachments_bp

    app.register_blueprint(projects_bp, url_prefix="/api/v1")
    app.register_blueprint(tasks_bp, url_prefix="/api/v1")
    app.register_blueprint(notes_bp, url_prefix="/api/v1")
    app.register_blueprint(attachments_bp, url_prefix="/api/v1")

    with app.app_context():
        db.create_all()

    @app.route("/health")
    def health():
        return {"status": "ok"}

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def spa(path):
        dist = os.path.join(app.static_folder, "dist")
        if path and os.path.exists(os.path.join(dist, path)):
            return send_from_directory(dist, path)
        return send_from_directory(dist, "index.html")

    return app
