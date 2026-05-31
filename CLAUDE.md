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

- **Tech stack:** Python 3.12 / Flask + SQLAlchemy (SQLite) backend; React + Vite SPA frontend served as static files by Flask from `app/static/dist/`.
- **Data volume:** SQLite DB (`app.db`) and file uploads both live under `/data` inside the container → maps to `${APPDATA_PATH}` bind mount. Back up the whole `/data` dir to back up everything.
- **Build context deviation:** Dockerfile is at the project root (`./`), not `./app` — because `app/` is the Python package. Use `build: context: .` in docker-compose.yml (not the standard `./app`).
- **Gantt library:** `react-gantt-task` (MIT) — handles task bars, milestone diamonds, phase summary bars, drag-to-resize.
- **Health endpoint:** `GET /health` → `{"status": "ok"}` — used by Docker healthcheck.
- **Requirements doc:** `~/code/project-planner/requirements.md`
