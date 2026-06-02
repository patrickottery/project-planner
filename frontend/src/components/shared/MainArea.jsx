import React, { useState, useEffect } from "react";
import { useStore } from "../../store/useStore";
import TaskTree from "../TaskTree/TaskTree";
import GanttView from "../GanttView/GanttView";
import Dashboard from "../Dashboard/Dashboard";
import RiskRegister from "../RiskRegister/RiskRegister";
import TaskDetailPanel from "../TaskDetail/TaskDetailPanel";
import ViewTabs from "./ViewTabs";
import ExportMenu from "./ExportMenu";
import { Sun, Moon, Menu } from "lucide-react";
import "./MainArea.css";

export default function MainArea() {
  const { activeProjectId, activeView, projects, toggleSidebar } = useStore();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") !== "light");

  useEffect(() => {
    if (darkMode) {
      document.body.classList.remove("light-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.add("light-mode");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const project = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="main-area">
      <div className="main-header">
        <button className="btn-icon sidebar-toggle" onClick={toggleSidebar} title="Toggle sidebar">
          <Menu size={18} />
        </button>
        {activeProjectId && <h1 className="main-title">{project?.name}</h1>}
        {!activeProjectId && <span className="main-title-empty">Project Planner</span>}
        <div className="main-header-right">
          {activeProjectId && <ViewTabs />}
          {activeProjectId && <ExportMenu />}
          <button className="btn-icon" onClick={() => setDarkMode((d) => !d)} title="Toggle theme">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {!activeProjectId ? (
        <div className="main-empty">
          <p>Open the sidebar and select or create a project.</p>
          <button className="btn-primary" onClick={toggleSidebar}>
            <Menu size={14} /> Open Sidebar
          </button>
        </div>
      ) : (
        <div className="main-content">
          {activeView === "tree" && <TaskTree />}
          {activeView === "gantt" && <GanttView />}
          {activeView === "dashboard" && <Dashboard />}
          {activeView === "risks" && <RiskRegister />}
          {activeView !== "risks" && <TaskDetailPanel />}
        </div>
      )}
    </div>
  );
}
