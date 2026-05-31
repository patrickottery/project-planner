import React, { useState } from "react";
import toast from "react-hot-toast";
import { useStore } from "../../store/useStore";
import { api } from "../../api";
import { FolderOpen, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import "./Sidebar.css";

const COLOURS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#14b8a6"];

export default function Sidebar() {
  const { projects, activeProjectId, setActiveProject, fetchProjects } = useStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColour, setNewColour] = useState(COLOURS[0]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");

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
      await api.updateProject(id, { name: editName.trim() });
      await fetchProjects();
      setEditingId(null);
    } catch {
      toast.error("Failed to rename");
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo">Project Planner</span>
        <button
          className="btn-icon"
          title="New project"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} />
        </button>
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
          <div
            key={p.id}
            className={`project-item ${p.id === activeProjectId ? "active" : ""}`}
            onClick={() => setActiveProject(p.id)}
          >
            <span className="project-dot" style={{ background: p.colour }} />
            {editingId === p.id ? (
              <input
                className="rename-input"
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(p.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="project-name">{p.name}</span>
            )}
            <span className="project-meta">{p.task_count}</span>
            <div className="project-actions">
              {editingId === p.id ? (
                <>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleRename(p.id); }}><Check size={13} /></button>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}><X size={13} /></button>
                </>
              ) : (
                <>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setEditingId(p.id); setEditName(p.name); }}><Edit2 size={13} /></button>
                  <button className="btn-icon danger" onClick={(e) => handleDelete(e, p.id)}><Trash2 size={13} /></button>
                </>
              )}
            </div>
          </div>
        ))}
        {projects.length === 0 && !creating && (
          <p className="empty-hint">No projects yet.<br />Click + to create one.</p>
        )}
      </nav>
    </aside>
  );
}
