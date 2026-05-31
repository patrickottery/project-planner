import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useStore } from "../../store/useStore";
import { api } from "../../api";
import { X } from "lucide-react";
import NotesTab from "./NotesTab";
import AttachmentsTab from "./AttachmentsTab";
import "./TaskDetailPanel.css";

const TASK_TYPES = ["task","milestone","phase"];
const STATUSES = ["not_started","in_progress","complete","blocked","deferred"];

export default function TaskDetailPanel() {
  const { activeTaskId, setActiveTask, fetchTasks, activeProjectId } = useStore();
  const [task, setTask] = useState(null);
  const [tab, setTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

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
    setSaving(true);
    try {
      const updated = await api.updateTask(activeTaskId, patch);
      setTask(updated);
      await fetchTasks(activeProjectId);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
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
        <span className="detail-title">Task Details</span>
        <button className="btn-icon" onClick={() => setActiveTask(null)}><X size={16} /></button>
      </div>

      <div className="detail-tabs">
        {["details","notes","attachments"].map((t) => (
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

            <label>Type</label>
            <select value={form.task_type} onChange={(e) => { handleChange("task_type", e.target.value); save({ task_type: e.target.value }); }}>
              {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <label>Status</label>
            <select value={form.status} onChange={(e) => { handleChange("status", e.target.value); save({ status: e.target.value }); }}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
            </select>

            <label>Assignee</label>
            <input
              value={form.assignee}
              onChange={(e) => handleChange("assignee", e.target.value)}
              onBlur={() => handleBlur("assignee")}
            />

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

            <label>
              <input type="checkbox" checked={form.progress_manual} onChange={(e) => { handleChange("progress_manual", e.target.checked); save({ progress_manual: e.target.checked }); }} />
              {" "}Manual progress override
            </label>

            <label>Description (Markdown)</label>
            <textarea
              rows={6}
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              onBlur={() => handleBlur("description")}
              placeholder="Add notes, context, or details…"
            />

            <label>Bar Colour</label>
            <div className="colour-input-row">
              <input
                type="color"
                value={form.colour || "#6366f1"}
                onChange={(e) => { handleChange("colour", e.target.value); save({ colour: e.target.value }); }}
              />
              <button className="btn-ghost" onClick={() => { handleChange("colour", ""); save({ colour: null }); }}>Reset</button>
            </div>
          </div>
        )}
        {tab === "notes" && <NotesTab taskId={activeTaskId} onUpdate={() => api.getTask(activeTaskId).then(setTask)} />}
        {tab === "attachments" && <AttachmentsTab taskId={activeTaskId} onUpdate={() => api.getTask(activeTaskId).then(setTask)} />}
      </div>
    </div>
  );
}
