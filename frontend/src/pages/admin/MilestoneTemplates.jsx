import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  ClipboardCheck, Sparkles, Plus, Trash2, CalendarDays, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { subjectApi } from "../../services/index.js";
import { useApi } from "../../hooks/useApi.js";
import { apiErrorMessage } from "../../utils/format.js";
import { DEFAULT_MILESTONE_TEMPLATE } from "../../utils/constants.js";
import {
  PageHeader, EmptyState, SkeletonCard, Modal, ProgressBar,
} from "../../components/ui/index.js";

/**
 * Timeline templates per subject (spec §35). Each subject defines the weeks,
 * titles and weights that seed every new project's milestone list — duration
 * is configurable, never hard-coded to 12 weeks.
 */
export default function MilestoneTemplates() {
  const { data: subjects, loading } = useApi(() => subjectApi.list(), [], { initialData: [] });
  const [templates, setTemplates] = useState({});
  const [editing, setEditing] = useState(null);

  // Load every subject's template so the overview can show real weight totals.
  useEffect(() => {
    if (!subjects?.length) return;
    let active = true;

    Promise.allSettled(subjects.map((s) => subjectApi.getMilestoneTemplates(s.id))).then(
      (results) => {
        if (!active) return;
        const next = {};
        results.forEach((r, i) => {
          if (r.status === "fulfilled") {
            const payload = r.value.data;
            next[subjects[i].id] = Array.isArray(payload) ? payload : payload?.templates || [];
          } else {
            next[subjects[i].id] = [];
          }
        });
        setTemplates(next);
      }
    );

    return () => {
      active = false;
    };
  }, [subjects]);

  const saveTemplate = (subjectId, rows) => setTemplates((t) => ({ ...t, [subjectId]: rows }));

  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        title="Timeline & Milestones"
        subtitle="The week-by-week plan each subject hands to every new project."
        crumbs={[{ label: "Admin", to: "/admin" }, { label: "Timeline / Milestones" }]}
      />

      {loading ? (
        <div className="card-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} height={220} />
          ))}
        </div>
      ) : !subjects?.length ? (
        <div className="glass-card">
          <EmptyState
            icon={ClipboardCheck}
            title="No subjects to configure"
            message="Milestone templates belong to a subject. Create your project-based subjects first."
            action={
              <a href="/admin/subjects" className="btn btn-primary btn-sm">
                Go to Subjects
              </a>
            }
          />
        </div>
      ) : (
        <div className="card-grid">
          {subjects.map((subject) => {
            const rows = templates[subject.id] || [];
            const totalWeight = rows.reduce((s, m) => s + Number(m.weight || 0), 0);
            const balanced = Math.abs(totalWeight - 100) < 0.5;

            return (
              <div key={subject.id} className="glass-card glass-card-hover" style={{ padding: 20 }}>
                <div className="flex items-start justify-between mb-4">
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700 }} className="truncate">
                      {subject.name}
                    </h3>
                    <div style={{ fontSize: "0.72rem", color: "var(--purple-400)", marginTop: 2 }}>
                      {subject.code} · Semester {subject.semester?.number}
                    </div>
                  </div>

                  <span
                    className="flex items-center gap-1"
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--slate-400)",
                      background: "rgba(255,255,255,0.05)",
                      padding: "4px 9px",
                      borderRadius: 99,
                      flexShrink: 0,
                    }}
                  >
                    <CalendarDays size={11} />
                    {subject.durationWeeks} wks
                  </span>
                </div>

                {rows.length === 0 ? (
                  <div
                    style={{
                      padding: "16px 0",
                      fontSize: "0.8125rem",
                      color: "var(--yellow-400)",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <AlertTriangle size={15} />
                    No timeline configured yet
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <div
                        className="flex items-center justify-between"
                        style={{ fontSize: "0.75rem", marginBottom: 6 }}
                      >
                        <span style={{ color: "var(--slate-400)" }}>
                          {rows.length} milestone{rows.length === 1 ? "" : "s"}
                        </span>
                        <span
                          className="flex items-center gap-1"
                          style={{
                            fontWeight: 700,
                            color: balanced ? "var(--green-400)" : "var(--yellow-400)",
                          }}
                        >
                          {balanced ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          {totalWeight.toFixed(1)}%
                        </span>
                      </div>
                      <ProgressBar
                        value={Math.min(100, totalWeight)}
                        height={5}
                        variant={balanced ? "completed" : "at-risk"}
                      />
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                      {rows.slice(0, 5).map((m) => (
                        <span
                          key={m.id || m.weekNumber}
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 600,
                            color: "var(--slate-300)",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.07)",
                            padding: "3px 8px",
                            borderRadius: 99,
                          }}
                        >
                          W{m.weekNumber} {m.title}
                        </span>
                      ))}
                      {rows.length > 5 && (
                        <span
                          style={{
                            fontSize: "0.65rem",
                            color: "var(--slate-500)",
                            alignSelf: "center",
                          }}
                        >
                          +{rows.length - 5} more
                        </span>
                      )}
                    </div>
                  </>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => setEditing(subject)}
                >
                  <ClipboardCheck size={14} />
                  {rows.length ? "Edit timeline" : "Set up timeline"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <TimelineEditor
          subject={editing}
          initial={templates[editing.id] || []}
          onSaved={(rows) => {
            saveTemplate(editing.id, rows);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function TimelineEditor({ subject, initial, onSaved, onClose }) {
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);

  const totalWeight = rows.reduce((s, m) => s + Number(m.weight || 0), 0);
  const balanced = Math.abs(totalWeight - 100) < 0.5;

  const seed = () => {
    const weeks = subject.durationWeeks || 12;
    const source = DEFAULT_MILESTONE_TEMPLATE;
    setRows(
      Array.from({ length: weeks }, (_, i) => ({
        weekNumber: i + 1,
        title: i < source.length ? source[i].title : `Week ${i + 1} Milestone`,
        description: "",
        weight: Number((100 / weeks).toFixed(1)),
        isRequired: true,
      }))
    );
    toast.success(`Seeded a ${weeks}-week plan.`);
  };

  /** Spread 100% evenly so the weights always add up. */
  const balance = () => {
    if (!rows.length) return;
    const even = Number((100 / rows.length).toFixed(1));
    const balanced = rows.map((r) => ({ ...r, weight: even }));
    // Push any rounding remainder onto the final milestone.
    const drift = Number((100 - even * rows.length).toFixed(1));
    if (drift !== 0) {
      balanced[balanced.length - 1].weight = Number((even + drift).toFixed(1));
    }
    setRows(balanced);
  };

  const update = (i, patch) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    try {
      await subjectApi.upsertMilestoneTemplates(subject.id, { templates: rows });
      toast.success("Timeline saved.");
      onSaved(rows);
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
      title={`${subject.name} timeline`}
      subtitle={`${subject.code} · ${subject.durationWeeks}-week project`}
      width={720}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Timeline"}
          </button>
        </>
      }
    >
      <div className="flex items-center justify-between mb-4" style={{ gap: 10, flexWrap: "wrap" }}>
        <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)", maxWidth: 360 }}>
          Weights determine weighted progress. They should add up to 100%.
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={seed}>
            <Sparkles size={14} />
            Default plan
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={balance}
            disabled={!rows.length}
          >
            Balance weights
          </button>
        </div>
      </div>

      {!rows.length ? (
        <EmptyState
          compact
          icon={ClipboardCheck}
          title="No milestones yet"
          message="Load the default plan, or add weeks one at a time."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
          {rows.map((m, i) => (
            <div
              key={m.id || i}
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1fr 1.2fr 88px 38px",
                gap: 9,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  color: "var(--purple-400)",
                  textAlign: "center",
                }}
              >
                W{m.weekNumber}
              </span>
              <input
                className="form-input"
                value={m.title}
                placeholder="Milestone"
                onChange={(e) => update(i, { title: e.target.value })}
              />
              <input
                className="form-input"
                value={m.description || ""}
                placeholder="What must be delivered?"
                onChange={(e) => update(i, { description: e.target.value })}
              />
              <input
                className="form-input"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={m.weight}
                onChange={(e) => update(i, { weight: Number(e.target.value) })}
                title="Weight (%)"
              />
              <button
                type="button"
                className="btn-icon-sm"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                style={{ color: "var(--red-400)" }}
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className="flex items-center justify-between"
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.07)",
          fontSize: "0.8125rem",
        }}
      >
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { weekNumber: prev.length + 1, title: "", description: "", weight: 0, isRequired: true },
            ])
          }
        >
          <Plus size={14} />
          Add week
        </button>

        <span
          className="flex items-center gap-1"
          style={{ fontWeight: 700, color: balanced ? "var(--green-400)" : "var(--yellow-400)" }}
        >
          {balanced ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          Total: {totalWeight.toFixed(1)}%
        </span>
      </div>
    </Modal>
  );
}
