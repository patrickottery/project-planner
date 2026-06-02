import React, { useEffect, useRef, useState } from "react";
import { Plus, ArrowLeft, ArrowRight, Edit3, Circle, Flag, Layers, Copy, GitBranch } from "lucide-react";
import "./ContextMenu.css";

export default function ContextMenu({
  x, y, task,
  onClose, onAddSubtask, onPromote, onDemote, onChangeType, onDuplicate, onEdit,
}) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Clamp to viewport after first paint so we know the menu dimensions
  useEffect(() => {
    if (!ref.current) return;
    const { offsetWidth: w, offsetHeight: h } = ref.current;
    setPos({
      left: x + w > window.innerWidth  ? window.innerWidth  - w - 8 : x,
      top:  y + h > window.innerHeight ? window.innerHeight - h - 8 : y,
    });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const onKey  = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown",   onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown",   onKey);
    };
  }, [onClose]);

  return (
    <div className="ctx-menu" style={{ left: pos.left, top: pos.top }} ref={ref}>
      <button className="ctx-item" onClick={() => { onAddSubtask(task.id); onClose(); }}>
        <Plus size={13} /> Add Subtask
      </button>

      <div className="ctx-sep" />

      <button
        className="ctx-item"
        disabled={!task.parent_id}
        onClick={() => { onPromote(task.id); onClose(); }}
      >
        <ArrowLeft size={13} /> Promote
      </button>
      <button className="ctx-item" onClick={() => { onDemote(task.id); onClose(); }}>
        <ArrowRight size={13} /> Demote
      </button>

      <div className="ctx-sep" />

      <span className="ctx-label">Change type</span>
      <button
        className={`ctx-item ${task.task_type === "task" ? "ctx-item--checked" : ""}`}
        onClick={() => { onChangeType(task.id, "task"); onClose(); }}
      >
        <Circle size={13} style={{ color: "#8892a4" }} /> Task
      </button>
      <button
        className={`ctx-item ${task.task_type === "milestone" ? "ctx-item--checked" : ""}`}
        onClick={() => { onChangeType(task.id, "milestone"); onClose(); }}
      >
        <Flag size={13} style={{ color: "#f59e0b" }} /> Milestone
      </button>
      <button
        className={`ctx-item ${task.task_type === "phase" ? "ctx-item--checked" : ""}`}
        onClick={() => { onChangeType(task.id, "phase"); onClose(); }}
      >
        <Layers size={13} style={{ color: "#8b5cf6" }} /> Phase
      </button>

      <div className="ctx-sep" />

      <button className="ctx-item" onClick={() => { onDuplicate(task.id, false); onClose(); }}>
        <Copy size={13} /> Duplicate task
      </button>
      {task.children?.length > 0 && (
        <button className="ctx-item" onClick={() => { onDuplicate(task.id, true); onClose(); }}>
          <GitBranch size={13} /> Duplicate with subtasks
        </button>
      )}

      <div className="ctx-sep" />

      <button className="ctx-item" onClick={() => { onEdit(task); onClose(); }}>
        <Edit3 size={13} /> Edit…
      </button>
    </div>
  );
}
