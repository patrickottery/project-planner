import os

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
    DATA_PATH = os.environ.get("DATA_PATH", "/data/app.db")
    UPLOADS_PATH = os.environ.get("UPLOADS_PATH", "/data/uploads")
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DATA_PATH}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_UPLOAD_MB", 10)) * 1024 * 1024
