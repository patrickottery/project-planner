import React from "react";
import { useStore } from "../../store/useStore";
import TaskTree from "../TaskTree/TaskTree";
import GanttView from "../GanttView/GanttView";
import Dashboard from "../Dashboard/Dashboard";
import TaskDetailPanel from "../TaskDetail/TaskDetailPanel";
import ViewTabs from "./ViewTabs";
import "./MainArea.css";

export default function MainArea() {
  const { activeProjectId, activeView, projects } = useStore();

  if (!activeProjectId) {
    return (
      <div className="main-area main-area--empty">
        <p>Select or create a project to get started.</p>
      </div>
    );
  }

  const project = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="main-area">
      <div className="main-header">
        <h1 className="main-title">{project?.name}</h1>
        <ViewTabs />
      </div>
      <div className="main-content">
        {activeView === "tree" && <TaskTree />}
        {activeView === "gantt" && <GanttView />}
        {activeView === "dashboard" && <Dashboard />}
      </div>
      <TaskDetailPanel />
    </div>
  );
}
