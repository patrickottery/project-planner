import React, { useState, useEffect, useRef } from "react";
import { Plus, Search, X, CheckSquare, Circle, Flag, Layers, ChevronDown } from "lucide-react";
import "./TaskTreeToolbar.css";

const STATUSES = ["not_started","in_progress","complete","blocked"];
const STATUS_LABELS = { not_started:"Not Started", in_progress:"In Progress", complete:"Complete", blocked:"Blocked" };

const ADD_TYPES = [
  { type: "task",      label: "Task",      Icon: Circle, colour: "#8892a4" },
  { type: "phase",     label: "Phase",     Icon: Layers, colour: "#8b5cf6" },
  { type: "milestone", label: "Milestone", Icon: Flag,   colour: "#f59e0b" },
];

export default function TaskTreeToolbar({ onAdd, filter, setFilter, assignees, multiSelectActive, onToggleMultiSelect }) {
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef(null);

  useEffect(() => {
    if (!addOpen) return;
    const onDown = (e) => { if (!addRef.current?.contains(e.target)) setAddOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [addOpen]);

  return (
    <div className="tree-toolbar">
      <div className="add-btn-group" ref={addRef}>
        <button className="btn-primary add-main" onClick={() => onAdd(null, "task")}>
          <Plus size={14} /> Add
        </button>
        <button className="btn-primary add-chevron" onClick={() => setAddOpen(v => !v)} title="Choose type">
          <ChevronDown size={12} />
        </button>
        {addOpen && (
          <div className="add-dropdown">
            {ADD_TYPES.map(({ type, label, Icon, colour }) => (
              <button key={type} className="add-dropdown-item" onClick={() => { onAdd(null, type); setAddOpen(false); }}>
                <Icon size={13} style={{ color: colour }} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar-search">
        <Search size={13} />
        <input
          placeholder="Search…"
          value={filter.keyword}
          onChange={(e) => setFilter((f) => ({ ...f, keyword: e.target.value }))}
        />
        {filter.keyword && (
          <button className="btn-icon" onClick={() => setFilter((f) => ({ ...f, keyword: "" }))}><X size={12} /></button>
        )}
      </div>

      <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
        <option value="">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>

      {assignees.length > 0 && (
        <select value={filter.assignee} onChange={(e) => setFilter((f) => ({ ...f, assignee: e.target.value }))}>
          <option value="">All assignees</option>
          {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      )}

      <div className="toolbar-date-range">
        <input type="date" value={filter.dateFrom} title="Date from"
          onChange={(e) => setFilter((f) => ({ ...f, dateFrom: e.target.value }))} />
        <span className="date-sep">–</span>
        <input type="date" value={filter.dateTo} title="Date to"
          onChange={(e) => setFilter((f) => ({ ...f, dateTo: e.target.value }))} />
        {(filter.dateFrom || filter.dateTo) && (
          <button className="btn-icon" onClick={() => setFilter((f) => ({ ...f, dateFrom: "", dateTo: "" }))}><X size={12} /></button>
        )}
      </div>

      <button
        className={`btn-ghost multi-select-btn ${multiSelectActive ? "active" : ""}`}
        title="Multi-select"
        onClick={onToggleMultiSelect}
      >
        <CheckSquare size={14} />
      </button>
    </div>
  );
}
