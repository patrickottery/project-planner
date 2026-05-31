import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useStore } from "../../store/useStore";
import { api } from "../../api";
import TaskRow from "./TaskRow";
import TaskTreeToolbar from "./TaskTreeToolbar";
import BulkActionBar from "./BulkActionBar";
import "./TaskTree.css";

function flattenTree(nodes, collapsed, depth = 0) {
  const result = [];
  for (const node of nodes) {
    result.push({ ...node, _depth: depth });
    if (node.children?.length && !collapsed[node.id]) {
      result.push(...flattenTree(node.children, collapsed, depth + 1));
    }
  }
  return result;
}

function taskOverlapsDateRange(task, from, to) {
  if (!from && !to) return true;
  const taskStart = task.start_date;
  const taskEnd = task.end_date;
  if (!taskStart && !taskEnd) return false;
  const s = taskStart || taskEnd;
  const e = taskEnd || taskStart;
  if (from && e < from) return false;
  if (to && s > to) return false;
  return true;
}

export default function TaskTree() {
  const {
    activeProjectId, tasks, fetchTasks, collapsed,
    setActiveTask, activeTaskId, pushUndo, popUndo,
  } = useStore();

  const [filter, setFilter] = useState({ keyword: "", status: "", assignee: "", dateFrom: "", dateTo: "" });
  const [multiSelectActive, setMultiSelectActive] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [dragState, setDragState] = useState({ draggedId: null, overId: null, overPos: null });

  const flat = flattenTree(tasks, collapsed);

  const filtered = flat.filter((t) => {
    if (filter.keyword && !t.title.toLowerCase().includes(filter.keyword.toLowerCase())) return false;
    if (filter.status && t.status !== filter.status) return false;
    if (filter.assignee && t.assignee !== filter.assignee) return false;
    if (!taskOverlapsDateRange(t, filter.dateFrom, filter.dateTo)) return false;
    return true;
  });

  const assignees = [...new Set(flat.map((t) => t.assignee).filter(Boolean))];

  // Stable refs for the keyboard handler
  const filteredRef = useRef(filtered);
  const activeTaskIdRef = useRef(activeTaskId);
  const activeProjectIdRef = useRef(activeProjectId);
  filteredRef.current = filtered;
  activeTaskIdRef.current = activeTaskId;
  activeProjectIdRef.current = activeProjectId;

  useEffect(() => {
    async function onKeyDown(e) {
      const tid = activeTaskIdRef.current;
      if (!tid) return;
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const rows = filteredRef.current;
      const pid = activeProjectIdRef.current;
      const idx = rows.findIndex((t) => t.id === tid);
      const task = rows[idx];

      if (e.key === "Tab" && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (!task) return;
        pushUndo({ type: "move", taskId: task.id, parent_id: task.parent_id, position: task.position });
        try {
          if (e.shiftKey) { await api.promoteTask(tid); }
          else { await api.demoteTask(tid); }
          await fetchTasks(pid);
        } catch (err) { toast.error(err.message || "Cannot indent"); }
      } else if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (!task) return;
        try {
          const newTask = await api.createTask(pid, { parent_id: task.parent_id || null });
          await fetchTasks(pid);
          setActiveTask(newTask.id);
        } catch { toast.error("Failed to add task"); }
      } else if (e.key === "Escape") {
        setActiveTask(null);
      } else if (e.key === "ArrowDown" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (idx >= 0 && idx < rows.length - 1) setActiveTask(rows[idx + 1].id);
      } else if (e.key === "ArrowUp" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (idx > 0) setActiveTask(rows[idx - 1].id);
      } else if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        const action = popUndo();
        if (!action) { toast("Nothing to undo", { icon: "↩" }); return; }
        try {
          if (action.type === "move") {
            await api.moveTask(action.taskId, { parent_id: action.parent_id, position: action.position });
            setActiveTask(action.taskId);
          } else if (action.type === "delete") {
            await api.createTask(action.task.project_id, action.task);
          }
          await fetchTasks(pid);
          toast.success("Undone", { duration: 1200 });
        } catch { toast.error("Undo failed"); }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [fetchTasks, setActiveTask, pushUndo, popUndo]);

  // ── Add / delete ──────────────────────────────────────────────────────────

  async function handleAdd(parentId) {
    try {
      const t = await api.createTask(activeProjectId, { parent_id: parentId || null });
      await fetchTasks(activeProjectId);
      setActiveTask(t.id);
    } catch { toast.error("Failed to create task"); }
  }

  async function handleDelete(taskId, cascade) {
    const taskToDelete = flat.find((t) => t.id === taskId);
    if (taskToDelete) pushUndo({ type: "delete", task: { ...taskToDelete } });
    try {
      await api.deleteTask(taskId, cascade);
      await fetchTasks(activeProjectId);
      if (activeTaskId === taskId) setActiveTask(null);
      toast.success("Deleted", { duration: 1200 });
    } catch { toast.error("Failed to delete task"); }
  }

  // ── Multi-select ──────────────────────────────────────────────────────────

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkSetStatus(status) {
    try {
      await Promise.all([...selectedIds].map((id) => api.updateTask(id, { status })));
      await fetchTasks(activeProjectId);
      setSelectedIds(new Set());
      toast.success("Updated", { duration: 1200 });
    } catch { toast.error("Bulk update failed"); }
  }

  async function bulkSetAssignee(assignee) {
    try {
      await Promise.all([...selectedIds].map((id) => api.updateTask(id, { assignee })));
      await fetchTasks(activeProjectId);
      setSelectedIds(new Set());
      toast.success("Updated", { duration: 1200 });
    } catch { toast.error("Bulk update failed"); }
  }

  // ── Drag-and-drop ─────────────────────────────────────────────────────────

  function handleDragStart(taskId) {
    setDragState({ draggedId: taskId, overId: null, overPos: null });
  }

  function handleDragOver(taskId, pos) {
    setDragState((prev) => ({ ...prev, overId: taskId, overPos: pos }));
  }

  function handleDragLeave() {
    setDragState((prev) => ({ ...prev, overId: null, overPos: null }));
  }

  function handleDragEnd() {
    setDragState({ draggedId: null, overId: null, overPos: null });
  }

  async function handleDrop(targetId) {
    const { draggedId, overPos } = dragState;
    setDragState({ draggedId: null, overId: null, overPos: null });
    if (!draggedId || draggedId === targetId) return;

    const dragged = flat.find((t) => t.id === draggedId);
    const target = flat.find((t) => t.id === targetId);
    if (!dragged || !target) return;

    if (dragged.parent_id !== target.parent_id) {
      toast.error("Use Tab / Shift+Tab to move between levels");
      return;
    }

    const siblings = flat.filter((t) => t.parent_id === dragged.parent_id);
    const targetIdx = siblings.findIndex((t) => t.id === targetId);
    let newPosition;
    if (overPos === "before") {
      const prev = siblings[targetIdx - 1];
      newPosition = prev ? (prev.position + target.position) / 2 : target.position - 5;
    } else {
      const next = siblings[targetIdx + 1];
      newPosition = next ? (target.position + next.position) / 2 : target.position + 5;
    }

    try {
      await api.moveTask(draggedId, { parent_id: dragged.parent_id, position: newPosition });
      await fetchTasks(activeProjectId);
    } catch { toast.error("Failed to reorder"); }
  }

  return (
    <div className="task-tree">
      <TaskTreeToolbar
        onAdd={() => handleAdd(null)}
        filter={filter}
        setFilter={setFilter}
        assignees={assignees}
        multiSelectActive={multiSelectActive}
        onToggleMultiSelect={() => { setMultiSelectActive((v) => !v); setSelectedIds(new Set()); }}
      />
      {multiSelectActive && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          onSetStatus={bulkSetStatus}
          onSetAssignee={bulkSetAssignee}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
      <div className="task-tree-scroll">
        {filtered.length === 0 ? (
          <div className="tree-empty">
            {flat.length === 0
              ? 'No tasks yet. Click "Add Task" or press Enter to begin.'
              : "No tasks match the current filter."}
          </div>
        ) : (
          filtered.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onAdd={handleAdd}
              onDelete={handleDelete}
              isActive={activeTaskId === task.id}
              onClick={() => setActiveTask(task.id)}
              multiSelectActive={multiSelectActive}
              isSelected={selectedIds.has(task.id)}
              onToggleSelect={toggleSelected}
              dragState={dragState}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))
        )}
      </div>
      <div className="tree-shortcuts-hint">
        Tab — indent · Shift+Tab — outdent · Enter — add sibling · ↑↓ — navigate · Ctrl+Z — undo
      </div>
    </div>
  );
}
