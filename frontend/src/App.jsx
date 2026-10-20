import React, { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { useStore } from "./store/useStore";
import { api } from "./api";
import Sidebar from "./components/shared/Sidebar";
import MainArea from "./components/shared/MainArea";
import "./App.css";

export default function App() {
  const { fetchProjects, activeProjectId, fetchTasks, sidebarOpen, setSidebarOpen, toggleSidebar } = useStore();

  useEffect(() => {
    fetchProjects();
  }, []);

  // Non-prod copies must look unmistakably different: banner, tab title, favicon.
  const [env, setEnv] = useState(null);
  useEffect(() => {
    api.me().then((me) => setEnv(me.env || "dev")).catch(() => setEnv("unknown"));
  }, []);
  const envLabel = env && env !== "prod" ? (env === "uat" ? "TEST" : env.toUpperCase()) : null;
  useEffect(() => {
    if (!envLabel) return;
    document.title = `${envLabel} · Project Planner`;
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = "/favicon-dev.svg";
  }, [envLabel]);

  useEffect(() => {
    if (activeProjectId) fetchTasks(activeProjectId);
  }, [activeProjectId]);

  // On narrow screens, close the sidebar by default on first load
  useEffect(() => {
    if (window.innerWidth < 900) setSidebarOpen(false);
  }, []);

  return (
    <div className={`app-layout${envLabel ? " has-env-banner" : ""}`}>
      {envLabel && <div className="env-banner">{envLabel} copy (APP_ENV={env}) — not the real planner</div>}
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
