import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2, X, ChevronDown, ChevronUp, AlertTriangle, Bug } from "lucide-react";
import { api } from "../../api";
import { useStore } from "../../store/useStore";
import "./RiskRegister.css";

const RISK_STATUSES = [
  { value: "open",      label: "Open",      colour: "#ef4444" },
  { value: "mitigated", label: "Mitigated", colour: "#f59e0b" },
  { value: "accepted",  label: "Accepted",  colour: "#6366f1" },
  { value: "closed",    label: "Closed",    colour: "#64748b" },
];
const ISSUE_STATUSES = [
  { value: "open",        label: "Open",        colour: "#ef4444" },
  { value: "in_progress", label: "In Progress", colour: "#6366f1" },
  { value: "resolved",    label: "Resolved",    colour: "#22c55e" },
  { value: "closed",      label: "Closed",      colour: "#64748b" },
];
const IMPACTS = [
  { value: "low",      label: "Low",      colour: "#22c55e" },
  { value: "medium",   label: "Medium",   colour: "#f59e0b" },
  { value: "high",     label: "High",     colour: "#f97316" },
  { value: "critical", label: "Critical", colour: "#ef4444" },
];
const PROBABILITIES = [
  { value: "low",    label: "Low"    },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High"   },
];

function statusColour(entry_type, status) {
  const list = entry_type === "risk" ? RISK_STATUSES : ISSUE_STATUSES;
  return list.find(s => s.value === status)?.colour ?? "#64748b";
}
function impactColour(impact) {
  return IMPACTS.find(i => i.value === impact)?.colour ?? "#94a3b8";
}

function Badge({ colour, label }) {
  return (
    <span className="rr-badge" style={{ background: colour + "22", color: colour, borderColor: colour + "55" }}>
      {label}
    </span>
  );
}

const EMPTY_FORM = (type) => ({
  entry_type: type,
  title: "",
  description: "",
  status: "open",
  impact: "medium",
  probability: "medium",
  owner: "",
  response: "",
  raised_date: "",
  due_date: "",
});

function RiskModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSave() {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const statuses = form.entry_type === "risk" ? RISK_STATUSES : ISSUE_STATUSES;
  const isRisk = form.entry_type === "risk";
  const responseLabel = isRisk ? "Mitigation Plan" : "Resolution Notes";

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-box rr-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{initial.id ? `Edit ${isRisk ? "Risk" : "Issue"}` : `New ${isRisk ? "Risk" : "Issue"}`}</span>
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
              <label>Status</label>
              <div className="type-btn-group">
                {statuses.map(({ value, label, colour }) => (
                  <button key={value} type="button"
                    className={`type-btn ${form.status === value ? "active" : ""}`}
                    style={form.status === value ? { borderColor: colour, color: colour } : {}}
                    onClick={() => set("status", value)}>
                    <span className="status-dot-sm" style={{ background: colour }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label>{isRisk ? "Impact" : "Severity"}</label>
              <div className="type-btn-group">
                {IMPACTS.map(({ value, label, colour }) => (
                  <button key={value} type="button"
                    className={`type-btn ${form.impact === value ? "active" : ""}`}
                    style={form.impact === value ? { borderColor: colour, color: colour } : {}}
                    onClick={() => set("impact", value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isRisk && (
            <>
              <label>Probability</label>
              <div className="type-btn-group">
                {PROBABILITIES.map(({ value, label }) => (
                  <button key={value} type="button"
                    className={`type-btn ${form.probability === value ? "active" : ""}`}
                    onClick={() => set("probability", value)}>
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          <label>Owner</label>
          <input value={form.owner} onChange={e => set("owner", e.target.value)} />

          <div className="form-row">
            <div>
              <label>Raised Date</label>
              <input type="date" value={form.raised_date} onChange={e => set("raised_date", e.target.value)} />
            </div>
            <div>
              <label>Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
          </div>

          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Optional detail…" />

          <label>{responseLabel}</label>
          <textarea rows={3} value={form.response} onChange={e => set("response", e.target.value)} placeholder="Optional…" />
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

function EntryRow({ item, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const isRisk = item.entry_type === "risk";
  const sColour = statusColour(item.entry_type, item.status);
  const iColour = impactColour(item.impact);
  const statusLabel = isRisk
    ? RISK_STATUSES.find(s => s.value === item.status)?.label
    : ISSUE_STATUSES.find(s => s.value === item.status)?.label;
  const hasDetail = item.description || item.response;

  return (
    <div className={`rr-row ${expanded ? "expanded" : ""}`}>
      <div className="rr-row-main" onClick={() => hasDetail && setExpanded(e => !e)}>
        <span className="rr-chevron">
          {hasDetail ? (expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null}
        </span>
        <span className="rr-title">{item.title}</span>
        <div className="rr-badges">
          <Badge colour={sColour} label={statusLabel} />
          <Badge colour={iColour} label={isRisk ? item.impact : item.impact} />
          {isRisk && <span className="rr-prob">{item.probability}</span>}
        </div>
        <span className="rr-owner">{item.owner || <span className="rr-empty">—</span>}</span>
        <span className="rr-date">{item.due_date || <span className="rr-empty">—</span>}</span>
        <div className="rr-actions">
          <button className="btn-icon" title="Edit" onClick={e => { e.stopPropagation(); onEdit(item); }}><Plus size={13} style={{ transform: "rotate(45deg)" }} /></button>
          <button className="btn-icon rr-del" title="Delete" onClick={e => { e.stopPropagation(); onDelete(item.id); }}><Trash2 size={13} /></button>
        </div>
      </div>
      {expanded && hasDetail && (
        <div className="rr-row-detail">
          {item.description && <p className="rr-detail-body">{item.description}</p>}
          {item.response && (
            <div className="rr-response">
              <span className="rr-response-label">{isRisk ? "Mitigation:" : "Resolution:"}</span>
              <p>{item.response}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RiskRegister() {
  const { activeProjectId } = useStore();
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("risk");
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeProjectId) return;
    setLoading(true);
    try {
      const data = await api.getRisks(activeProjectId);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form) {
    if (form.id) {
      await api.updateRisk(form.id, form);
      toast.success("Updated", { duration: 1200 });
    } else {
      await api.createRisk(activeProjectId, form);
      toast.success("Added", { duration: 1200 });
    }
    await load();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this entry?")) return;
    await api.deleteRisk(id);
    toast.success("Deleted", { duration: 1200 });
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const risks = items.filter(i => i.entry_type === "risk");
  const issues = items.filter(i => i.entry_type === "issue");
  const shown = tab === "risk" ? risks : issues;

  return (
    <div className="rr-container">
      <div className="rr-header">
        <div className="rr-tabs">
          <button className={`rr-tab ${tab === "risk" ? "active" : ""}`} onClick={() => setTab("risk")}>
            <AlertTriangle size={13} /> Risks <span className="rr-count">{risks.length}</span>
          </button>
          <button className={`rr-tab ${tab === "issue" ? "active" : ""}`} onClick={() => setTab("issue")}>
            <Bug size={13} /> Issues <span className="rr-count">{issues.length}</span>
          </button>
        </div>
        <button className="btn-primary rr-add-btn" onClick={() => setModal(EMPTY_FORM(tab))}>
          <Plus size={14} /> Add {tab === "risk" ? "Risk" : "Issue"}
        </button>
      </div>

      <div className="rr-table">
        <div className="rr-table-head">
          <span className="rr-chevron" />
          <span className="rr-title">Title</span>
          <span className="rr-badges">Status / Impact</span>
          <span className="rr-owner">Owner</span>
          <span className="rr-date">Due</span>
          <span className="rr-actions" />
        </div>

        {loading ? (
          <div className="rr-empty-state">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="rr-empty-state">
            No {tab === "risk" ? "risks" : "issues"} recorded yet.{" "}
            <button className="btn-link" onClick={() => setModal(EMPTY_FORM(tab))}>Add one.</button>
          </div>
        ) : (
          shown.map(item => (
            <EntryRow key={item.id} item={item}
              onEdit={item => setModal({ ...item })}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {modal && (
        <RiskModal
          initial={modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
