import uuid
from datetime import datetime, timezone
from app import db


def new_uuid():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc)


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.String(36), primary_key=True, default=new_uuid)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    colour = db.Column(db.String(7), default="#6366f1")
    created_at = db.Column(db.DateTime, default=now)
    updated_at = db.Column(db.DateTime, default=now, onupdate=now)

    tasks = db.relationship("Task", backref="project", cascade="all, delete-orphan", lazy="dynamic")

    def to_dict(self):
        tasks = list(self.tasks)
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "colour": self.colour,
            "task_count": len(tasks),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.String(36), primary_key=True, default=new_uuid)
    project_id = db.Column(db.String(36), db.ForeignKey("projects.id"), nullable=False)
    parent_id = db.Column(db.String(36), db.ForeignKey("tasks.id"), nullable=True)
    position = db.Column(db.Integer, default=0)
    title = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text)
    assignee = db.Column(db.String(255))
    task_type = db.Column(db.String(20), default="task")  # task | milestone | phase
    status = db.Column(db.String(20), default="not_started")
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    effort_hours = db.Column(db.Float)
    progress_pct = db.Column(db.Integer, default=0)
    progress_manual = db.Column(db.Boolean, default=False)
    colour = db.Column(db.String(7))
    dependencies = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=now)
    updated_at = db.Column(db.DateTime, default=now, onupdate=now)

    children = db.relationship(
        "Task",
        backref=db.backref("parent", remote_side="Task.id"),
        cascade="all, delete-orphan",
        order_by="Task.position",
        lazy="dynamic",
    )
    notes = db.relationship("Note", backref="task", cascade="all, delete-orphan", lazy="dynamic")
    attachments = db.relationship("Attachment", backref="task", cascade="all, delete-orphan", lazy="dynamic")

    def to_dict(self, include_children=False):
        d = {
            "id": self.id,
            "project_id": self.project_id,
            "parent_id": self.parent_id,
            "position": self.position,
            "title": self.title,
            "description": self.description,
            "assignee": self.assignee,
            "task_type": self.task_type,
            "status": self.status,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "effort_hours": self.effort_hours,
            "progress_pct": self.progress_pct,
            "progress_manual": self.progress_manual,
            "colour": self.colour,
            "dependencies": self.dependencies or [],
            "note_count": self.notes.count(),
            "attachment_count": self.attachments.count(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_children:
            d["children"] = [c.to_dict(include_children=True) for c in self.children.order_by(Task.position)]
        return d


class Note(db.Model):
    __tablename__ = "notes"

    id = db.Column(db.String(36), primary_key=True, default=new_uuid)
    task_id = db.Column(db.String(36), db.ForeignKey("tasks.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=now)
    updated_at = db.Column(db.DateTime, default=now, onupdate=now)

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "body": self.body,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Attachment(db.Model):
    __tablename__ = "attachments"

    id = db.Column(db.String(36), primary_key=True, default=new_uuid)
    task_id = db.Column(db.String(36), db.ForeignKey("tasks.id"), nullable=False)
    filename = db.Column(db.String(500), nullable=False)
    stored_name = db.Column(db.String(500), nullable=False)
    mime_type = db.Column(db.String(255))
    size_bytes = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=now)

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "filename": self.filename,
            "stored_name": self.stored_name,
            "mime_type": self.mime_type,
            "size_bytes": self.size_bytes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
