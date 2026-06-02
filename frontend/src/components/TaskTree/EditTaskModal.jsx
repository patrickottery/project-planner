import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import { X, Eye, Edit3, Circle, Flag, Layers } from "lucide-react";
import { api } from "../../api";
import { useStore } from "../../store/useStore";
import "./EditTaskModal.css";

const TASK_TYPES = [
  { value: "task",      label: "Task",      Icon: Circle, colour: "#8892a4" },
  { value: "phase",     label: "Phase",     Icon: Layers, colour: "#8b5cf6" },
  { value: "milestone", label: "Milestone", Icon: Flag,   colour: "#f59e0b" },
];
const STATUSES = [
  { value: "not_started", label: "Not Started", colour: "#94a3b8" },
  { value: "in_progress", label: "In Progress", colour: "#6366f1" },
  { value: "complete",    label: "Complete",    colour: "#22c55e" },
  { value: "blocked",     label: "Blocked",     colour: "#ef4444" },
];

export default function EditTaskModal({ task, onClose }) {
  const { fetchTasks, activeProjectId, tasks } = useStore();
  const [form, setForm] = useState({
    title:           task.title,
    description:     task.description     || "",
    assignee:        task.assignee        || "",
    task_type:       task.task_type,
    status:          task.status,
    start_date:      task.start_date      || "",
    end_date:        task.end_date        || "",
    effort_hours:    task.effort_hours    ?? "",
    progress_pct:    task.progress_pct    ?? 0,
    progress_manual: task.progress_manual ?? false,
    colour:          task.colour          || "",
  });
  const [previewDesc, setPreviewDesc] = useState(false);
  const [saving, setSaving] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Collect assignee suggestions from the flat task list
  const assigneeSuggestions = [...new Set(
    tasks.flatMap(function flat(n) {
      return [n.assignee, ...(n.children || []).flatMap(flat)];
    }).filter(Boolean)
  )];

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      await api.updateTask(task.id, {
        ...form,
        start_date:   form.start_date   || null,
        end_date:     form.end_date     || null,
        effort_hours: form.effort_hours !== "" ? Number(form.effort_hours) : null,
        progress_pct: Number(form.progress_pct) || 0,
        colour:       form.colour || null,
      });
      await fetchTasks(activeProjectId);
      toast.success("Saved", { duration: 1200 });
      onClose();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-box" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Edit Task</span>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <label>Title</label>
          <input
            autoFocus
            value={form.title}
            onChange={e => set("title", e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
          />

          <div className="form-row">
            <div>
              <label>Type</label>
              <div className="type-btn-group">
                {TASK_TYPES.map(({ value, label, Icon, colour }) => (
                  <button key={value} type="button"
                    className={`type-btn ${form.task_type === value ? "active" : ""}`}
                    style={form.task_type === value ? { borderColor: colour, color: colour } : {}}
                    onClick={() => set("task_type", value)}>
                    <Icon size={13} style={{ color: colour }} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label>Status</label>
              <div className="type-btn-group">
                {STATUSES.map(({ value, label, colour }) => (
                  <button key={value} type="button"
                    className={`type-btn ${form.status === value ? "active" : ""}`}
                    style={{ borderColor: form.status === value ? colour : "transparent", color: colour }}
                    onClick={() => set("status", value)}>
                    <span className="status-dot-sm" style={{ background: colour }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label>Assignee</label>
          <input
            value={form.assignee}
            list="modal-assignee-list"
            onChange={e => set("assignee", e.target.value)}
          />
          <datalist id="modal-assignee-list">
            {assigneeSuggestions.map(a => <option key={a} value={a} />)}
          </datalist>

          <div className="form-row">
            <div>
              <label>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
            </div>
            <div>
              <label>End Date</label>
              <input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div>
              <label>Effort (hrs)</label>
              <input type="number" min="0" step="0.5" value={form.effort_hours}
                onChange={e => set("effort_hours", e.target.value)} />
            </div>
            <div>
              <label>Progress %</label>
              <input type="number" min="0" max="100" value={form.progress_pct}
                onChange={e => set("progress_pct", e.target.value)} />
            </div>
          </div>

          <label className="checkbox-label">
            <input type="checkbox" checked={form.progress_manual}
              onChange={e => set("progress_manual", e.target.checked)} />
            Manual progress (don't auto-roll up from children)
          </label>

          <div className="desc-header">
            <label>Description</label>
            <button type="button" className="btn-icon preview-toggle"
              onClick={() => setPreviewDesc(p => !p)}
              title={previewDesc ? "Edit" : "Preview"}>
              {previewDesc ? <Edit3 size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {previewDesc ? (
            <div className="markdown-preview">
              {form.description
                ? <ReactMarkdown>{form.description}</ReactMarkdown>
                : <span className="empty-text">No description.</span>}
            </div>
          ) : (
            <textarea
              rows={5}
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="Markdown supported…"
            />
          )}

          <label>Bar Colour</label>
          <div className="colour-input-row">
            <input type="color" value={form.colour || "#6366f1"}
              onChange={e => set("colour", e.target.value)} />
            {form.colour && (
              <button className="btn-ghost" onClick={() => set("colour", "")}>Reset</button>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
