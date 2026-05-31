import React, { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { api } from "../../api";
import Lightbox from "../shared/Lightbox";
import TextPreviewModal from "../shared/TextPreviewModal";
import { Trash2, Download, FileText, Image, File, ExternalLink } from "lucide-react";
import { format, parseISO } from "date-fns";
import "./AttachmentsTab.css";

const TEXT_TYPES = new Set([
  "text/plain","text/markdown","text/html","text/css","text/javascript",
  "application/json","application/xml","application/javascript",
]);

function isImage(mime) { return mime?.startsWith("image/"); }
function isPdf(mime) { return mime === "application/pdf"; }
function isText(mime, filename) {
  if (TEXT_TYPES.has(mime)) return true;
  const ext = filename?.split(".").pop()?.toLowerCase();
  return ["txt","md","js","ts","jsx","tsx","py","rb","go","rs","java","c","cpp","h",
          "css","html","xml","json","yaml","yml","sh","sql","env","log"].includes(ext);
}

function MimeIcon({ mime, filename }) {
  if (isImage(mime)) return <Image size={14} />;
  if (isPdf(mime) || isText(mime, filename)) return <FileText size={14} />;
  return <File size={14} />;
}

function formatBytes(b) {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function AttachmentsTab({ taskId, onUpdate }) {
  const [attachments, setAttachments] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [textPreview, setTextPreview] = useState(null);
  const fileRef = useRef();

  async function load() {
    const data = await api.getAttachments(taskId);
    setAttachments(data);
    onUpdate?.();
  }

  useEffect(() => { load(); }, [taskId]);

  async function upload(files) {
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      try {
        await api.uploadAttachment(taskId, fd);
        toast.success(`Uploaded ${file.name}`, { duration: 1500 });
      } catch (err) {
        toast.error(err.status === 413 ? `${file.name}: exceeds 10 MB limit` : `Failed to upload ${file.name}`);
      }
    }
    load();
  }

  async function handleDelete(id, filename) {
    if (!confirm(`Delete "${filename}"?`)) return;
    try {
      await api.deleteAttachment(id);
      load();
    } catch { toast.error("Failed to delete"); }
  }

  function openPreview(a) {
    if (isImage(a.mime_type)) {
      setLightbox({ src: api.previewUrl(a.id), alt: a.filename });
    } else if (isPdf(a.mime_type)) {
      window.open(api.previewUrl(a.id), "_blank");
    } else if (isText(a.mime_type, a.filename)) {
      setTextPreview(a);
    } else {
      window.location.href = api.downloadUrl(a.id);
    }
  }

  return (
    <div className="attachments-tab">
      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
      {textPreview && <TextPreviewModal attachment={textPreview} onClose={() => setTextPreview(null)} />}

      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload([...e.dataTransfer.files]); }}
        onClick={() => fileRef.current.click()}
      >
        <span>Drop files here or click to upload</span>
        <span className="dropzone-hint">Max 10 MB · images, PDFs, text files get inline preview</span>
        <input ref={fileRef} type="file" multiple style={{ display: "none" }}
          onChange={(e) => upload([...e.target.files])} />
      </div>

      <div className="attachment-list">
        {attachments.map((a) => (
          <div key={a.id} className="attachment-item">
            {isImage(a.mime_type) ? (
              <div className="att-thumbnail" style={{ backgroundImage: `url(${api.previewUrl(a.id)})` }}
                onClick={() => openPreview(a)} title="Click to preview" />
            ) : (
              <div className="att-icon"><MimeIcon mime={a.mime_type} filename={a.filename} /></div>
            )}
            <div className="att-info">
              <span className="att-name" onClick={() => openPreview(a)} title={a.filename}>
                {a.filename}
              </span>
              <span className="att-meta">
                {formatBytes(a.size_bytes)} · {format(parseISO(a.created_at), "MMM d, yyyy")}
              </span>
            </div>
            <div className="att-actions">
              <button className="btn-icon" title="Preview" onClick={() => openPreview(a)}>
                <ExternalLink size={12} />
              </button>
              <a href={api.downloadUrl(a.id)} download={a.filename} className="btn-icon" title="Download">
                <Download size={12} />
              </a>
              <button className="btn-icon danger" title="Delete" onClick={() => handleDelete(a.id, a.filename)}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
        {attachments.length === 0 && <p className="empty-text">No attachments yet.</p>}
      </div>
    </div>
  );
}
