"""Small input-validation helpers. Every failure is a 400 with a JSON error message."""

import math
from datetime import date
from urllib.parse import quote

from flask import abort, request

TASK_TYPES = {"task", "milestone", "phase"}
TASK_STATUSES = {"not_started", "in_progress", "complete", "blocked", "deferred"}


def bad(msg):
    abort(400, description=msg)


def json_body() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        bad("Request body must be a JSON object")
    return data


def parse_date(value, field):
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        bad(f"'{field}' must be an ISO date (YYYY-MM-DD)")
    try:
        return date.fromisoformat(value)
    except ValueError:
        bad(f"'{field}' must be an ISO date (YYYY-MM-DD)")


def require_str(data, field, max_len=None):
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        bad(f"'{field}' is required and must be a non-empty string")
    value = value.strip()
    if max_len and len(value) > max_len:
        bad(f"'{field}' must be at most {max_len} characters")
    return value


def opt_str(data, field, max_len=None):
    value = data.get(field)
    if value is None:
        return None
    if not isinstance(value, str):
        bad(f"'{field}' must be a string")
    if max_len and len(value) > max_len:
        bad(f"'{field}' must be at most {max_len} characters")
    return value


def as_int(value, field, lo=None, hi=None, allow_none=False):
    if value is None and allow_none:
        return None
    # bool is an int subclass; a float like 10.0 is fine, 10.5 is not
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not math.isfinite(value) or value != int(value)):
        bad(f"'{field}' must be a whole number")
    value = int(value)
    if (lo is not None and value < lo) or (hi is not None and value > hi):
        bad(f"'{field}' must be between {lo} and {hi}")
    return value


def as_float(value, field, allow_none=True):
    if value is None and allow_none:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        bad(f"'{field}' must be a number")
    if value < 0:
        bad(f"'{field}' must not be negative")
    return float(value)


def as_bool(value, field):
    if not isinstance(value, bool):
        bad(f"'{field}' must be true or false")
    return value


def as_id_list(value, field):
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        bad(f"'{field}' must be a list of task ids")
    return value


def content_disposition(filename: str, disposition: str = "attachment") -> str:
    """RFC 6266 / 5987 header: an ASCII fallback plus the UTF-8 name. Never lets a
    quote, backslash or newline from user data into the header."""
    fallback = "".join(c if 32 <= ord(c) < 127 and c not in '"\\' else "_" for c in filename) or "download"
    return f"{disposition}; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename, safe='')}"
