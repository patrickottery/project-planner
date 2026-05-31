# Self-Hosted Project Planner — Requirements Document

## Overview

Build a self-hosted, single-user web application for project and task planning. The app should feel like a lightweight MS Project replacement: hierarchical work breakdown structure (WBS), Gantt chart visualisation, milestone tracking, and assignee visibility — all stored locally with no external dependencies beyond the runtime.

The target user is a solo IT/PM practitioner managing multiple concurrent projects across clients and personal work.

---

## Tech Stack

- **Backend**: Python (Flask) with SQLite via SQLAlchemy. Single `app.db` file, easy to back up.
- **Frontend**: React + Vite SPA. Build output served as static files by Flask from `app/static/dist/`. Vite dev server proxies API calls during development.
- **Gantt library**: `react-gantt-task` (MIT). Handles task bars, milestone diamonds, phase summary bars, drag-to-resize dates, and progress fill out of the box.
- **Packaging**: Docker-friendly. Provide a `Dockerfile` (multi-stage: Node build → Python runtime) and `docker-compose.yml`. App binds to a configurable port (default `5000`).
- **Data persistence**: SQLite only. No external databases. DB file at a configurable path (env var `DATA_PATH`, default `/data/app.db`).
- **File storage**: Uploaded task attachments stored on disk at `UPLOADS_PATH` (default `/data/uploads/`), organised as `{uploads_root}/{task_id}/{filename}`. Never stored in SQLite.
- **No authentication required** — single-user tool on a trusted local/private network.

---

## Data Model

### Project
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | string | Required |
| description | text | Optional |
| colour | string | Hex colour for UI differentiation |
| created_at | datetime | Auto |
| updated_at | datetime | Auto |

### Task
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| project_id | UUID | FK → Project |
| parent_id | UUID | FK → Task (self-referential, nullable = root task) |
| position | integer | Sort order among siblings |
| title | string | Required |
| description | text | Optional markdown body |
| assignee | string | Free-text name (no user table needed) |
| task_type | enum | `task` \| `milestone` \| `phase` |
| status | enum | `not_started` \| `in_progress` \| `complete` \| `blocked` \| `deferred` |
| start_date | date | Optional |
| end_date | date | Optional |
| effort_hours | float | Estimated effort in hours, optional |
| progress_pct | integer | 0–100, manual override |
| progress_manual | boolean | If true, progress_pct is not auto-calculated from children |
| colour | string | Optional override colour for Gantt bar |
| dependencies | JSON | Array of task UUIDs (hook for future dependency arrows) |
| created_at | datetime | Auto |
| updated_at | datetime | Auto |

### Note
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| task_id | UUID | FK → Task |
| body | text | Markdown content |
| created_at | datetime | Auto |
| updated_at | datetime | Auto |

Notes are append-style entries on a task — like a log or journal. Multiple notes per task, displayed in reverse-chronological order.

### Attachment
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| task_id | UUID | FK → Task |
| filename | string | Original filename as uploaded |
| stored_name | string | UUID-based filename on disk (prevents collisions) |
| mime_type | string | Detected on upload |
| size_bytes | integer | File size |
| created_at | datetime | Auto |

**Hierarchy rules:**
- Tasks may be nested to any depth (no hard limit at DB level; UI handles at least 10 levels gracefully).
- Milestones have no duration (start_date = end_date), displayed as a diamond on the Gantt.
- Phases/chunks visually group their children and show a rollup progress bar.
- Progress rollup: parent `progress_pct` auto-calculates from children (effort-weighted average) unless `progress_manual = true`.

---

## Core Features

### 1. Project Management

- Create, edit, delete projects.
- Project list/dashboard showing name, task count, overall progress, date range.
- Colour-code projects for quick visual identification.

### 2. Task Tree (WBS View)

Primary editing interface.

- **Indented tree list** showing full task hierarchy.
- Each row shows: indent level indicator, task type icon, title, assignee, start date, end date, effort, status, progress %, attachment count badge, note count badge.
- **Inline editing**: click any field to edit in place (title, assignee, dates, effort, status, progress).
- **Add task**: button to add sibling or child task. New task inserts below current selection.
- **Delete task**: with confirmation. Offer choice: cascade-delete children, or re-parent children to deleted task's parent.
- **Promote / Demote** (indent left / indent right):
  - Demote: makes a task a child of the previous sibling.
  - Promote: moves a task up one level (child → sibling of its parent).
  - Keyboard shortcuts: `Tab` to demote, `Shift+Tab` to promote (MS Project convention).
