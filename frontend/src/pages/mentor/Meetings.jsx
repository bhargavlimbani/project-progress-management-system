import { useState } from "react";
import toast from "react-hot-toast";
import {
  CalendarClock, Plus, Pencil, Trash2, Clock, MapPin, Video, Users,
  ExternalLink, CheckCircle2, XCircle, RotateCcw, Globe
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
  timeZone: "Asia/Kolkata",
  duration: 30,
  type: "IN_PERSON",
  venue: "",
  meetLink: "",
  agenda: "",
};

function toLocalInput(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [completing, setCompleting] = useState(null);
  const [feedback, setFeedback] = useState("");
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
      timeZone: meeting.timeZone || "Asia/Kolkata",
      duration: meeting.duration || 30,
      type: meeting.type,
      venue: meeting.venue || "",
      meetLink: meeting.meetLink || "",
      agenda: meeting.agenda || "",
      rescheduleReason: "",
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
        timeZone: form.timeZone || "Asia/Kolkata",
        venue: form.venue || undefined,
        meetLink: form.meetLink || undefined,
        agenda: form.agenda || undefined,
        rescheduleReason: form.rescheduleReason || undefined,
      };
      if (editing.id) {
        await meetingApi.update(editing.id, payload);
        toast.success("Review / Meeting updated — the team has been notified.");
      } else {
        await meetingApi.create(payload);
        toast.success("Review / Meeting scheduled — multi-channel notifications sent.");
      }
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelling) return;
    try {
      await meetingApi.cancel(cancelling.id, { cancelReason });
      toast.success("Meeting cancelled and team notified.");
      setCancelling(null);
      setCancelReason("");
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const submitComplete = async () => {
    if (!completing) return;
    try {
      await meetingApi.complete(completing.id, { feedback });
      toast.success("Review marked completed with feedback.");
      setCompleting(null);
      setFeedback("");
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
        title="Review Appointments & Meetings"
        subtitle="Schedule and track project milestones and reviews with student teams."
        crumbs={[{ label: "Meetings" }]}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Schedule Review
          </button>
        }
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "upcoming", label: "Upcoming Reviews", icon: CalendarClock },
          { key: "all", label: "All History", icon: Clock },
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
            title={tab === "upcoming" ? "No upcoming reviews scheduled" : "No meetings yet"}
            message="Schedule a milestone review appointment with a project team."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
                <Plus size={14} />
                Schedule Review
              </button>
            }
          />
        </div>
      ) : (
        <div className="card-grid">
          {meetings.map((meeting) => {
            const days = daysUntil(meeting.scheduledAt);
            const isCancelled = meeting.status === "CANCELLED";
            const isCompleted = meeting.status === "COMPLETED";
            const isRescheduled = meeting.status === "RESCHEDULED";
            const soon = days !== null && days >= 0 && days <= 2 && !isCancelled && !isCompleted;

            return (
              <div
                key={meeting.id}
                className="glass-card glass-card-hover"
                style={{
                  padding: 20,
                  opacity: isCancelled ? 0.6 : 1,
                  borderColor: isCancelled
                    ? "rgba(239,68,68,0.3)"
                    : soon
                    ? "rgba(249,115,22,0.35)"
                    : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-3" style={{ flexWrap: "wrap" }}>
                  <StatusBadge
                    tone="blue"
                    label={MEETING_TYPES[meeting.type] || meeting.type}
                    size="sm"
                  />
                  <StatusBadge
                    tone={
                      isCancelled
                        ? "red"
                        : isCompleted
                        ? "green"
                        : isRescheduled
                        ? "orange"
                        : soon
                        ? "orange"
                        : "purple"
                    }
                    label={
                      isCancelled
                        ? "Cancelled"
                        : isCompleted
                        ? "Completed"
                        : isRescheduled
                        ? "Rescheduled"
                        : deadlineLabel(meeting.scheduledAt)
                    }
                    size="sm"
                  />
                </div>

                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>
                  {meeting.title}
                </h3>
                <div
                  className="truncate"
                  style={{ fontSize: "0.8125rem", color: "var(--purple-400)", marginBottom: 12 }}
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

                  <span className="flex items-center gap-2">
                    <Globe size={13} color="var(--slate-500)" />
                    Time Zone: {meeting.timeZone || "Asia/Kolkata"}
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

                {meeting.meetLink && !isCancelled && (
                  <a
                    className="btn btn-secondary btn-sm"
                    href={meeting.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
                  >
                    <Video size={13} />
                    Join Online Meeting
                    <ExternalLink size={11} style={{ opacity: 0.6 }} />
                  </a>
                )}

                {meeting.agenda && (
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--slate-400)",
                      marginTop: 10,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.03)",
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Agenda:</strong> {meeting.agenda}
                  </p>
                )}

                {meeting.feedback && (
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--green-400)",
                      marginTop: 8,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(34,197,94,0.06)",
                      border: "1px solid rgba(34,197,94,0.18)",
                    }}
                  >
                    <strong>Reviewer Feedback:</strong> {meeting.feedback}
                  </p>
                )}

                {meeting.cancelReason && (
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--red-400)",
                      marginTop: 8,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "rgba(239,68,68,0.06)",
                    }}
                  >
                    <strong>Cancelled:</strong> {meeting.cancelReason}
                  </p>
                )}

                {!isCancelled && !isCompleted && (
                  <div
                    className="flex gap-2"
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEdit(meeting)}
                    >
                      <RotateCcw size={13} />
                      Reschedule / Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setCompleting(meeting)}
                    >
                      <CheckCircle2 size={13} />
                      Complete Review
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setCancelling(meeting)}
                    >
                      <XCircle size={13} />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule / Reschedule Modal */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Reschedule / Edit Review" : "Schedule Project Review"}
        width={580}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="meeting-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing?.id ? "Confirm Schedule" : "Schedule Review"}
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
              <label className="form-label">Review Title / Milestone</label>
              <input
                className="form-input"
                required
                placeholder="e.g. Mid-Semester Progress Review 1"
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
              <label className="form-label">Time Zone</label>
              <input
                className="form-input"
                value={form.timeZone}
                onChange={(e) => setForm((f) => ({ ...f, timeZone: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <input
                className="form-input"
                type="number"
                min={5}
                max={480}
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Meeting Type</label>
              <select
                className="form-input"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="IN_PERSON">In Person</option>
                <option value="ONLINE">Online</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>

            {form.type !== "ONLINE" && (
              <div className="form-group form-grid-full">
                <label className="form-label">Venue / Room</label>
                <input
                  className="form-input"
                  placeholder="e.g. Lab 402, ICT Building"
                  value={form.venue}
                  onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
                />
              </div>
            )}

            {needsLink && (
              <div className="form-group form-grid-full">
                <label className="form-label">Meeting Link</label>
                <input
                  className="form-input"
                  type="url"
                  placeholder="https://meet.google.com/..."
                  value={form.meetLink}
                  onChange={(e) => setForm((f) => ({ ...f, meetLink: e.target.value }))}
                />
              </div>
            )}

            {editing?.id && (
              <div className="form-group form-grid-full">
                <label className="form-label">Rescheduling Reason</label>
                <input
                  className="form-input"
                  placeholder="e.g. Shifted due to departmental seminar"
                  value={form.rescheduleReason || ""}
                  onChange={(e) => setForm((f) => ({ ...f, rescheduleReason: e.target.value }))}
                />
              </div>
            )}

            <div className="form-group form-grid-full">
              <label className="form-label">Agenda & Review Points</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="Key deliverables to review (SRS, Architecture diagrams, code demonstration)..."
                value={form.agenda}
                onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Complete Review Modal */}
      <Modal
        open={completing !== null}
        onClose={() => setCompleting(null)}
        title="Complete Project Review"
        width={500}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCompleting(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={submitComplete}>
              Mark Completed
            </button>
          </>
        }
      >
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: "0.85rem", color: "var(--slate-300)", marginBottom: 12 }}>
            Record review feedback and assessment notes for <strong>{completing?.title}</strong>.
            This feedback will be recorded on the project and notified to team members.
          </p>
          <label className="form-label">Reviewer Feedback & Remarks</label>
          <textarea
            className="form-input"
            rows={4}
            required
            placeholder="e.g. Good progress on frontend authentication. API error handling needs improvement before next week..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>
      </Modal>

      {/* Cancel Review Modal */}
      <Modal
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title="Cancel Review Appointment"
        width={480}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCancelling(null)}>
              Keep Appointment
            </button>
            <button type="button" className="btn btn-danger" onClick={submitCancel}>
              Confirm Cancellation
            </button>
          </>
        }
      >
        <div>
          <p style={{ fontSize: "0.85rem", color: "var(--slate-300)", marginBottom: 12 }}>
            Are you sure you want to cancel <strong>{cancelling?.title}</strong>? Team members will be notified.
          </p>
          <label className="form-label">Cancellation Reason</label>
          <input
            className="form-input"
            required
            placeholder="e.g. University holiday / Rescheduled by mutual agreement"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
