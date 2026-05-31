import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { api } from "../../api";
import { Trash2, Edit2, Check, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import "./NotesTab.css";

export default function NotesTab({ taskId, onUpdate }) {
  const [notes, setNotes] = useState([]);
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState("");

  async function load() {
    const data = await api.getNotes(taskId);
    setNotes(data);
    onUpdate?.();
  }

  useEffect(() => { load(); }, [taskId]);

  async function handleAdd() {
    if (!body.trim()) return;
    try {
      await api.createNote(taskId, { body });
      setBody("");
      load();
    } catch { toast.error("Failed to add note"); }
  }

  async function handleEdit(id) {
    try {
      await api.updateNote(id, { body: editBody });
      setEditingId(null);
      load();
    } catch { toast.error("Failed to update note"); }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this note?")) return;
    try {
      await api.deleteNote(id);
      load();
    } catch { toast.error("Failed to delete note"); }
  }

  return (
    <div className="notes-tab">
      <div className="note-compose">
        <textarea
          rows={3}
          placeholder="Add a note… (Ctrl+Enter to save)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleAdd(); }}
        />
        <button className="btn-primary" onClick={handleAdd}>Add Note</button>
      </div>

      <div className="note-list">
        {notes.map((n) => (
          <div key={n.id} className="note-item">
            <div className="note-header">
              <span className="note-date">{format(parseISO(n.created_at), "MMM d, yyyy HH:mm")}</span>
              <div className="note-actions">
                <button className="btn-icon" onClick={() => { setEditingId(n.id); setEditBody(n.body); }}><Edit2 size={12} /></button>
                <button className="btn-icon danger" onClick={() => handleDelete(n.id)}><Trash2 size={12} /></button>
              </div>
            </div>
            {editingId === n.id ? (
              <div className="note-edit">
                <textarea rows={4} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                <div className="note-edit-actions">
                  <button className="btn-primary" onClick={() => handleEdit(n.id)}><Check size={12} /> Save</button>
                  <button className="btn-ghost" onClick={() => setEditingId(null)}><X size={12} /> Cancel</button>
                </div>
              </div>
            ) : (
              <p className="note-body">{n.body}</p>
            )}
          </div>
        ))}
        {notes.length === 0 && <p className="empty-text">No notes yet.</p>}
      </div>
    </div>
  );
}
