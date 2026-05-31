import React from "react";
import { Plus, Search, X } from "lucide-react";
import "./TaskTreeToolbar.css";

const STATUSES = ["not_started","in_progress","complete","blocked","deferred"];

export default function TaskTreeToolbar({ onAdd, filter, setFilter, assignees }) {
  return (
    <div className="tree-toolbar">
      <button className="btn-primary" onClick={onAdd}>
        <Plus size={14} /> Add Task
      </button>

      <div className="toolbar-search">
        <Search size={13} />
        <input
          placeholder="Search tasks…"
          value={filter.keyword}
          onChange={(e) => setFilter((f) => ({ ...f, keyword: e.target.value }))}
        />
        {filter.keyword && (
          <button className="btn-icon" onClick={() => setFilter((f) => ({ ...f, keyword: "" }))}><X size={12} /></button>
        )}
      </div>

      <select
        value={filter.status}
        onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace("_", " ")}</option>
        ))}
      </select>

      {assignees.length > 0 && (
        <select
          value={filter.assignee}
          onChange={(e) => setFilter((f) => ({ ...f, assignee: e.target.value }))}
        >
          <option value="">All assignees</option>
          {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      )}
    </div>
  );
}
