# CLAUDE.md — project-planner
# Homelab-wide conventions are in ~/.claude/CLAUDE.md (auto-loaded).

---

## This App

- **Name:** project-planner
- **Description:** Self-hosted single-user project planner — lightweight MS Project replacement with WBS tree, Gantt chart, milestone tracking, notes, and file attachments.
- **Prod port:** 3002
- **Dev port:** 4002
- **Internal port:** 5000 (Flask)
- **Cloudflare subdomain:** project-planner.patrickottery.net

---

## NAS Volumes Used

None.

---

## App-Specific Notes

- **Tech stack:** Python 3.13 / Flask + SQLAlchemy (SQLite) backend; React + Vite SPA frontend served as static files by Flask from `app/static/dist/`.
- **Data volume:** SQLite DB (`app.db`) and file uploads both live under `/data` inside the container → maps to `${APPDATA_PATH}` bind mount. Back up the whole `/data` dir to back up everything.
- **Build context deviation:** Dockerfile is at the project root (`./`), not `./app` — because `app/` is the Python package. Use `build: context: .` in docker-compose.yml (not the standard `./app`).
- **Gantt library:** `react-gantt-task` (MIT) — handles task bars, milestone diamonds, phase summary bars, drag-to-resize.
- **Health endpoint:** `GET /health` → `{"status": "ok"}` — used by Docker healthcheck.
- **Requirements doc:** `~/code/project-planner/requirements.md`

---

## Auth & security (`app/auth.py`)

- Every route except `/health` verifies the Cloudflare Access JWT (`Cf-Access-Jwt-Assertion`,
  RS256 via the team JWKS, `aud`/`iss`/`exp` required) and checks `email` against
  `OWNER_EMAIL` (comma-separated). Ported from therapy-explorer.
- `CF_ACCESS_AUD` set → JWT mode (startup fails if team domain / owner blank). Dev bypass only
  when AUD blank **and** `DEV_AUTH_EMAIL` set **and** `APP_ENV=dev`; anything else fails
  closed (403). JWKS unreachable → 503.
- Unsafe methods are refused cross-site (`Sec-Fetch-Site`, else `Origin` vs `Host`).
- Attachments: MIME decided server-side from the extension. `/preview` inlines only raster
  images and PDF; everything else (incl. SVG/HTML) is `Content-Disposition: attachment`;
  previews send `nosniff` + `CSP: sandbox`.
- No `SECRET_KEY`: no sessions/cookies are used. Werkzeug debugger only with `FLASK_DEBUG=1`.
- `APP_ENV` ≠ prod → orange banner, `DEV · ` title, `favicon-dev.svg` (via `/api/v1/me`).

## Data rules

- SQLite `PRAGMA foreign_keys=ON` on every connection.
- Deleting a task (cascade) or project removes its upload folders after commit; projects
  cascade to risks/issues.
- `move`/create refuse a parent in another project or inside the task's own subtree.
- Task delete is confirmed in the row's delete menu and is **not** undoable (undo covers
  indent/outdent moves only).
- JSON export (format 2) includes tasks (all levels), notes, risks/issues and attachment
  *metadata only* — the files are not in the export. Import maps old→new ids in
  parent-first order and remaps dependencies.

## Testing

`python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/python -m pytest -q tests`
(temporary SQLite per test, local RSA key for JWT tests, no network).

## Gotchas

- Dev compose override: copy `docker-compose.override.yml.example` (drops proxy-network).
- Backups: `~/scripts/homelab-backup-tiered.sh` lists only `project-planner-dev` in
  CRITICAL_APPDATA and copies the live SQLite with rsync — needs `.backup` before prod.
