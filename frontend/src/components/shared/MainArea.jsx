import React, { useState, useEffect } from "react";
import { useStore } from "../../store/useStore";
import TaskTree from "../TaskTree/TaskTree";
import GanttView from "../GanttView/GanttView";
import Dashboard from "../Dashboard/Dashboard";
import TaskDetailPanel from "../TaskDetail/TaskDetailPanel";
import ViewTabs from "./ViewTabs";
import ExportMenu from "./ExportMenu";
import { Sun, Moon } from "lucide-react";
import "./MainArea.css";

export default function MainArea() {
  const { activeProjectId, activeView, projects } = useStore();
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") !== "light";
  });

  useEffect(() => {
    if (darkMode) {
      document.body.classList.remove("light-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.add("light-mode");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  if (!activeProjectId) {
    return (
      <div className="main-area main-area--empty">
        <div className="theme-btn-corner">
          <button className="btn-icon" onClick={() => setDarkMode((d) => !d)} title="Toggle theme">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
        <p>Select or create a project to get started.</p>
      </div>
    );
  }

  const project = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="main-area">
      <div className="main-header">
        <h1 className="main-title">{project?.name}</h1>
        <div className="main-header-right">
          <ViewTabs />
          <ExportMenu />
          <button className="btn-icon" onClick={() => setDarkMode((d) => !d)} title="Toggle theme">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>
      <div className="main-content">
        {activeView === "tree" && <TaskTree />}
        {activeView === "gantt" && <GanttView />}
        {activeView === "dashboard" && <Dashboard />}
        <TaskDetailPanel />
      </div>
    </div>
  );
}
