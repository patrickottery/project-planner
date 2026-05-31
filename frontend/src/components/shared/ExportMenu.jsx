import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { useStore } from "../../store/useStore";
import { api } from "../../api";
import { Download, Upload, ChevronDown } from "lucide-react";
import "./ExportMenu.css";

export default function ExportMenu() {
  const { activeProjectId, fetchProjects, setActiveProject } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const fileRef = useRef();

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleExportJson() {
    window.location.href = api.exportJson(activeProjectId);
    setOpen(false);
  }

  function handleExportCsv() {
    window.location.href = api.exportCsv(activeProjectId);
    setOpen(false);
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setOpen(false);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const newProject = await api.importJson(data);
      await fetchProjects();
      setActiveProject(newProject.id);
      toast.success(`Imported "${newProject.name}"`);
    } catch (err) {
      toast.error("Import failed — check the file format");
    }
    e.target.value = "";
  }

  if (!activeProjectId) return null;

  return (
    <div className="export-menu" ref={ref}>
      <button className="btn-ghost export-trigger" onClick={() => setOpen((o) => !o)}>
        <Download size={13} />
        Export
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="export-dropdown">
          <button onClick={handleExportJson}>
            <Download size={13} /> Export JSON
          </button>
          <button onClick={handleExportCsv}>
            <Download size={13} /> Export CSV
          </button>
          <div className="export-divider" />
          <button onClick={() => { fileRef.current.click(); }}>
            <Upload size={13} /> Import JSON
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleImport}
      />
    </div>
  );
}
