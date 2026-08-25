import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Trophy, Save, Loader2, Award, Lock, CheckCircle2 } from "lucide-react";
import { evaluationApi } from "../../services/index.js";
import { apiErrorMessage, formatDateTime, formatPercent } from "../../utils/format.js";
import {
  EmptyState, SkeletonCard, ProgressBar, ConfirmationDialog, StatusBadge,
} from "../../components/ui/index.js";

/**
 * Final evaluation against the subject's configurable criteria (spec §50).
 * Faculty and admin can award marks; everyone else sees the published sheet.
 */
export default function EvaluationTab({ project, refetch, user }) {
  const canEvaluate = user?.role === "FACULTY" || user?.role === "ADMIN";

  const [sheet, setSheet] = useState(null);
  const [marks, setMarks] = useState({});
  const [facultyRemarks, setFacultyRemarks] = useState("");
  const [mentorRemarks, setMentorRemarks] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await evaluationApi.forProject(project.id);
      setSheet(data);

      const existing = {};
      (data.evaluation?.marks || []).forEach((m) => {
        existing[m.criteriaId] = m.marksAwarded;
      });
      setMarks(existing);
      setFacultyRemarks(data.evaluation?.facultyRemarks || "");
      setMentorRemarks(data.evaluation?.mentorRemarks || "");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  if (loading) return <SkeletonCard height={320} />;

  if (!sheet?.criteria?.length) {
    return (
      <div className="glass-card">
        <EmptyState
          icon={Trophy}
          title="No marking scheme configured"
          message={`"${project.subject?.name}" has no evaluation criteria yet. An admin can define them under Subjects → configure.`}
        />
      </div>
    );
  }

  const isPublished = Boolean(sheet.evaluation?.completedAt);
  const locked = isPublished || !canEvaluate;

  const total = sheet.criteria.reduce((sum, c) => sum + (Number(marks[c.id]) || 0), 0);
  const percentage = sheet.maxTotal ? (total / sheet.maxTotal) * 100 : 0;

  const save = async (complete) => {
    const payload = {
      marks: sheet.criteria.map((c) => ({
        criteriaId: c.id,
        marksAwarded: Number(marks[c.id]) || 0,
      })),
      facultyRemarks,
      mentorRemarks,
      complete,
    };

    if (complete) setPublishing(true);
    else setSaving(true);

    try {
      await evaluationApi.submit(project.id, payload);
      toast.success(complete ? "Marks published — the team has been notified." : "Draft saved.");
      await load();
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  return (
    <div className="split-grid">
      {/* Mark sheet */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div className="flex items-center justify-between mb-5" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>Mark Sheet</h3>
            <p style={{ fontSize: "0.78rem", color: "var(--slate-500)" }}>
              {project.subject?.name} · out of {sheet.maxTotal} marks
            </p>
          </div>
          {isPublished && (
            <StatusBadge tone="green" label="Published" size="sm" icon={CheckCircle2} />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sheet.criteria.map((criterion) => {
            const awarded = Number(marks[criterion.id]) || 0;
            const ratio = criterion.maxMarks ? (awarded / criterion.maxMarks) * 100 : 0;

            return (
              <div key={criterion.id}>
                <div
                  className="flex items-center justify-between gap-3"
                  style={{ marginBottom: 6, flexWrap: "wrap" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--white)" }}>
                      {criterion.name}
                    </div>
                    {criterion.description && (
                      <div style={{ fontSize: "0.72rem", color: "var(--slate-500)" }}>
                        {criterion.description}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      max={criterion.maxMarks}
                      step={0.5}
                      disabled={locked}
                      value={marks[criterion.id] ?? ""}
                      placeholder="0"
                      onChange={(e) =>
                        setMarks((m) => ({ ...m, [criterion.id]: e.target.value }))
                      }
                      style={{ width: 76, textAlign: "center", padding: "7px 8px" }}
                    />
                    <span style={{ fontSize: "0.8125rem", color: "var(--slate-500)" }}>
                      / {criterion.maxMarks}
                    </span>
                  </div>
                </div>

                <ProgressBar
                  value={ratio}
                  height={5}
                  variant={ratio >= 80 ? "completed" : ratio < 40 ? "delayed" : undefined}
                />
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="form-group mb-4">
            <label className="form-label">Faculty Remarks</label>
            <textarea
              className="form-input"
              rows={2}
              disabled={locked}
              placeholder="Overall assessment of the project."
              value={facultyRemarks}
              onChange={(e) => setFacultyRemarks(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mentor Remarks</label>
            <textarea
              className="form-input"
              rows={2}
              disabled={locked}
              placeholder="Mentor's view of the student's consistency and effort."
              value={mentorRemarks}
              onChange={(e) => setMentorRemarks(e.target.value)}
            />
          </div>
        </div>

        {canEvaluate && !isPublished && (
          <div className="flex gap-2" style={{ marginTop: 20, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => save(false)}
              disabled={saving || publishing}
            >
              {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
              Save draft
            </button>
            <PublishButton
              onPublish={() => save(true)}
              busy={publishing}
              total={total}
              maxTotal={sheet.maxTotal}
            />
          </div>
        )}

        {isPublished && (
          <div
            className="flex items-center gap-2"
            style={{
              marginTop: 20,
              padding: "11px 14px",
              borderRadius: 11,
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.22)",
              fontSize: "0.8125rem",
              color: "var(--green-400)",
            }}
          >
            <Lock size={14} />
            Published on {formatDateTime(sheet.evaluation.completedAt)} — marks are final.
          </div>
        )}
      </div>

      {/* Result summary */}
      <div className="glass-card" style={{ padding: 24, textAlign: "center" }}>
        <div
          style={{
            width: 66,
            height: 66,
            margin: "0 auto 16px",
            borderRadius: "50%",
            background: "rgba(124,58,237,0.14)",
            border: "1px solid rgba(124,58,237,0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Award size={28} color="var(--purple-400)" />
        </div>

        <div
          style={{
            fontSize: "2.5rem",
            fontWeight: 800,
            lineHeight: 1,
            background: "var(--gradient-glow)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {total}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--slate-400)", marginTop: 4 }}>
          out of {sheet.maxTotal} marks
        </div>

        <div style={{ margin: "20px 0" }}>
          <ProgressBar value={percentage} height={8} />
        </div>

        <div className="stat-row">
          <span className="stat-row-label">Percentage</span>
          <span className="stat-row-value">{formatPercent(percentage, 1)}</span>
        </div>
        <div className="stat-row">
          <span className="stat-row-label">Grade</span>
          <span className="stat-row-value" style={{ color: "var(--purple-400)", fontSize: "1rem" }}>
            {sheet.evaluation?.grade || gradeFor(percentage)}
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-row-label">Status</span>
          <span className="stat-row-value">{isPublished ? "Published" : "Draft"}</span>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function PublishButton({ onPublish, busy, total, maxTotal }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setConfirming(true)}
        disabled={busy}
      >
        {busy ? <Loader2 size={15} className="spin" /> : <Trophy size={15} />}
        Publish marks
      </button>

      <ConfirmationDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          await onPublish();
        }}
        tone="primary"
        title="Publish final marks?"
        message={`The team will be notified of ${total}/${maxTotal} and the project will be marked completed. Marks can't be edited afterwards.`}
        confirmLabel="Publish Marks"
      />
    </>
  );
}

/** Mirrors the server's grading bands so the draft preview matches. */
function gradeFor(percentage) {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}
