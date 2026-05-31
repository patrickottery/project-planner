import React, { useState, useCallback } from "react";
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
  const { activeProjectId, tasks, fetchTasks, collapsed, setActiveTask, activeTaskId } = useStore();
  const [filter, setFilter] = useState({ keyword: "", status: "", assignee: "" });

  const flat = flattenTree(tasks, collapsed);

  const filtered = flat.filter((t) => {
    if (filter.keyword && !t.title.toLowerCase().includes(filter.keyword.toLowerCase())) return false;
    if (filter.status && t.status !== filter.status) return false;
    if (filter.assignee && t.assignee !== filter.assignee) return false;
    return true;
  });

  const assignees = [...new Set(flat.map((t) => t.assignee).filter(Boolean))];

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
    try {
      await api.deleteTask(taskId, cascade);
      await fetchTasks(activeProjectId);
      if (activeTaskId === taskId) setActiveTask(null);
      toast.success("Task deleted");
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
            No tasks yet. Click "Add Task" to create your first task.
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
    </div>
  );
}
