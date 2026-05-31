import React, { useState } from "react";
import toast from "react-hot-toast";
import { useStore } from "../../store/useStore";
import { api } from "../../api";
import { assigneeColor, assigneeInitials } from "../../utils/assigneeColors";
import {
  ChevronRight, ChevronDown, Plus, Trash2, ArrowRight, ArrowLeft,
  Flag, Layers, Circle, Paperclip, FileText, GripVertical
} from "lucide-react";
import "./TaskRow.css";

const STATUS_COLOURS = {
  not_started: "#8892a4",
  in_progress: "#6366f1",
  complete: "#22c55e",
  blocked: "#ef4444",
  deferred: "#f59e0b",
};
const STATUS_LABELS = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
  blocked: "Blocked",
  deferred: "Deferred",
};

function TypeIcon({ type }) {
  if (type === "milestone") return <Flag size={13} style={{ color: "#f59e0b" }} />;
  if (type === "phase") return <Layers size={13} style={{ color: "#8b5cf6" }} />;
  return <Circle size={13} style={{ color: "#8892a4" }} />;
}

function AssigneeAvatar({ name }) {
  if (!name) return <span className="assignee-avatar empty" />;
  return (
    <span className="assignee-avatar" style={{ background: assigneeColor(name) }} title={name}>
      {assigneeInitials(name)}
    </span>
  );
}

export default function TaskRow({
  task, onAdd, onDelete, isActive, onClick,
  multiSelectActive, isSelected, onToggleSelect,
  dragState, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}) {
  const { collapsed, toggleCollapsed, fetchTasks, activeProjectId } = useStore();
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);

  const hasChildren = task.children?.length > 0;
  const isCollapsed = collapsed[task.id];
  const isDragging = dragState.draggedId === task.id;
  const dropIndicator = dragState.overId === task.id ? dragState.overPos : null;

  function startEdit(field, value) {
    setEditingField(field);
    setEditValue(value ?? "");
  }

  async function commitEdit(field, value) {
    setEditingField(null);
    let v = value;
    if (field === "progress_pct") v = Math.min(100, Math.max(0, parseInt(value) || 0));
    try {
      await api.updateTask(task.id, { [field]: v });
      await fetchTasks(activeProjectId);
    } catch { toast.error("Failed to update"); }
  }

  async function handlePromote(e) {
    e.stopPropagation();
    try { await api.promoteTask(task.id); await fetchTasks(activeProjectId); }
    catch (err) { toast.error(err.message || "Cannot promote"); }
  }

  async function handleDemote(e) {
    e.stopPropagation();
    try { await api.demoteTask(task.id); await fetchTasks(activeProjectId); }
    catch (err) { toast.error(err.message || "Cannot demote"); }
  }

  function InlineEdit({ field, value, type = "text", options, style, placeholder }) {
    if (editingField === field) {
      if (options) {
        return (
          <select autoFocus value={editValue} style={style}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => commitEdit(field, editValue)}
            onClick={(e) => e.stopPropagation()}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      return (
        <input autoFocus type={type} value={editValue} style={style}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => commitEdit(field, editValue)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.stopPropagation(); commitEdit(field, editValue); }
            if (e.key === "Escape") { e.stopPropagation(); setEditingField(null); }
          }}
          onClick={(e) => e.stopPropagation()} />
      );
    }
    return (
      <span className="editable" style={style}
        onClick={(e) => { e.stopPropagation(); startEdit(field, value); }} title="Click to edit">
        {value || <span className="placeholder">{placeholder || "—"}</span>}
      </span>
    );
  }

  return (
    <div
      className={[
        "task-row",
        isActive ? "active" : "",
        task.status === "complete" ? "complete" : "",
        isDragging ? "dragging" : "",
        dropIndicator === "before" ? "drop-before" : "",
        dropIndicator === "after" ? "drop-after" : "",
      ].filter(Boolean).join(" ")}
      style={{ "--depth": task._depth }}
      onClick={onClick}
      draggable
      onDragStart={(e) => { e.stopPropagation(); onDragStart(task.id); }}
      onDragOver={(e) => {
        e.preventDefault(); e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        onDragOver(task.id, e.clientY < rect.top + rect.height / 2 ? "before" : "after");
      }}
      onDragLeave={(e) => { e.stopPropagation(); onDragLeave(); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDrop(task.id); }}
      onDragEnd={(e) => { e.stopPropagation(); onDragEnd(); }}
    >
      {multiSelectActive && (
        <input type="checkbox" className="row-checkbox" checked={isSelected}
          onChange={() => onToggleSelect(task.id)}
          onClick={(e) => e.stopPropagation()} />
      )}

      <span className="drag-handle" title="Drag to reorder"><GripVertical size={12} /></span>

      <div className="row-indent" style={{ width: task._depth * 20 }} />

      <button className="btn-icon collapse-btn"
        onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleCollapsed(task.id); }}
        style={{ visibility: hasChildren ? "visible" : "hidden" }}>
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>

      <TypeIcon type={task.task_type} />

      <div className="row-title">
        <InlineEdit field="title" value={task.title} style={{ minWidth: 120, flex: 1 }} />
      </div>

      <div className="row-fields">
        <AssigneeAvatar name={task.assignee} />
        <InlineEdit field="assignee" value={task.assignee} style={{ width: 76 }} placeholder="Assign" />
        <InlineEdit field="start_date" value={task.start_date} type="date" style={{ width: 108 }} />
        <InlineEdit field="end_date" value={task.end_date} type="date" style={{ width: 108 }} />
        <InlineEdit field="effort_hours" value={task.effort_hours} type="number" style={{ width: 48 }} />
        <InlineEdit field="status" value={task.status}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          style={{ width: 108, color: STATUS_COLOURS[task.status] }} />
        <div className="progress-cell">
          <div className="progress-mini-bg">
            <div className="progress-mini-fill" style={{
              width: `${task.progress_pct || 0}%`,
              background: task.status === "complete" ? "var(--success)" : "var(--accent)",
            }} />
          </div>
          <InlineEdit field="progress_pct" value={task.progress_pct ?? 0} type="number" style={{ width: 34 }} />
          <span className="progress-pct-label">%</span>
        </div>
        {task.note_count > 0 && (
          <span className="badge" title={`${task.note_count} notes`}><FileText size={11} />{task.note_count}</span>
        )}
        {task.attachment_count > 0 && (
          <span className="badge" title={`${task.attachment_count} attachments`}><Paperclip size={11} />{task.attachment_count}</span>
        )}
      </div>

      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
        <button className="btn-icon" title="Add child" onClick={() => onAdd(task.id)}><Plus size={13} /></button>
        <button className="btn-icon" title="Promote (Shift+Tab)" onClick={handlePromote}><ArrowLeft size={13} /></button>
        <button className="btn-icon" title="Demote (Tab)" onClick={handleDemote}><ArrowRight size={13} /></button>
        <button className="btn-icon danger" title="Delete" onClick={() => setShowDeleteMenu(true)}><Trash2 size={13} /></button>
      </div>

      {showDeleteMenu && (
        <div className="delete-menu" onClick={(e) => e.stopPropagation()}>
          <p>Delete children too?</p>
          <div className="delete-menu-actions">
            <button className="btn-danger" onClick={() => { setShowDeleteMenu(false); onDelete(task.id, true); }}>Delete all</button>
            <button className="btn-ghost" onClick={() => { setShowDeleteMenu(false); onDelete(task.id, false); }}>Keep children</button>
            <button className="btn-ghost" onClick={() => setShowDeleteMenu(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
