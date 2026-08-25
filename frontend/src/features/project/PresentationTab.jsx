import { useState } from "react";
import toast from "react-hot-toast";
import {
  Presentation as PresentationIcon, Plus, Clock, MapPin, Users, CalendarClock,
} from "lucide-react";
import { presentationApi, meetingApi } from "../../services/index.js";
import { apiErrorMessage, formatDateTime, deadlineLabel, daysUntil } from "../../utils/format.js";
import { PRESENTATION_TYPES, MEETING_TYPES } from "../../utils/constants.js";
import { EmptyState, Modal, StatusBadge } from "../../components/ui/index.js";

/** Presentations and mentor meetings scheduled for this project (§49). */
export default function PresentationTab({ project, refetch, user }) {
  const canSchedulePresentation = user?.role === "ADMIN" || user?.role === "FACULTY";
  const canScheduleMeeting = canSchedulePresentation || user?.role === "MENTOR";

  const [scheduling, setScheduling] = useState(null); // "presentation" | "meeting"

  const presentations = [...(project.presentations || [])].sort(
    (a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)
  );
  const meetings = [...(project.meetings || [])].sort(
    (a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt)
  );

  return (
    <>
      <div className="flex items-center justify-between mb-4" style={{ gap: 10, flexWrap: "wrap" }}>
        <span className="badge badge-purple">
          {presentations.length} presentation{presentations.length === 1 ? "" : "s"} ·{" "}
          {meetings.length} meeting{meetings.length === 1 ? "" : "s"}
        </span>

        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          {canScheduleMeeting && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setScheduling("meeting")}
            >
              <CalendarClock size={14} />
              Schedule Meeting
            </button>
          )}
          {canSchedulePresentation && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setScheduling("presentation")}
            >
              <Plus size={14} />
              Schedule Presentation
            </button>
          )}
        </div>
      </div>

      <div className="split-grid">
        {/* Presentations */}
        <div>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: 12 }}>
            Presentations
          </h3>

          {!presentations.length ? (
            <div className="glass-card">
              <EmptyState
                compact
                icon={PresentationIcon}
                title="Nothing scheduled"
                message="Reviews, demos and the final presentation will show up here."
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {presentations.map((p) => {
                const days = daysUntil(p.scheduledAt);
                const past = days !== null && days < 0;
                return (
                  <div
                    key={p.id}
                    className="glass-card"
                    style={{ padding: 18, opacity: past ? 0.7 : 1 }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2" style={{ flexWrap: "wrap" }}>
                      <h4 style={{ fontSize: "0.9375rem", fontWeight: 700 }}>{p.title}</h4>
                      <StatusBadge
                        tone={past ? "gray" : days <= 3 ? "orange" : "blue"}
                        label={past ? "Completed" : deadlineLabel(p.scheduledAt)}
                        size="sm"
                      />
                    </div>

                    <StatusBadge
                      tone="purple"
                      label={PRESENTATION_TYPES[p.type] || p.type}
                      size="sm"
                    />

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        marginTop: 12,
                        fontSize: "0.78rem",
                        color: "var(--slate-300)",
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Clock size={13} color="var(--slate-500)" />
                        {formatDateTime(p.scheduledAt)}
                      </span>
                      {p.venue && (
                        <span className="flex items-center gap-2">
                          <MapPin size={13} color="var(--slate-500)" />
                          {p.venue}
                        </span>
                      )}
                      {p.panelMembers && (
                        <span className="flex items-center gap-2">
                          <Users size={13} color="var(--slate-500)" />
                          {p.panelMembers}
                        </span>
                      )}
                    </div>

                    {p.notes && (
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--slate-400)",
                          marginTop: 11,
                          padding: "8px 11px",
                          borderRadius: 9,
                          background: "rgba(255,255,255,0.03)",
                          lineHeight: 1.55,
                        }}
                      >
                        {p.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Meetings */}
        <div>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: 12 }}>
            Mentor Meetings
          </h3>

          {!meetings.length ? (
            <div className="glass-card">
              <EmptyState
                compact
                icon={CalendarClock}
                title="No meetings yet"
                message="Check-ins scheduled by your mentor appear here."
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {meetings.map((m) => {
                const days = daysUntil(m.scheduledAt);
                const past = days !== null && days < 0;
                return (
                  <div
                    key={m.id}
                    className="glass-card"
                    style={{ padding: 16, opacity: past ? 0.7 : 1 }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2" style={{ flexWrap: "wrap" }}>
                      <h4 style={{ fontSize: "0.875rem", fontWeight: 700 }}>{m.title}</h4>
                      <StatusBadge
                        tone={past ? "gray" : "blue"}
                        label={MEETING_TYPES[m.type] || m.type}
                        size="sm"
                      />
                    </div>

                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--slate-300)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Clock size={12} color="var(--slate-500)" />
                        {formatDateTime(m.scheduledAt)}
                        {m.duration ? ` · ${m.duration} min` : ""}
                      </span>
                      {m.venue && (
                        <span className="flex items-center gap-2">
                          <MapPin size={12} color="var(--slate-500)" />
                          {m.venue}
                        </span>
                      )}
                      {m.meetLink && (
                        <a
                          href={m.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="evidence-chip"
                          style={{ alignSelf: "flex-start", marginTop: 3 }}
                        >
                          Join meeting
                        </a>
                      )}
                    </div>

                    {m.agenda && (
                      <p style={{ fontSize: "0.75rem", color: "var(--slate-400)", marginTop: 9 }}>
                        {m.agenda}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {scheduling && (
        <ScheduleModal
          kind={scheduling}
          project={project}
          onClose={() => setScheduling(null)}
          onDone={() => {
            setScheduling(null);
            refetch();
          }}
        />
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function ScheduleModal({ kind, project, onClose, onDone }) {
  const isPresentation = kind === "presentation";

  const [form, setForm] = useState({
    title: "",
    scheduledAt: "",
    venue: "",
    panelMembers: "",
    type: isPresentation ? "INTERNAL" : "IN_PERSON",
    notes: "",
    agenda: "",
    duration: 30,
    meetLink: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const base = {
        projectId: project.id,
        title: form.title,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        type: form.type,
      };

      if (isPresentation) {
        await presentationApi.create({
          ...base,
          venue: form.venue || undefined,
          panelMembers: form.panelMembers || undefined,
          notes: form.notes || undefined,
        });
        toast.success("Presentation scheduled — the team has been notified.");
      } else {
        await meetingApi.create({
          ...base,
          duration: Number(form.duration) || undefined,
          venue: form.venue || undefined,
          meetLink: form.meetLink || undefined,
          agenda: form.agenda || undefined,
        });
        toast.success("Meeting scheduled — the team has been notified.");
      }
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isPresentation ? "Schedule Presentation" : "Schedule Meeting"}
      subtitle={project.title}
      width={560}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="schedule-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Scheduling…" : "Schedule"}
          </button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="form-group form-grid-full">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              required
              placeholder={isPresentation ? "Mid-semester Internal Review" : "Week 6 check-in"}
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
            <label className="form-label">Type</label>
            <select
              className="form-input"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {Object.entries(isPresentation ? PRESENTATION_TYPES : MEETING_TYPES).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </div>

          {!isPresentation && (
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
          )}

          <div className="form-group">
            <label className="form-label">
              Venue
              {!isPresentation && form.type === "IN_PERSON" && (
                <span style={{ color: "var(--red-400)" }}> (required)</span>
              )}
            </label>
            <input
              className="form-input"
              required={!isPresentation && form.type === "IN_PERSON"}
              placeholder="Lab 302"
              value={form.venue}
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
            />
          </div>

          {!isPresentation && (form.type === "ONLINE" || form.type === "HYBRID") && (
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

          {isPresentation && (
            <div className="form-group form-grid-full">
              <label className="form-label">Panel Members</label>
              <input
                className="form-input"
                placeholder="Comma-separated names"
                value={form.panelMembers}
                onChange={(e) => setForm((f) => ({ ...f, panelMembers: e.target.value }))}
              />
            </div>
          )}

          <div className="form-group form-grid-full">
            <label className="form-label">{isPresentation ? "Notes" : "Agenda"}</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="What should the team prepare?"
              value={isPresentation ? form.notes : form.agenda}
              onChange={(e) =>
                setForm((f) =>
                  isPresentation ? { ...f, notes: e.target.value } : { ...f, agenda: e.target.value }
                )
              }
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
