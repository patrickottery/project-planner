import React, { useState } from "react";
import { X } from "lucide-react";
import "./BulkActionBar.css";

const STATUSES = ["not_started","in_progress","complete","blocked","deferred"];

export default function BulkActionBar({ count, onSetStatus, onSetAssignee, onClear }) {
  const [assigneeInput, setAssigneeInput] = useState("");

  return (
    <div className="bulk-bar">
      <span className="bulk-count">{count} selected</span>
      <select defaultValue="" onChange={(e) => { if (e.target.value) onSetStatus(e.target.value); e.target.value = ""; }}>
        <option value="" disabled>Set status…</option>
        {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
      </select>
      <input
        placeholder="Set assignee…"
        value={assigneeInput}
        onChange={(e) => setAssigneeInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && assigneeInput.trim()) {
            onSetAssignee(assigneeInput.trim());
            setAssigneeInput("");
          }
        }}
        style={{ width: 120 }}
      />
      <button className="btn-ghost" onClick={onClear}>
        <X size={12} /> Clear
      </button>
    </div>
  );
}
