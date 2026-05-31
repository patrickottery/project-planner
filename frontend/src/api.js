const BASE = "/api/v1";

async function req(method, path, body, isFormData = false) {
  const opts = { method, headers: {} };
  if (body && !isFormData) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  } else if (isFormData) {
    opts.body = body;
  }
  const res = await fetch(BASE + path, opts);
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(err.error || res.statusText), { status: res.status });
  }
  return res.json();
}

export const api = {
  // Projects
  getProjects: () => req("GET", "/projects"),
  createProject: (data) => req("POST", "/projects", data),
  getProject: (id) => req("GET", `/projects/${id}`),
  updateProject: (id, data) => req("PUT", `/projects/${id}`, data),
  deleteProject: (id) => req("DELETE", `/projects/${id}`),

  // Tasks
  getProjectTasks: (pid) => req("GET", `/projects/${pid}/tasks`),
  createTask: (pid, data) => req("POST", `/projects/${pid}/tasks`, data),
  getTask: (id) => req("GET", `/tasks/${id}`),
  updateTask: (id, data) => req("PUT", `/tasks/${id}`, data),
  deleteTask: (id, cascade = true) => req("DELETE", `/tasks/${id}?cascade=${cascade}`),
  promoteTask: (id) => req("POST", `/tasks/${id}/promote`),
  demoteTask: (id) => req("POST", `/tasks/${id}/demote`),
  moveTask: (id, data) => req("POST", `/tasks/${id}/move`, data),

  // Notes
  getNotes: (tid) => req("GET", `/tasks/${tid}/notes`),
  createNote: (tid, data) => req("POST", `/tasks/${tid}/notes`, data),
  updateNote: (id, data) => req("PUT", `/notes/${id}`, data),
  deleteNote: (id) => req("DELETE", `/notes/${id}`),

  // Attachments
  getAttachments: (tid) => req("GET", `/tasks/${tid}/attachments`),
  uploadAttachment: (tid, formData) => req("POST", `/tasks/${tid}/attachments`, formData, true),
  deleteAttachment: (id) => req("DELETE", `/attachments/${id}`),
  downloadUrl: (id) => `${BASE}/attachments/${id}/download`,

  // Export / import
  exportJson: (pid) => `${BASE}/projects/${pid}/export/json`,
  exportCsv: (pid) => `${BASE}/projects/${pid}/export/csv`,
  importJson: (data) => req("POST", "/projects/import/json", data),
};
