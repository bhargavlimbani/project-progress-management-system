import api from "./api";

export { default as api, BASE_URL, STORAGE, clearSession } from "./api";

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data) => api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
  refresh: (refreshToken) => api.post("/auth/refresh", { refreshToken }),
  changePassword: (data) => api.post("/auth/change-password", data),
  activate: (token, data) => api.post(`/students/activate/${token}`, data),
};

// ── Users / profile ───────────────────────────────────────────────────────
export const userApi = {
  list: (params) => api.get("/users", { params }),
  get: (id) => api.get(`/users/${id}`),
  setActive: (id, isActive) => api.patch(`/users/${id}/active`, { isActive }),
  resetPassword: (id, password) => api.post(`/users/${id}/reset-password`, { password }),
  updateProfile: (data) => api.put("/users/me", data),
  uploadAvatar: (formData) =>
    api.post("/users/me/avatar", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ── Academic structure ────────────────────────────────────────────────────
export const academicApi = {
  getYears: () => api.get("/academic/academic-years"),
  createYear: (data) => api.post("/academic/academic-years", data),
  updateYear: (id, data) => api.put(`/academic/academic-years/${id}`, data),
  activateYear: (id) => api.patch(`/academic/academic-years/${id}/activate`),
  deleteYear: (id) => api.delete(`/academic/academic-years/${id}`),
  getSemesters: (params) => api.get("/academic/semesters", { params }),
  createSemester: (data) => api.post("/academic/semesters", data),
  deleteSemester: (id) => api.delete(`/academic/semesters/${id}`),
};

// ── Faculty ───────────────────────────────────────────────────────────────
export const facultyApi = {
  list: () => api.get("/faculty"),
  get: (id) => api.get(`/faculty/${id}`),
  create: (data) => api.post("/faculty", data),
  update: (id, data) => api.put(`/faculty/${id}`, data),
  delete: (id) => api.delete(`/faculty/${id}`),
  resetPassword: (id, data) => api.post(`/faculty/${id}/reset-password`, data),
};

// ── Mentors ───────────────────────────────────────────────────────────────
export const mentorApi = {
  list: () => api.get("/mentors"),
  get: (id) => api.get(`/mentors/${id}`),
  create: (data) => api.post("/mentors", data),
  update: (id, data) => api.put(`/mentors/${id}`, data),
  delete: (id) => api.delete(`/mentors/${id}`),
  resetPassword: (id, data) => api.post(`/mentors/${id}/reset-password`, data),
};

// ── Domains ───────────────────────────────────────────────────────────────
export const domainApi = {
  list: () => api.get("/domains"),
  create: (data) => api.post("/domains", data),
  update: (id, data) => api.put(`/domains/${id}`, data),
  delete: (id) => api.delete(`/domains/${id}`),
};

// ── Subjects ──────────────────────────────────────────────────────────────
export const subjectApi = {
  list: (params) => api.get("/subjects", { params }),
  get: (id) => api.get(`/subjects/${id}`),
  create: (data) => api.post("/subjects", data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  delete: (id) => api.delete(`/subjects/${id}`),
  getMilestoneTemplates: (subjectId) => api.get(`/subjects/${subjectId}/milestone-templates`),
  upsertMilestoneTemplates: (subjectId, data) =>
    api.put(`/subjects/${subjectId}/milestone-templates`, data),
};

// ── Students ──────────────────────────────────────────────────────────────
export const studentApi = {
  list: (params) => api.get("/students", { params }),
  get: (id) => api.get(`/students/${id}`),
  create: (data) => api.post("/students", data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
  resetPassword: (id, data) => api.post(`/students/${id}/reset-password`, data),
  download: (params) =>
    downloadFile("/students/export", { params, fallbackName: "students.xlsx" }),
};

// ── Bulk import ───────────────────────────────────────────────────────────
export const importApi = {
  downloadTemplate: () =>
    downloadFile("/students/import/template", { fallbackName: "sapms-student-template.xlsx" }),
  validate: (formData) =>
    api.post("/students/import/validate", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  confirm: (batchId) => api.post("/students/import/confirm", { batchId }),
  downloadErrorReport: (batchId) =>
    downloadFile(`/students/import/${batchId}/errors`, { fallbackName: "import-errors.csv" }),
};

// ── Projects & ideas ──────────────────────────────────────────────────────
export const projectApi = {
  list: (params) => api.get("/projects", { params }),
  myProjects: () => api.get("/projects/my-projects"),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post("/projects", data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  submitIdea: (projectId, data) => api.post(`/projects/${projectId}/idea`, data),
  reviewIdea: (projectId, data) => api.post(`/projects/${projectId}/idea/review`, data),
  getMentorRecommendation: (projectId) => api.get(`/projects/${projectId}/mentor-recommendation`),
  assignMentor: (projectId, data) => api.post(`/projects/${projectId}/assign-mentor`, data),
};

// ── Milestones ────────────────────────────────────────────────────────────
export const milestoneApi = {
  list: (projectId) => api.get(`/modules/projects/${projectId}/milestones`),
  create: (projectId, data) => api.post(`/modules/projects/${projectId}/milestones`, data),
  createFromTemplate: (projectId) =>
    api.post(`/modules/projects/${projectId}/milestones/from-template`),
  update: (id, data) => api.put(`/modules/milestones/${id}`, data),
  delete: (id) => api.delete(`/modules/milestones/${id}`),
};

// ── Weekly progress ───────────────────────────────────────────────────────
export const progressApi = {
  list: (projectId) => api.get(`/modules/projects/${projectId}/progress`),
  submit: (projectId, data) => api.post(`/modules/projects/${projectId}/progress`, data),
  review: (progressId, data) => api.post(`/modules/progress/${progressId}/review`, data),
  pendingReviews: () => api.get("/modules/pending-reviews"),
  // Evidence is uploaded first; the returned URLs are submitted with the form.
  uploadEvidence: (projectId, formData) =>
    api.post(`/modules/projects/${projectId}/evidence`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};

// ── Documents ─────────────────────────────────────────────────────────────
export const documentApi = {
  list: (projectId) => api.get(`/modules/projects/${projectId}/documents`),
  upload: (projectId, formData) =>
    api.post(`/modules/projects/${projectId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  reviewVersion: (versionId, data) =>
    api.post(`/modules/documents/versions/${versionId}/review`, data),
};

// ── Notifications ─────────────────────────────────────────────────────────
export const notificationApi = {
  list: () => api.get("/notifications"),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (ids) => api.post("/notifications/mark-read", { ids }),
};

// ── Chat ──────────────────────────────────────────────────────────────────
export const chatApi = {
  conversations: () => api.get("/messages/conversations"),
  // People the caller may start a one-to-one thread with.
  contacts: (q) => api.get("/messages/contacts", { params: q ? { q } : undefined }),
  // Idempotent: returns the existing thread if one already exists.
  openDirect: (kind, id) => api.post("/messages/conversations/direct", { kind, id }),
  messages: (conversationId) => api.get(`/messages/conversations/${conversationId}`),
  openForProject: (projectId) => api.post(`/messages/conversations/project/${projectId}`),
  send: (conversationId, formData) =>
    api.post(`/messages/conversations/${conversationId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  markRead: (conversationId) => api.post(`/messages/conversations/${conversationId}/read`),
  unreadCount: () => api.get("/messages/unread-count"),
};

// ── Meetings & presentations ──────────────────────────────────────────────
export const meetingApi = {
  list: (params) => api.get("/meetings", { params }),
  create: (data) => api.post("/meetings", data),
  update: (id, data) => api.put(`/meetings/${id}`, data),
  delete: (id) => api.delete(`/meetings/${id}`),
};

export const presentationApi = {
  list: (params) => api.get("/presentations", { params }),
  get: (id) => api.get(`/presentations/${id}`),
  create: (data) => api.post("/presentations", data),
  update: (id, data) => api.put(`/presentations/${id}`, data),
  delete: (id) => api.delete(`/presentations/${id}`),
};

// ── Evaluation ────────────────────────────────────────────────────────────
export const evaluationApi = {
  list: (params) => api.get("/evaluations", { params }),
  forProject: (projectId) => api.get(`/evaluations/project/${projectId}`),
  submit: (projectId, data) => api.post(`/evaluations/project/${projectId}`, data),
  getCriteria: (subjectId) => api.get(`/evaluations/criteria/${subjectId}`),
  upsertCriteria: (subjectId, criteria) =>
    api.put(`/evaluations/criteria/${subjectId}`, { criteria }),
};

// ── Reports ───────────────────────────────────────────────────────────────
export const reportApi = {
  list: () => api.get("/reports"),
  preview: (key, params) => api.get(`/reports/${key}/preview`, { params }),
  download: (key, params) =>
    downloadFile(`/reports/${key}/download`, { params, fallbackName: `SAPMS-${key}.${params?.format || "pdf"}` }),
};

// ── Analytics ─────────────────────────────────────────────────────────────
export const analyticsApi = {
  adminStats: () => api.get("/analytics/admin/stats"),
  projectStatus: () => api.get("/analytics/admin/project-status"),
  domainDist: () => api.get("/analytics/admin/domain-distribution"),
  mentorWorkload: () => api.get("/analytics/admin/mentor-workload"),
  facultyWorkload: () => api.get("/analytics/admin/faculty-workload"),
  progressTrend: () => api.get("/analytics/admin/progress-trend"),
  subjectStats: () => api.get("/analytics/admin/subject-stats"),
  weeklySubmissions: () => api.get("/analytics/admin/weekly-submissions"),
  recentActivity: () => api.get("/analytics/admin/recent-activity"),
  atRisk: () => api.get("/analytics/admin/at-risk"),
  facultyStats: () => api.get("/analytics/faculty/stats"),
  mentorStats: () => api.get("/analytics/mentor/stats"),
  studentStats: () => api.get("/analytics/student/stats"),
  runMonitor: () => api.post("/analytics/run-monitor"),
  sendReminders: () => api.post("/analytics/send-reminders"),
};

// ── Search & activity ─────────────────────────────────────────────────────
export const searchApi = {
  global: (q) => api.get("/search", { params: { q } }),
};

export const activityApi = {
  list: (params) => api.get("/activity", { params }),
  forProject: (projectId) => api.get(`/activity/project/${projectId}`),
  mine: (params) => api.get("/activity/me", { params }),
};

/**
 * Fetch a protected file through axios (so the bearer token stays in the
 * Authorization header, never in a URL) and hand it to the browser as a
 * download. Returns the filename that was saved.
 */
export async function downloadFile(path, { params, fallbackName = "download" } = {}) {
  const response = await api.get(path, { params, responseType: "blob" });

  // Prefer the server's filename from Content-Disposition.
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = match ? decodeURIComponent(match[1]) : fallbackName;

  const blobUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

  return filename;
}
