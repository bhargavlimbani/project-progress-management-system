import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Presentation as PresentationIcon, Plus, Pencil, Trash2, MapPin, Users, Clock, CalendarDays,
} from "lucide-react";
import { presentationApi, projectApi } from "../../services/index.js";
import { useApi, useApiAll } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiErrorMessage, formatDateTime, deadlineLabel, daysUntil } from "../../utils/format.js";
import { PRESENTATION_TYPES } from "../../utils/constants.js";
import {
  PageHeader, Modal, ConfirmationDialog, EmptyState, SkeletonCard, StatusBadge, Tabs,
} from "../../components/ui/index.js";

const emptyForm = {
  projectId: "",
  title: "",
  scheduledAt: "",
  venue: "",
  panelMembers: "",
  type: "INTERNAL",
  notes: "",
};

/**
 * Presentation scheduling (spec §49). Admin and faculty can schedule; mentors
 * and students see the same list read-only. Scoping is enforced server-side.
 */
export default function Presentations() {
  const { user } = useAuth();
  const canSchedule = user?.role === "ADMIN" || user?.role === "FACULTY";

  const [tab, setTab] = useState("upcoming");

  const { data, loading, refetch } = useApi(
    () => presentationApi.list({ upcoming: tab === "upcoming" ? "true" : undefined, limit: 100 }),
    [tab],
    { initialData: { data: [] } }
  );

  const { data: meta } = useApiAll(
    canSchedule ? { projects: () => projectApi.list({ limit: 200 }) } : {},
    [canSchedule]
  );

  const projects = meta.projects?.data || meta.projects || [];
  const presentations = data?.data || [];

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing({});
  };

  const openEdit = (presentation) => {
    setForm({
      projectId: presentation.projectId,
      title: presentation.title,
      // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
      scheduledAt: toLocalInput(presentation.scheduledAt),
      venue: presentation.venue || "",
      panelMembers: presentation.panelMembers || "",
      type: presentation.type,
      notes: presentation.notes || "",
    });
    setEditing(presentation);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, scheduledAt: new Date(form.scheduledAt).toISOString() };
      if (editing.id) {
        await presentationApi.update(editing.id, payload);
        toast.success("Presentation updated — the team has been notified.");
      } else {
        await presentationApi.create(payload);
        toast.success("Presentation scheduled — the team has been notified.");
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
      await presentationApi.delete(deleting.id);
      toast.success("Presentation cancelled.");
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        icon={PresentationIcon}
        title="Presentations"
        subtitle={
          canSchedule
            ? "Schedule reviews, demos and vivas — students are notified automatically."
            : "Your scheduled reviews, demos and vivas."
        }
        crumbs={[{ label: "Presentations" }]}
        actions={
          canSchedule && (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Schedule Presentation
            </button>
          )
        }
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "upcoming", label: "Upcoming", icon: CalendarDays },
          { key: "all", label: "All", icon: PresentationIcon },
        ]}
      />

      {loading ? (
        <div className="card-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} height={200} />
          ))}
        </div>
      ) : !presentations.length ? (
        <div className="glass-card">
          <EmptyState
            icon={PresentationIcon}
            title={tab === "upcoming" ? "No upcoming presentations" : "No presentations yet"}
            message={
              canSchedule
                ? "Schedule an internal review, demo or final presentation for a project."
                : "Presentations scheduled for your projects will appear here."
            }
            action={
              canSchedule && (
                <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
                  <Plus size={14} />
                  Schedule Presentation
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="card-grid">
          {presentations.map((p) => (
            <PresentationCard
              key={p.id}
              presentation={p}
              canManage={canSchedule}
              onEdit={() => openEdit(p)}
              onDelete={() => setDeleting(p)}
            />
          ))}
        </div>
      )}

      {/* Schedule / edit */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit Presentation" : "Schedule Presentation"}
        subtitle="Everyone on the project receives a notification."
        width={620}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="presentation-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing?.id ? "Save Changes" : "Schedule"}
            </button>
          </>
        }
      >
        <form id="presentation-form" onSubmit={submit}>
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
                    {p.title} — {p.subject?.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label">Title</label>
              <input
                className="form-input"
                required
                placeholder="e.g. Mid-semester Internal Review"
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
                {Object.entries(PRESENTATION_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Venue</label>
              <input
                className="form-input"
                placeholder="e.g. Lab 302 / Seminar Hall"
                value={form.venue}
                onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Panel Members</label>
              <input
                className="form-input"
                placeholder="Comma-separated names"
                value={form.panelMembers}
                onChange={(e) => setForm((f) => ({ ...f, panelMembers: e.target.value }))}
              />
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label">Notes for the team (optional)</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="What should students prepare or bring?"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Cancel this presentation?"
        message={`"${deleting?.title}" will be removed. The team is not automatically told it was cancelled — message them if it matters.`}
        confirmLabel="Cancel Presentation"
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function PresentationCard({ presentation, canManage, onEdit, onDelete }) {
  const days = daysUntil(presentation.scheduledAt);
  const isPast = days !== null && days < 0;
  const isSoon = days !== null && days >= 0 && days <= 3;

  const students = presentation.project?.members?.map((m) => m.student.name).join(", ");

  return (
    <div
      className="glass-card glass-card-hover"
      style={{
        padding: 20,
        opacity: isPast ? 0.68 : 1,
        borderColor: isSoon ? "rgba(249,115,22,0.3)" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <StatusBadge
          tone="purple"
          label={PRESENTATION_TYPES[presentation.type] || presentation.type}
          size="sm"
        />
        <StatusBadge
          tone={isPast ? "gray" : isSoon ? "orange" : "blue"}
          label={isPast ? "Completed" : deadlineLabel(presentation.scheduledAt)}
          size="sm"
        />
      </div>

      <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>{presentation.title}</h3>
      <div className="truncate" style={{ fontSize: "0.8125rem", color: "var(--purple-400)", marginBottom: 14 }}>
        {presentation.project?.title}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.78rem" }}>
        <div className="flex items-center gap-2" style={{ color: "var(--slate-300)" }}>
          <Clock size={13} color="var(--slate-500)" />
          {formatDateTime(presentation.scheduledAt)}
        </div>

        {presentation.venue && (
          <div className="flex items-center gap-2" style={{ color: "var(--slate-300)" }}>
            <MapPin size={13} color="var(--slate-500)" />
            {presentation.venue}
          </div>
        )}

        {students && (
          <div className="flex items-center gap-2" style={{ color: "var(--slate-300)" }}>
            <Users size={13} color="var(--slate-500)" />
            <span className="truncate">{students}</span>
          </div>
        )}

        {presentation.panelMembers && (
          <div style={{ color: "var(--slate-500)", fontSize: "0.72rem" }}>
            Panel: {presentation.panelMembers}
          </div>
        )}
      </div>

      {presentation.notes && (
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
          {presentation.notes}
        </p>
      )}

      {canManage && (
        <div
          className="flex gap-2"
          style={{ marginTop: 16, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
            <Pencil size={13} />
            Edit
          </button>
          <button type="button" className="btn btn-danger btn-sm" onClick={onDelete}>
            <Trash2 size={13} />
            Cancel
          </button>
        </div>
      )}
    </div>
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
