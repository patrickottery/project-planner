import React, { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { useStore } from "./store/useStore";
import Sidebar from "./components/shared/Sidebar";
import MainArea from "./components/shared/MainArea";
import "./App.css";

export default function App() {
  const { fetchProjects, activeProjectId, fetchTasks, sidebarOpen, setSidebarOpen, toggleSidebar } = useStore();

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (activeProjectId) fetchTasks(activeProjectId);
  }, [activeProjectId]);

  // On narrow screens, close the sidebar by default on first load
  useEffect(() => {
    if (window.innerWidth < 900) setSidebarOpen(false);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      {/* Backdrop for mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={toggleSidebar} />
      )}
      <MainArea />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: "#252836", color: "#e2e8f0", border: "1px solid #2e3347" },
        }}
      />
    </div>
  );
}
