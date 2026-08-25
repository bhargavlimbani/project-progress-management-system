import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CalendarRange, Sparkles, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { milestoneApi } from "../../services/index.js";
import { apiErrorMessage } from "../../utils/format.js";
import {
  EmptyState, Modal, ConfirmationDialog, SkeletonCard, StatusBadge,
} from "../../components/ui/index.js";
import Timeline from "../../components/project/Timeline.jsx";
import MilestoneCard from "../../components/project/MilestoneCard.jsx";

const emptyMilestone = {
  weekNumber: 1,
  title: "",
  description: "",
  weight: 0,
  requiredEvidence: "",
  startDate: "",
  endDate: "",
};

/** Project timeline: the milestone list, its weights, and its review state. */
export default function TimelineTab({ project, refetch, user }) {
  const canManage = user?.role === "ADMIN" || user?.role === "FACULTY";
  const canReview = canManage || user?.role === "MENTOR";

  const [milestones, setMilestones] = useState(project.milestones || []);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyMilestone);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await milestoneApi.list(project.id);
      setMilestones(Array.isArray(data) ? data : data.milestones || []);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!project.milestones?.length) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const seedFromTemplate = async () => {
    setSeeding(true);
    try {
      await milestoneApi.createFromTemplate(project.id);
      toast.success("Timeline created from the subject's template.");
      await load();
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSeeding(false);
    }
  };

  const openCreate = () => {
    const nextWeek = Math.max(0, ...milestones.map((m) => m.weekNumber)) + 1;
    setForm({ ...emptyMilestone, weekNumber: nextWeek });
    setEditing({});
  };

  const openEdit = (milestone) => {
    setForm({
      weekNumber: milestone.weekNumber,
      title: milestone.title,
      description: milestone.description || "",
      weight: milestone.weight || 0,
      requiredEvidence: milestone.requiredEvidence || "",
      startDate: milestone.startDate?.slice(0, 10) || "",
      endDate: milestone.endDate?.slice(0, 10) || "",
      status: milestone.status,
    });
    setEditing(milestone);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        weekNumber: Number(form.weekNumber),
        weight: Number(form.weight),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      if (editing.id) {
        await milestoneApi.update(editing.id, payload);
        toast.success("Milestone updated.");
      } else {
        await milestoneApi.create(project.id, payload);
        toast.success("Milestone added.");
      }
      setEditing(null);
      await load();
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const markComplete = async (milestone) => {
    try {
      await milestoneApi.update(milestone.id, {
        status: "APPROVED",
        completedAt: new Date().toISOString(),
      });
      toast.success(`Week ${milestone.weekNumber} marked complete.`);
      await load();
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    try {
      await milestoneApi.delete(deleting.id);
      toast.success("Milestone deleted.");
      setDeleting(null);
      await load();
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const totalWeight = milestones.reduce((s, m) => s + Number(m.weight || 0), 0);
  const completed = milestones.filter((m) => m.status === "APPROVED").length;

  if (loading) {
    return (
      <div className="card-grid">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} height={170} />
        ))}
      </div>
    );
  }

  if (!milestones.length) {
    return (
      <div className="glass-card">
        <EmptyState
          icon={CalendarRange}
          title="No timeline yet"
          message={
            canManage
              ? "Generate the timeline from this subject's milestone template, or add milestones one at a time."
              : "The faculty hasn't set up this project's timeline yet."
          }
          action={
            canManage && (
              <div className="flex gap-2" style={{ flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={seedFromTemplate}
                  disabled={seeding}
                >
                  {seeding ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                  Generate from template
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={openCreate}>
                  <Plus size={14} />
                  Add milestone
                </button>
              </div>
            )
          }
        />
      </div>
    );
  }

  return (
    <>
      <div
        className="flex items-center justify-between mb-4"
        style={{ gap: 12, flexWrap: "wrap" }}
      >
        <div className="flex items-center gap-3" style={{ flexWrap: "wrap" }}>
          <span className="badge badge-purple">
            {completed} of {milestones.length} complete
          </span>
          <span
            className={`badge badge-${Math.abs(totalWeight - 100) < 0.5 ? "green" : "yellow"}`}
          >
            {totalWeight.toFixed(1)}% total weight
          </span>
        </div>

        {canManage && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={openCreate}>
            <Plus size={14} />
            Add milestone
          </button>
        )}
      </div>

      <div className="split-grid">
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: 20 }}>
            Week-by-week plan
          </h3>
          <Timeline milestones={milestones} currentWeek={project.currentWeek} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {milestones
            .filter((m) => m.status !== "APPROVED")
            .slice(0, 4)
            .map((milestone) => (
              <div key={milestone.id}>
                <MilestoneCard
                  milestone={milestone}
                  currentWeek={project.currentWeek}
                  onEdit={canManage ? openEdit : undefined}
                  onDelete={canManage ? setDeleting : undefined}
                />
                {canReview && milestone.status !== "APPROVED" && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
                    onClick={() => markComplete(milestone)}
                  >
                    <CheckCircle2 size={14} />
                    Mark Week {milestone.weekNumber} complete
                  </button>
                )}
              </div>
            ))}

          {milestones.every((m) => m.status === "APPROVED") && (
            <div className="glass-card" style={{ padding: 20 }}>
              <EmptyState
                compact
                icon={CheckCircle2}
                title="Every milestone approved"
                message="This project has completed its whole timeline."
              />
            </div>
          )}
        </div>
      </div>

      {/* Create / edit */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? `Edit Week ${editing.weekNumber} milestone` : "Add Milestone"}
        width={560}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="milestone-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing?.id ? "Save Changes" : "Add Milestone"}
            </button>
          </>
        }
      >
        <form id="milestone-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Week Number</label>
              <input
                className="form-input"
                type="number"
                min={1}
                max={52}
                required
                value={form.weekNumber}
                onChange={(e) => setForm((f) => ({ ...f, weekNumber: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Weight (%)</label>
              <input
                className="form-input"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.weight}
                onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              />
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label">Title</label>
              <input
                className="form-input"
                required
                placeholder="e.g. System Design"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="What has to be delivered this week?"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input
                className="form-input"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                className="form-input"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label">Required Evidence</label>
              <input
                className="form-input"
                placeholder="e.g. ER diagram + schema screenshot"
                value={form.requiredEvidence}
                onChange={(e) => setForm((f) => ({ ...f, requiredEvidence: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete "${deleting?.title}"?`}
        message="Weekly submissions linked to this milestone will lose the link, but won't be deleted."
        confirmLabel="Delete Milestone"
      />
    </>
  );
}
