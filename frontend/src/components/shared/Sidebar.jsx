import React, { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { useStore } from "../../store/useStore";
import { api } from "../../api";
import { Plus, Trash2, Edit2, Check, X, Flag, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import "./Sidebar.css";

const COLOURS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#14b8a6"];

function flattenTasks(nodes) {
  const result = [];
  for (const n of nodes) {
    result.push(n);
    if (n.children?.length) result.push(...flattenTasks(n.children));
  }
  return result;
}

export default function Sidebar() {
  const { projects, activeProjectId, setActiveProject, fetchProjects, tasks, setActiveTask, setActiveView, sidebarOpen, setSidebarOpen } = useStore();
  const [milestonesOpen, setMilestonesOpen] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColour, setNewColour] = useState(COLOURS[0]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColour, setEditColour] = useState(COLOURS[0]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const p = await api.createProject({ name: newName.trim(), colour: newColour });
      await fetchProjects();
      setActiveProject(p.id);
      setCreating(false);
      setNewName("");
    } catch {
      toast.error("Failed to create project");
    }
  }

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm("Delete this project and all its tasks?")) return;
    try {
      await api.deleteProject(id);
      await fetchProjects();
      if (activeProjectId === id) setActiveProject(null);
    } catch {
      toast.error("Failed to delete project");
    }
  }

  async function handleRename(id) {
    if (!editName.trim()) return;
    try {
      await api.updateProject(id, { name: editName.trim(), colour: editColour });
      await fetchProjects();
      setEditingId(null);
    } catch {
      toast.error("Failed to rename");
    }
  }

  return (
    <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
      <div className="sidebar-header">
        <span className="sidebar-logo">Project Planner</span>
        <div className="sidebar-header-actions">
          <button className="btn-icon" title="New project" onClick={() => setCreating(true)}>
            <Plus size={16} />
          </button>
          <button className="btn-icon sidebar-close-btn" title="Close" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>
      </div>

      {creating && (
        <form className="new-project-form" onSubmit={handleCreate}>
          <input
            autoFocus
            placeholder="Project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="colour-row">
            {COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                className={`colour-dot ${c === newColour ? "selected" : ""}`}
                style={{ background: c }}
                onClick={() => setNewColour(c)}
              />
            ))}
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Create</button>
            <button type="button" className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      )}

      <nav className="project-list">
        {projects.map((p) => (
          <div key={p.id}>
            {editingId === p.id ? (
              <div className="project-edit-form" onClick={(e) => e.stopPropagation()}>
                <div className="project-edit-row">
                  <span className="project-dot" style={{ background: editColour }} />
                  <input
                    className="rename-input"
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(p.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <button className="btn-icon" onClick={() => handleRename(p.id)}><Check size={13} /></button>
                  <button className="btn-icon" onClick={() => setEditingId(null)}><X size={13} /></button>
                </div>
                <div className="colour-row edit-colour-row">
                  {COLOURS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`colour-dot ${c === editColour ? "selected" : ""}`}
                      style={{ background: c }}
                      onClick={() => setEditColour(c)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div
                className={`project-item ${p.id === activeProjectId ? "active" : ""}`}
                onClick={() => { setActiveProject(p.id); if (window.innerWidth < 900) setSidebarOpen(false); }}
              >
                <span className="project-dot" style={{ background: p.colour }} />
                <span className="project-name">{p.name}</span>
                <span className="project-meta">{p.task_count}</span>
                <div className="project-actions">
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setEditingId(p.id); setEditName(p.name); setEditColour(p.colour || COLOURS[0]); }}><Edit2 size={13} /></button>
                  <button className="btn-icon danger" onClick={(e) => handleDelete(e, p.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
        {projects.length === 0 && !creating && (
          <p className="empty-hint">No projects yet.<br />Click + to create one.</p>
        )}
      </nav>

      {activeProjectId && <MilestoneList tasks={tasks} onOpen={(id) => { setActiveTask(id); setActiveView("tree"); }} />}
    </aside>
  );
}

function MilestoneList({ tasks, onOpen }) {
  const [open, setOpen] = useState(true);
  const today = new Date();
  const flat = useMemo(() => flattenTasks(tasks), [tasks]);
  const milestones = flat
    .filter((t) => t.task_type === "milestone")
    .sort((a, b) => (a.end_date || "").localeCompare(b.end_date || ""));

  if (milestones.length === 0) return null;

  return (
    <div className="milestone-section">
      <button className="milestone-header" onClick={() => setOpen((o) => !o)}>
        <Flag size={12} />
        <span>Milestones</span>
        <span className="milestone-count">{milestones.length}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="milestone-list">
          {milestones.map((m) => {
            const isPast = m.end_date && !isAfter(parseISO(m.end_date), today) && m.status !== "complete";
            return (
              <div key={m.id} className={`milestone-item ${isPast ? "overdue" : ""} ${m.status === "complete" ? "done" : ""}`}
                onClick={() => onOpen(m.id)}>
                <span className="ms-date">{m.end_date ? format(parseISO(m.end_date), "MMM d") : "—"}</span>
                <span className="ms-title">{m.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
