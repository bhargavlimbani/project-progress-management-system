import { useState } from "react";
import toast from "react-hot-toast";
import {
  CalendarClock, Plus, Pencil, Trash2, Clock, MapPin, Video, Users, ExternalLink,
} from "lucide-react";
import { meetingApi, projectApi } from "../../services/index.js";
import { useApi, useApiAll } from "../../hooks/useApi.js";
import {
  apiErrorMessage, formatDateTime, deadlineLabel, daysUntil,
} from "../../utils/format.js";
import { MEETING_TYPES } from "../../utils/constants.js";
import {
  PageHeader, Modal, ConfirmationDialog, EmptyState, SkeletonCard, StatusBadge, Tabs,
} from "../../components/ui/index.js";

const emptyForm = {
  projectId: "",
  title: "",
  scheduledAt: "",
  duration: 30,
  type: "IN_PERSON",
  venue: "",
  meetLink: "",
  agenda: "",
};

/** Mentor check-ins with their teams. */
export default function Meetings() {
  const [tab, setTab] = useState("upcoming");

  const { data, loading, refetch } = useApi(
    () => meetingApi.list({ upcoming: tab === "upcoming" ? "true" : undefined, limit: 100 }),
    [tab],
    { initialData: { data: [] } }
  );

  const { data: meta } = useApiAll({ projects: () => projectApi.list({ limit: 200 }) }, []);
  const projects = meta.projects?.projects || [];
  const meetings = data?.data || [];

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing({});
  };

  const openEdit = (meeting) => {
    setForm({
      projectId: meeting.projectId,
      title: meeting.title,
      scheduledAt: toLocalInput(meeting.scheduledAt),
      duration: meeting.duration || 30,
      type: meeting.type,
      venue: meeting.venue || "",
      meetLink: meeting.meetLink || "",
      agenda: meeting.agenda || "",
    });
    setEditing(meeting);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        duration: Number(form.duration) || undefined,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        venue: form.venue || undefined,
        meetLink: form.meetLink || undefined,
        agenda: form.agenda || undefined,
      };
      if (editing.id) {
        await meetingApi.update(editing.id, payload);
        toast.success("Meeting updated — the team has been notified.");
      } else {
        await meetingApi.create(payload);
        toast.success("Meeting scheduled — the team has been notified.");
      }
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await meetingApi.delete(deleting.id);
      toast.success("Meeting cancelled.");
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const needsLink = form.type === "ONLINE" || form.type === "HYBRID";

  return (
    <>
      <PageHeader
        icon={CalendarClock}
        title="Meetings"
        subtitle="Check-ins with the teams you mentor — everyone is notified when you schedule one."
        crumbs={[{ label: "Meetings" }]}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Schedule Meeting
          </button>
        }
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "upcoming", label: "Upcoming", icon: CalendarClock },
          { key: "all", label: "All", icon: Clock },
        ]}
      />

      {loading ? (
        <div className="card-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} height={190} />
          ))}
        </div>
      ) : !meetings.length ? (
        <div className="glass-card">
          <EmptyState
            icon={CalendarClock}
            title={tab === "upcoming" ? "No upcoming meetings" : "No meetings yet"}
            message="Schedule a check-in with a team to keep their weekly progress on track."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
                <Plus size={14} />
                Schedule Meeting
              </button>
            }
          />
        </div>
      ) : (
        <div className="card-grid">
          {meetings.map((meeting) => {
            const days = daysUntil(meeting.scheduledAt);
            const past = days !== null && days < 0;
            const soon = days !== null && days >= 0 && days <= 2;

            return (
              <div
                key={meeting.id}
                className="glass-card glass-card-hover"
                style={{
                  padding: 20,
                  opacity: past ? 0.7 : 1,
                  borderColor: soon ? "rgba(249,115,22,0.3)" : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3" style={{ flexWrap: "wrap" }}>
                  <StatusBadge
                    tone="blue"
                    label={MEETING_TYPES[meeting.type] || meeting.type}
                    size="sm"
                  />
                  <StatusBadge
                    tone={past ? "gray" : soon ? "orange" : "purple"}
                    label={past ? "Completed" : deadlineLabel(meeting.scheduledAt)}
                    size="sm"
                  />
                </div>

                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>
                  {meeting.title}
                </h3>
                <div
                  className="truncate"
                  style={{ fontSize: "0.8125rem", color: "var(--purple-400)", marginBottom: 14 }}
                >
                  {meeting.project?.title}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 7,
                    fontSize: "0.78rem",
                    color: "var(--slate-300)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Clock size={13} color="var(--slate-500)" />
                    {formatDateTime(meeting.scheduledAt)}
                    {meeting.duration ? ` · ${meeting.duration} min` : ""}
                  </span>

                  {meeting.venue && (
                    <span className="flex items-center gap-2">
                      <MapPin size={13} color="var(--slate-500)" />
                      {meeting.venue}
                    </span>
                  )}

                  {meeting.project?.members?.length > 0 && (
                    <span className="flex items-center gap-2">
                      <Users size={13} color="var(--slate-500)" />
                      <span className="truncate">
                        {meeting.project.members.map((m) => m.student.name).join(", ")}
                      </span>
                    </span>
                  )}
                </div>

                {meeting.meetLink && (
                  <a
                    className="btn btn-secondary btn-sm"
                    href={meeting.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
                  >
                    <Video size={13} />
                    Join meeting
                    <ExternalLink size={11} style={{ opacity: 0.6 }} />
                  </a>
                )}

                {meeting.agenda && (
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--slate-400)",
                      marginTop: 12,
                      padding: "9px 11px",
                      borderRadius: 9,
                      background: "rgba(255,255,255,0.03)",
                      lineHeight: 1.55,
                    }}
                  >
                    {meeting.agenda}
                  </p>
                )}

                <div
                  className="flex gap-2"
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEdit(meeting)}
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleting(meeting)}
                  >
                    <Trash2 size={13} />
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule / edit */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit Meeting" : "Schedule Meeting"}
        width={580}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="meeting-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing?.id ? "Save Changes" : "Schedule"}
            </button>
          </>
        }
      >
        <form id="meeting-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group form-grid-full">
              <label className="form-label">Project</label>
              <select
                className="form-input"
                required
                disabled={Boolean(editing?.id)}
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {p.members?.map((m) => m.student.name).join(", ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label">Title</label>
              <input
                className="form-input"
                required
                placeholder="e.g. Week 6 check-in"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Date & Time</label>
              <input
                className="form-input"
                type="datetime-local"
                required
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <input
                className="form-input"
                type="number"
                min={5}
                max={600}
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Type</label>
              <select
                className="form-input"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {Object.entries(MEETING_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Venue
                {form.type === "IN_PERSON" && (
                  <span style={{ color: "var(--red-400)" }}> (required)</span>
                )}
              </label>
              <input
                className="form-input"
                required={form.type === "IN_PERSON"}
                placeholder="Lab 302"
                value={form.venue}
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
              />
            </div>

            {needsLink && (
              <div className="form-group form-grid-full">
                <label className="form-label">
                  Meeting Link <span style={{ color: "var(--red-400)" }}>(required)</span>
                </label>
                <input
                  className="form-input"
                  type="url"
                  required
                  placeholder="https://meet.google.com/…"
                  value={form.meetLink}
                  onChange={(e) => setForm((f) => ({ ...f, meetLink: e.target.value }))}
                />
              </div>
            )}

            <div className="form-group form-grid-full">
              <label className="form-label">Agenda</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="What will you cover? What should the team bring?"
                value={form.agenda}
                onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Cancel this meeting?"
        message={`"${deleting?.title}" will be removed. Message the team directly if they need to know.`}
        confirmLabel="Cancel Meeting"
      />
    </>
  );
}

/** ISO string → the local "YYYY-MM-DDTHH:mm" a datetime-local input expects. */
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
