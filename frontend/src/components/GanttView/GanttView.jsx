import React, { useMemo } from "react";
import { Gantt, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { useStore } from "../../store/useStore";
import { api } from "../../api";
import toast from "react-hot-toast";
import { Printer } from "lucide-react";
import "./GanttView.css";

function flattenTasks(nodes) {
  const result = [];
  for (const n of nodes) {
    result.push(n);
    if (n.children?.length) result.push(...flattenTasks(n.children));
  }
  return result;
}

function toGanttTask(t) {
  const start = t.start_date ? new Date(t.start_date) : new Date();
  const end = t.end_date ? new Date(t.end_date) : new Date(start.getTime() + 86400000);
  // Ensure end >= start
  const safeEnd = end >= start ? end : new Date(start.getTime() + 86400000);

  let type = "task";
  if (t.task_type === "milestone") type = "milestone";
  else if (t.task_type === "phase" || t.children?.length) type = "project";

  return {
    id: t.id,
    name: t.title,
    start,
    end: safeEnd,
    progress: t.progress_pct ?? 0,
    type,
    project: t.parent_id ?? undefined,
    isDisabled: false,
    styles: t.colour ? { progressColor: t.colour, progressSelectedColor: t.colour } : undefined,
    hideChildren: false,
  };
}

export default function GanttView() {
  const { tasks, fetchTasks, activeProjectId, setActiveTask } = useStore();
  const [viewMode, setViewMode] = React.useState(ViewMode.Week);

  const flat = useMemo(() => flattenTasks(tasks), [tasks]);

  const ganttTasks = useMemo(
    () => flat.filter((t) => t.start_date || t.end_date).map(toGanttTask),
    [flat]
  );

  async function handleDateChange(task) {
    try {
      await api.updateTask(task.id, {
        start_date: task.start.toISOString().slice(0, 10),
        end_date: task.end.toISOString().slice(0, 10),
      });
      await fetchTasks(activeProjectId);
    } catch {
      toast.error("Failed to update dates");
    }
  }

  if (ganttTasks.length === 0) {
    return (
      <div className="gantt-empty">
        <p>No tasks with dates to display.<br />Add start/end dates to tasks in the tree view.</p>
      </div>
    );
  }

  return (
    <div className="gantt-wrapper">
      <div className="gantt-toolbar">
        {[ViewMode.Day, ViewMode.Week, ViewMode.Month, ViewMode.QuarterYear].map((vm) => (
          <button key={vm} className={`view-tab ${viewMode === vm ? "active" : ""}`} onClick={() => setViewMode(vm)}>
            {vm}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn-ghost" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}
          onClick={() => window.print()} title="Print / Save as PDF">
          <Printer size={13} /> Print
        </button>
      </div>
      <div className="gantt-container">
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          onDateChange={handleDateChange}
          onClick={(task) => setActiveTask(task.id)}
          listCellWidth="200px"
          columnWidth={viewMode === ViewMode.Day ? 40 : viewMode === ViewMode.Week ? 120 : viewMode === ViewMode.Month ? 200 : 300}
          todayColor="rgba(99,102,241,0.15)"
          ganttHeight={600}
        />
      </div>
    </div>
  );
}
