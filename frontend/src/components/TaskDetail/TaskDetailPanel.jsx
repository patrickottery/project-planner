import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useStore } from "../../store/useStore";
import { api } from "../../api";
import { X, Plus, ChevronRight } from "lucide-react";
import NotesTab from "./NotesTab";
import AttachmentsTab from "./AttachmentsTab";
import "./TaskDetailPanel.css";

const TASK_TYPES = ["task", "milestone", "phase"];
const STATUSES = ["not_started", "in_progress", "complete", "blocked", "deferred"];

function flattenTaskMap(nodes, map = {}) {
  for (const n of nodes) {
    map[n.id] = n;
    if (n.children) flattenTaskMap(n.children, map);
  }
  return map;
}

function buildBreadcrumb(taskId, taskMap) {
  const crumbs = [];
  let cur = taskMap[taskId];
  while (cur) {
    crumbs.unshift({ id: cur.id, title: cur.title });
    cur = cur.parent_id ? taskMap[cur.parent_id] : null;
  }
  return crumbs;
}

export default function TaskDetailPanel() {
  const { activeTaskId, setActiveTask, fetchTasks, activeProjectId, tasks } = useStore();
  const [task, setTask] = useState(null);
  const [tab, setTab] = useState("details");
  const [form, setForm] = useState({});

  const taskMap = flattenTaskMap(tasks);
  const breadcrumb = activeTaskId ? buildBreadcrumb(activeTaskId, taskMap) : [];

  useEffect(() => {
    if (!activeTaskId) { setTask(null); return; }
    api.getTask(activeTaskId).then((t) => {
      setTask(t);
      setForm({
        title: t.title,
        description: t.description || "",
        assignee: t.assignee || "",
        task_type: t.task_type,
        status: t.status,
        start_date: t.start_date || "",
        end_date: t.end_date || "",
        effort_hours: t.effort_hours ?? "",
        progress_pct: t.progress_pct ?? 0,
        progress_manual: t.progress_manual ?? false,
        colour: t.colour || "",
      });
    });
  }, [activeTaskId]);

  if (!activeTaskId || !task) return null;

  async function save(patch) {
    try {
      const updated = await api.updateTask(activeTaskId, patch);
      setTask(updated);
      await fetchTasks(activeProjectId);
    } catch {
      toast.error("Failed to save");
    }
  }

  async function handleAddChild() {
    try {
      const child = await api.createTask(activeProjectId, { parent_id: activeTaskId });
      await fetchTasks(activeProjectId);
      setActiveTask(child.id);
    } catch {
      toast.error("Failed to add child task");
    }
  }

  function handleChange(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleBlur(field) {
    save({ [field]: form[field] });
  }

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <div className="detail-breadcrumb">
          {breadcrumb.map((crumb, i) => (
            <React.Fragment key={crumb.id}>
              {i > 0 && <ChevronRight size={11} className="crumb-sep" />}
              <span
                className={`crumb ${crumb.id === activeTaskId ? "crumb-current" : "crumb-link"}`}
                onClick={() => crumb.id !== activeTaskId && setActiveTask(crumb.id)}
              >
                {crumb.title}
              </span>
            </React.Fragment>
          ))}
        </div>
        <div className="detail-header-actions">
          <button className="btn-icon" title="Add child task" onClick={handleAddChild}>
            <Plus size={14} />
          </button>
          <button className="btn-icon" onClick={() => setActiveTask(null)} title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="detail-tabs">
        {["details", "notes", "attachments"].map((t) => (
          <button
            key={t}
            className={`detail-tab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "notes" && task.note_count > 0 && <span className="tab-badge">{task.note_count}</span>}
            {t === "attachments" && task.attachment_count > 0 && <span className="tab-badge">{task.attachment_count}</span>}
          </button>
        ))}
      </div>

      <div className="detail-body">
        {tab === "details" && (
          <div className="detail-form">
            <label>Title</label>
            <input
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              onBlur={() => handleBlur("title")}
            />

            <div className="form-row">
              <div>
                <label>Type</label>
                <select value={form.task_type} onChange={(e) => { handleChange("task_type", e.target.value); save({ task_type: e.target.value }); }}>
                  {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label>Status</label>
                <select value={form.status} onChange={(e) => { handleChange("status", e.target.value); save({ status: e.target.value }); }}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
            </div>

            <label>Assignee</label>
            <input
              value={form.assignee}
              onChange={(e) => handleChange("assignee", e.target.value)}
              onBlur={() => handleBlur("assignee")}
              list="assignee-suggestions"
            />
            <datalist id="assignee-suggestions">
              {[...new Set(Object.values(taskMap).map((t) => t.assignee).filter(Boolean))].map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>

            <div className="form-row">
              <div>
                <label>Start Date</label>
                <input type="date" value={form.start_date} onChange={(e) => { handleChange("start_date", e.target.value); save({ start_date: e.target.value || null }); }} />
              </div>
              <div>
                <label>End Date</label>
                <input type="date" value={form.end_date} onChange={(e) => { handleChange("end_date", e.target.value); save({ end_date: e.target.value || null }); }} />
              </div>
            </div>

            <div className="form-row">
              <div>
                <label>Effort (hrs)</label>
                <input type="number" min="0" step="0.5" value={form.effort_hours} onChange={(e) => handleChange("effort_hours", e.target.value)} onBlur={() => handleBlur("effort_hours")} />
              </div>
              <div>
                <label>Progress %</label>
                <input type="number" min="0" max="100" value={form.progress_pct} onChange={(e) => handleChange("progress_pct", e.target.value)} onBlur={() => handleBlur("progress_pct")} />
              </div>
            </div>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.progress_manual}
                onChange={(e) => { handleChange("progress_manual", e.target.checked); save({ progress_manual: e.target.checked }); }}
              />
              Manual progress (don't auto-roll up from children)
            </label>

            <label>Description (Markdown)</label>
            <textarea
              rows={6}
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={() => handleBlur("description")}
              placeholder="Add context, acceptance criteria, links…"
            />

            <label>Bar Colour</label>
            <div className="colour-input-row">
              <input
                type="color"
                value={form.colour || "#6366f1"}
                onChange={(e) => { handleChange("colour", e.target.value); save({ colour: e.target.value }); }}
              />
              {form.colour && (
                <button className="btn-ghost" onClick={() => { handleChange("colour", ""); save({ colour: null }); }}>
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
        {tab === "notes" && (
          <NotesTab taskId={activeTaskId} onUpdate={() => api.getTask(activeTaskId).then(setTask)} />
        )}
        {tab === "attachments" && (
          <AttachmentsTab taskId={activeTaskId} onUpdate={() => api.getTask(activeTaskId).then(setTask)} />
        )}
      </div>
    </div>
  );
}