- **Drag-and-drop reorder** within the tree (same-level reorder; cross-level moves via promote/demote).
- **Collapse/expand** subtrees. Remember collapse state per session (localStorage).
- **Multi-select** for bulk status/assignee updates.
- **Filter/search**: filter by assignee, status, date range, or keyword.

### 3. Task Detail Panel

Slide-out right panel (not a modal — keeps tree visible) for full task editing:
- All fields from the Task data model.
- Markdown description editor with live preview toggle.
- Full ancestry breadcrumb (e.g. `Project > Phase > Sub-phase > Task`).
- Quick-add child task button.
- **Notes tab** (see Section 7).
- **Attachments tab** (see Section 8).

### 4. Assignees

- Free-text assignee field on each task. No user table.
- Project-scoped autocomplete from previously used names (derived from existing tasks).
- Assignee filter in all views.
- Assignee colour coding: auto-assigned per unique name, consistent within a project session.

### 5. Gantt / Timeline View

Uses `react-gantt-task`. Custom adapter maps internal Task objects to the library's format.

- **Time scale controls**: Day / Week / Month / Quarter toggle.
- **Zoom**: + / - on time axis.
- **Pan**: drag to scroll horizontally.
- **Bars**: coloured by task type or assignee (toggle).
  - Task bars: start → end date.
  - Milestone diamonds at milestone date.
  - Phase bars: summary bar spanning earliest child start → latest child end.
- **Progress fill**: bar fill % reflects `progress_pct`.
- **Today line**: vertical accent-coloured line at today's date.
- **Clicking a bar**: opens Task Detail panel.
- **Inline date drag**: drag bar edges to adjust start/end date (writes back via API).
- Left panel: task names only (synced with Gantt rows, collapsed view) — standard two-pane MS Project layout.

### 6. Milestone & Phase Tracking

- **Milestones**: diamond markers on Gantt; distinct row type in tree; milestone list view in sidebar (filtered to `task_type = milestone`).
- **Phases**: summary bar on Gantt; progress rolls up from children.
- **Progress rollup**: auto unless `progress_manual = true`.

### 7. Notes

Notes are a chronological log attached to a task — useful for meeting notes, decisions, status updates.

- Displayed in the **Notes tab** of the Task Detail panel.
- Each note has: body (markdown, rendered), timestamp, edit and delete actions.
- **Add note**: textarea at the top of the Notes tab. Submit with Ctrl+Enter or a Save button.
- **Edit note**: inline edit on click.
- **Delete note**: with confirmation.
- Notes are included in JSON export/import.
- Note count shown as a badge on the task row in the tree view.

### 8. Attachments

- Displayed in the **Attachments tab** of the Task Detail panel.
- **Upload**: drag-and-drop zone or file picker. Multiple files in one operation. **Maximum 10MB per file**, enforced in Flask (`MAX_CONTENT_LENGTH = 10 * 1024 * 1024`). Return a clear 413 error with a user-facing toast if the limit is exceeded. Store files at `{UPLOADS_PATH}/{task_id}/{uuid}_{original_filename}`.
- **List**: show filename, size, upload date, mime type icon.
- **Download**: click filename to download the original file.
- **Preview** (best-effort):
  - Images (jpeg, png, gif, webp): show inline thumbnail, click to open full-size in a lightbox.
  - PDF: open in browser tab (served via Flask with correct Content-Type).
  - Text/markdown/code: render in a modal with syntax highlighting.
  - All other types: download only.
- **Delete**: removes the file from disk and the Attachment record from DB. Confirmation required.
- Attachment count shown as a badge on the task row in the tree view.
- Attachments are **not** included in JSON export by default (files are large). Export should include a manifest of attachment metadata. Re-attachment after import is a manual step.

### 9. Summary / Dashboard View

Per-project summary showing:
- Overall progress bar.
- Tasks by status (donut chart).
- Upcoming milestones (next 30 days).
- Overdue tasks (end_date < today, status ≠ complete).
- Tasks by assignee (horizontal bar chart).

### 10. Export / Import

- **Export to CSV**: full task list, flat, with `level` column indicating depth. Notes and attachments excluded.
- **Export to JSON**: full project data including tasks, notes, and attachment metadata (not file bytes).
- **Import from JSON**: restore a project from a previously exported JSON file. Generates new UUIDs to avoid collisions if importing into an existing instance.
- **Export Gantt to PNG/PDF**: use browser print API or canvas export.

---

## API Design

RESTful JSON API served by Flask. All routes prefixed `/api/v1/`.

