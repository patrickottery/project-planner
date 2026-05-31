import React, { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { useStore } from "./store/useStore";
import Sidebar from "./components/shared/Sidebar";
import MainArea from "./components/shared/MainArea";
import "./App.css";

export default function App() {
  const { fetchProjects, activeProjectId, fetchTasks } = useStore();

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (activeProjectId) fetchTasks(activeProjectId);
  }, [activeProjectId]);

  return (
    <div className="app-layout">
      <Sidebar />
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
