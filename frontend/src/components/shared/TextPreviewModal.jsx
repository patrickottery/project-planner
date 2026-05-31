import React, { useState, useEffect } from "react";
import { api } from "../../api";
import { X } from "lucide-react";
import "./TextPreviewModal.css";

export default function TextPreviewModal({ attachment, onClose }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(api.previewUrl(attachment.id));
        if (!res.ok) throw new Error("Failed to load");
        const text = await res.text();
        setContent(text);
      } catch {
        setError("Could not load file content.");
      }
    }
    load();

    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [attachment.id]);

  return (
    <div className="text-preview-overlay" onClick={onClose}>
      <div className="text-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="text-preview-header">
          <span className="text-preview-filename">{attachment.filename}</span>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="text-preview-body">
          {error && <p className="text-preview-error">{error}</p>}
          {content === null && !error && <p className="text-preview-loading">Loading…</p>}
          {content !== null && <pre>{content}</pre>}
        </div>
      </div>
    </div>
  );
}