```
# Projects
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/{id}
PUT    /api/v1/projects/{id}
DELETE /api/v1/projects/{id}

# Tasks
GET    /api/v1/projects/{id}/tasks          # full tree
POST   /api/v1/projects/{id}/tasks
GET    /api/v1/tasks/{id}
PUT    /api/v1/tasks/{id}
DELETE /api/v1/tasks/{id}
POST   /api/v1/tasks/{id}/promote
POST   /api/v1/tasks/{id}/demote
POST   /api/v1/tasks/{id}/move              # body: { parent_id, position }

# Notes
GET    /api/v1/tasks/{id}/notes
POST   /api/v1/tasks/{id}/notes
PUT    /api/v1/notes/{id}
DELETE /api/v1/notes/{id}

# Attachments
GET    /api/v1/tasks/{id}/attachments
POST   /api/v1/tasks/{id}/attachments       # multipart/form-data upload
GET    /api/v1/attachments/{id}/download    # serves file with original filename
DELETE /api/v1/attachments/{id}

# Export / Import
GET    /api/v1/projects/{id}/export/json
POST   /api/v1/projects/import/json
GET    /api/v1/projects/{id}/export/csv

# Health
GET    /health                              # returns { "status": "ok" }
```

---

## File Structure (suggested)

```
project-planner/
├── app/
│   ├── __init__.py
│   ├── models.py
│   ├── routes/
│   │   ├── projects.py
│   │   ├── tasks.py
│   │   ├── notes.py
│   │   └── attachments.py
│   └── static/
│       └── dist/                   # Vite build output (gitignored)
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── api.js
│       ├── components/
│       │   ├── TaskTree/
│       │   ├── GanttView/
│       │   ├── Dashboard/
│       │   ├── TaskDetail/
│       │   │   ├── TaskDetailPanel.jsx
│       │   │   ├── NotesTab.jsx
│       │   │   └── AttachmentsTab.jsx
│       │   └── shared/
│       └── store/                  # Zustand or React Context state
├── config.py
├── run.py
├── requirements.txt
├── Dockerfile                      # multi-stage: node build → python runtime
└── docker-compose.yml
```

---

## Docker / Deployment

```yaml
# docker-compose.yml
services:
  planner:
    build: .
    ports:
      - "5050:5000"
    volumes:
      - ./data:/data
    environment:
      - DATA_PATH=/data/app.db
      - UPLOADS_PATH=/data/uploads
      - MAX_UPLOAD_MB=10
      - SECRET_KEY=changeme
```

**Dockerfile** should be multi-stage:
1. Stage 1 (`node:20-slim`): `cd frontend && npm ci && npm run build`
2. Stage 2 (`python:3.12-slim`): copy Flask app + Vite dist output, install Python deps, expose port 5000.

Data volume at `/data` covers both the SQLite file and the uploads directory. Back up the whole `/data` directory to back up everything.

---

## UI / UX Requirements

- **Dark theme** by default. Light mode toggle optional.
- **Desktop-first**: optimised for 13"+ laptop. Minimum comfortable width ~1024px.
- **Keyboard-driven**: `Tab`/`Shift+Tab` indent, `Enter` add sibling, `Escape` cancel, arrow keys navigate rows.
- **Persistent state**: last open project, last active view, column widths — localStorage.
- **Autosave**: debounced API call on field change. No save button.
- **Undo**: `Ctrl+Z` for last structural change (delete, promote/demote, reorder). In-memory stack, cleared on page reload.
- **Toast notifications**: save confirmation, errors, destructive action feedback.

---

## Out of Scope (for now)

- Multi-user authentication / permissions.
- Email / push notifications.
- Activity log / audit trail.
- Resource levelling / scheduling engine.
- Integration with external tools (Jira, GitHub, etc.).
- Mobile-optimised UI.
- Real-time collaboration / websockets.
- Dependency arrows on Gantt (data model hook exists via `dependencies` JSON field).

---

## Build Order / Suggested Phasing for Claude Code

1. **Phase 1 — Backend scaffold**: Flask app, SQLAlchemy models (Project, Task, Note, Attachment), all REST API routes, SQLite + uploads directory setup, Docker multi-stage config.
2. **Phase 2 — Task tree UI**: React + Vite shell, project list, WBS tree view with inline editing, promote/demote, add/delete tasks, collapse/expand.
3. **Phase 3 — Gantt view**: `react-gantt-task` integration, two-pane layout, milestone diamonds, phase bars, today line, drag-to-resize date sync.
4. **Phase 4 — Task detail panel**: Slide-out panel, markdown description, Notes tab (add/edit/delete), Attachments tab (upload/download/preview/delete).
5. **Phase 5 — Dashboard + export**: Summary charts, CSV/JSON export, JSON import.
6. **Phase 6 — Polish**: Keyboard shortcuts, undo stack, autosave, dark/light toggle, performance on 200+ task lists, attachment preview lightbox.
