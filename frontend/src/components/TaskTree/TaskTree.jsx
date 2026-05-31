import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useStore } from "../../store/useStore";
import { api } from "../../api";
import TaskRow from "./TaskRow";
import TaskTreeToolbar from "./TaskTreeToolbar";
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

export default function TaskTree() {
  const {
    activeProjectId, tasks, fetchTasks, collapsed,
    setActiveTask, activeTaskId, pushUndo, popUndo,
  } = useStore();
  const [filter, setFilter] = useState({ keyword: "", status: "", assignee: "" });

  const flat = flattenTree(tasks, collapsed);
  const filtered = flat.filter((t) => {
    if (filter.keyword && !t.title.toLowerCase().includes(filter.keyword.toLowerCase())) return false;
    if (filter.status && t.status !== filter.status) return false;
    if (filter.assignee && t.assignee !== filter.assignee) return false;
    return true;
  });

  const assignees = [...new Set(flat.map((t) => t.assignee).filter(Boolean))];

  // Stable refs to avoid stale closures in the keyboard handler
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
          if (e.shiftKey) {
            await api.promoteTask(tid);
          } else {
            await api.demoteTask(tid);
          }
          await fetchTasks(pid);
        } catch (err) {
          toast.error(err.message || "Cannot indent");
        }
      } else if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (!task) return;
        try {
          const newTask = await api.createTask(pid, { parent_id: task.parent_id || null });
          await fetchTasks(pid);
          setActiveTask(newTask.id);
        } catch {
          toast.error("Failed to add task");
        }
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
        } catch {
          toast.error("Undo failed");
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [fetchTasks, setActiveTask, pushUndo, popUndo]);

  async function handleAdd(parentId) {
    try {
      const t = await api.createTask(activeProjectId, { parent_id: parentId || null });
      await fetchTasks(activeProjectId);
      setActiveTask(t.id);
    } catch {
      toast.error("Failed to create task");
    }
  }

  async function handleDelete(taskId, cascade) {
    const taskToDelete = flat.find((t) => t.id === taskId);
    if (taskToDelete) pushUndo({ type: "delete", task: { ...taskToDelete } });
    try {
      await api.deleteTask(taskId, cascade);
      await fetchTasks(activeProjectId);
      if (activeTaskId === taskId) setActiveTask(null);
      toast.success("Deleted", { duration: 1200 });
    } catch {
      toast.error("Failed to delete task");
    }
  }

  return (
    <div className="task-tree">
      <TaskTreeToolbar
        onAdd={() => handleAdd(null)}
        filter={filter}
        setFilter={setFilter}
        assignees={assignees}
      />
      <div className="task-tree-scroll">
        {filtered.length === 0 ? (
          <div className="tree-empty">
            {flat.length === 0
              ? 'No tasks yet. Click "Add Task" or press Enter to create your first task.'
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
