from datetime import date
from flask import Blueprint, jsonify, request, abort
from app import db
from app.models import Project, RiskIssue

risks_bp = Blueprint("risks", __name__)

VALID_ENTRY_TYPES  = {"risk", "issue"}
VALID_RISK_STATUSES  = {"open", "mitigated", "accepted", "closed"}
VALID_ISSUE_STATUSES = {"open", "in_progress", "resolved", "closed"}
VALID_IMPACTS      = {"low", "medium", "high", "critical"}
VALID_PROBS        = {"low", "medium", "high"}


def _bad(msg):
    abort(400, description=msg)


def _parse_date(value, field):
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        _bad(f"'{field}' must be a valid ISO date (YYYY-MM-DD)")


def _validate(data, entry_type=None):
    title = data.get("title", "")
    if not isinstance(title, str) or not title.strip():
        _bad("'title' is required and must be a non-empty string")

    etype = entry_type or data.get("entry_type", "risk")
    if etype not in VALID_ENTRY_TYPES:
        _bad(f"'entry_type' must be one of: {', '.join(sorted(VALID_ENTRY_TYPES))}")

    valid_statuses = VALID_RISK_STATUSES if etype == "risk" else VALID_ISSUE_STATUSES
    if "status" in data and data["status"] not in valid_statuses:
        _bad(f"'status' must be one of: {', '.join(sorted(valid_statuses))}")

    if "impact" in data and data["impact"] not in VALID_IMPACTS:
        _bad(f"'impact' must be one of: {', '.join(sorted(VALID_IMPACTS))}")

    if "probability" in data and data["probability"] not in VALID_PROBS:
        _bad(f"'probability' must be one of: {', '.join(sorted(VALID_PROBS))}")


@risks_bp.errorhandler(400)
def bad_request(e):
    return jsonify(error=str(e.description)), 400


@risks_bp.route("/projects/<pid>/risks", methods=["GET"])
def list_risks(pid):
    Project.query.get_or_404(pid)
    items = RiskIssue.query.filter_by(project_id=pid).order_by(RiskIssue.created_at.desc()).all()
    return jsonify([r.to_dict() for r in items])


@risks_bp.route("/projects/<pid>/risks", methods=["POST"])
def create_risk(pid):
    Project.query.get_or_404(pid)
    data = request.get_json(silent=True) or {}
    _validate(data)
    r = RiskIssue(
        project_id=pid,
        entry_type=data.get("entry_type", "risk"),
        title=data["title"].strip(),
        description=data.get("description") or None,
        status=data.get("status", "open"),
        impact=data.get("impact", "medium"),
        probability=data.get("probability", "medium"),
        owner=data.get("owner") or None,
        response=data.get("response") or None,
        raised_date=_parse_date(data["raised_date"], "raised_date") if data.get("raised_date") else None,
        due_date=_parse_date(data["due_date"], "due_date") if data.get("due_date") else None,
    )
    db.session.add(r)
    db.session.commit()
    return jsonify(r.to_dict()), 201


@risks_bp.route("/risks/<rid>", methods=["PUT"])
def update_risk(rid):
    r = RiskIssue.query.get_or_404(rid)
    data = request.get_json(silent=True) or {}
    _validate(data, entry_type=data.get("entry_type", r.entry_type))
    for field in ("entry_type", "description", "status", "impact", "probability", "owner", "response"):
        if field in data:
            setattr(r, field, data[field] or None if field not in ("status", "impact", "probability", "entry_type") else data[field])
    if "title" in data:
        r.title = data["title"].strip()
    if "raised_date" in data:
        r.raised_date = _parse_date(data["raised_date"], "raised_date") if data["raised_date"] else None
    if "due_date" in data:
        r.due_date = _parse_date(data["due_date"], "due_date") if data["due_date"] else None
    db.session.commit()
    return jsonify(r.to_dict())


@risks_bp.route("/risks/<rid>", methods=["DELETE"])
def delete_risk(rid):
    r = RiskIssue.query.get_or_404(rid)
    db.session.delete(r)
    db.session.commit()
    return "", 204
