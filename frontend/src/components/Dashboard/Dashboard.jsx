import React, { useMemo } from "react";
import { useStore } from "../../store/useStore";
import { format, parseISO, isAfter, isBefore, addDays } from "date-fns";
import "./Dashboard.css";

function flattenTasks(nodes) {
  const result = [];
  for (const n of nodes) {
    result.push(n);
    if (n.children?.length) result.push(...flattenTasks(n.children));
  }
  return result;
}

const STATUS_COLOURS = {
  not_started: "#8892a4",
  in_progress: "#6366f1",
  complete: "#22c55e",
  blocked: "#ef4444",
  deferred: "#f59e0b",
};

export default function Dashboard() {
  const { tasks } = useStore();
  const flat = useMemo(() => flattenTasks(tasks), [tasks]);
  const today = new Date();
  const in30 = addDays(today, 30);

  const statusCounts = flat.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  const total = flat.length;
  const completePct = total ? Math.round(((statusCounts.complete || 0) / total) * 100) : 0;

  const upcomingMilestones = flat
    .filter(
      (t) =>
        t.task_type === "milestone" &&
        t.end_date &&
        isAfter(parseISO(t.end_date), today) &&
        isBefore(parseISO(t.end_date), in30)
    )
    .sort((a, b) => a.end_date.localeCompare(b.end_date));

  const overdue = flat.filter(
    (t) =>
      t.end_date &&
      isBefore(parseISO(t.end_date), today) &&
      t.status !== "complete"
  );

  const byAssignee = flat.reduce((acc, t) => {
    const a = t.assignee || "Unassigned";
    acc[a] = (acc[a] || 0) + 1;
    return acc;
  }, {});
  const maxAssignee = Math.max(...Object.values(byAssignee), 1);

  return (
    <div className="dashboard">
      <div className="dash-card">
        <h3>Overall Progress</h3>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${completePct}%` }} />
        </div>
        <p className="progress-label">{completePct}% complete ({statusCounts.complete || 0} of {total} tasks)</p>
      </div>

      <div className="dash-card">
        <h3>Tasks by Status</h3>
        <div className="status-list">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="status-row">
              <span className="status-dot" style={{ background: STATUS_COLOURS[status] }} />
              <span className="status-name">{status.replace("_", " ")}</span>
              <span className="status-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-card">
        <h3>Upcoming Milestones <span className="badge-small">(next 30 days)</span></h3>
        {upcomingMilestones.length === 0 ? (
          <p className="empty-text">None</p>
        ) : (
          <ul className="milestone-list">
            {upcomingMilestones.map((m) => (
              <li key={m.id}>
                <span className="milestone-date">{format(parseISO(m.end_date), "MMM d")}</span>
                <span>{m.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dash-card dash-card--danger">
        <h3>Overdue Tasks <span className="badge-small">{overdue.length}</span></h3>
        {overdue.length === 0 ? (
          <p className="empty-text">None — nice work!</p>
        ) : (
          <ul className="overdue-list">
            {overdue.slice(0, 8).map((t) => (
              <li key={t.id}>
                <span className="overdue-date">{t.end_date}</span>
                <span>{t.title}</span>
              </li>
            ))}
            {overdue.length > 8 && <li className="more">+{overdue.length - 8} more</li>}
          </ul>
        )}
      </div>

      <div className="dash-card dash-card--wide">
        <h3>Tasks by Assignee</h3>
        {Object.entries(byAssignee).map(([name, count]) => (
          <div key={name} className="assignee-row">
            <span className="assignee-name">{name}</span>
            <div className="assignee-bar-bg">
              <div className="assignee-bar-fill" style={{ width: `${(count / maxAssignee) * 100}%` }} />
            </div>
            <span className="assignee-count">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
