import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Lightbulb, CheckCircle2, XCircle, MessageSquareWarning, Sparkles, UserCheck,
  Loader2, Target, Compass, Cpu, Trophy, Users,
} from "lucide-react";
import { projectApi } from "../../services/index.js";
import { apiErrorMessage, formatDateTime } from "../../utils/format.js";
import {
  Modal, EmptyState, StatusBadge, ProgressBar,
} from "../../components/ui/index.js";

/**
 * Project idea, its review history, and — for faculty — the approval and
 * mentor-assignment actions (spec §29–§31).
 */
export default function OverviewTab({ project, refetch, user }) {
  const idea = project.idea;
  const canReview = user?.role === "FACULTY" || user?.role === "ADMIN";
  const canAssignMentor = canReview && project.status === "APPROVED" && !project.mentorId;

  const [reviewing, setReviewing] = useState(false);
  const [assigning, setAssigning] = useState(false);

  if (!idea) {
    return (
      <div className="glass-card">
        <EmptyState
          icon={Lightbulb}
          title="No project idea submitted yet"
          message={
            user?.role === "STUDENT"
              ? "Submit your project idea — title, abstract, problem statement, objectives, scope and technologies — to start the approval workflow."
              : "The student hasn't submitted an idea for this project yet."
          }
        />
      </div>
    );
  }

  const sections = [
    { icon: Lightbulb, label: "Abstract", value: idea.abstract },
    { icon: Target, label: "Problem Statement", value: idea.problemStatement },
    { icon: Compass, label: "Objectives", value: idea.objectives },
    { icon: Compass, label: "Scope", value: idea.scope },
    { icon: Cpu, label: "Technologies", value: idea.technologies },
    { icon: Trophy, label: "Expected Outcome", value: idea.expectedOutcome },
    ...(idea.teamMembers ? [{ icon: Users, label: "Team Members", value: idea.teamMembers }] : []),
  ];

  return (
    <div className="split-grid">
      {/* Idea body */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div className="flex items-start justify-between gap-3 mb-5" style={{ flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: 4 }}>{idea.title}</h2>
            <p style={{ fontSize: "0.75rem", color: "var(--slate-500)" }}>
              Submitted {formatDateTime(idea.submittedAt)}
            </p>
          </div>
          <StatusBadge status={idea.status} />
        </div>

        {sections.map(({ icon: Icon, label, value }) => (
          <div key={label} style={{ marginBottom: 20 }}>
            <div
              className="flex items-center gap-2"
              style={{
                fontSize: "0.68rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--purple-400)",
                marginBottom: 7,
              }}
            >
              <Icon size={12} />
              {label}
            </div>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--slate-300)",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Side column: actions + review history */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {canReview && idea.status === "PENDING" && (
          <div className="glass-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: 6 }}>
              Review this idea
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)", marginBottom: 16 }}>
              Approving unlocks mentor assignment. Rejecting or requesting changes requires a
              comment the student can act on.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setReviewing(true)}
            >
              <CheckCircle2 size={15} />
              Review Idea
            </button>
          </div>
        )}

        {canAssignMentor && (
          <div className="glass-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: 6 }}>
              Assign a mentor
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)", marginBottom: 16 }}>
              SAPMS recommends the mentor in this domain with the lightest current workload. You
              can override the suggestion.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setAssigning(true)}
            >
              <Sparkles size={15} />
              Recommend Mentor
            </button>
          </div>
        )}

        <div className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: 14 }}>
            Approval history
          </h3>

          {!idea.reviews?.length ? (
            <p style={{ fontSize: "0.8125rem", color: "var(--slate-500)" }}>
              No review recorded yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[...idea.reviews]
                .sort((a, b) => new Date(b.reviewedAt) - new Date(a.reviewedAt))
                .map((review) => (
                  <div
                    key={review.id}
                    style={{
                      paddingLeft: 12,
                      borderLeft: `2px solid ${
                        review.status === "APPROVED"
                          ? "var(--green-500)"
                          : review.status === "REJECTED"
                          ? "var(--red-500)"
                          : "var(--orange-500)"
                      }`,
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1" style={{ flexWrap: "wrap" }}>
                      <StatusBadge status={review.status} size="sm" />
                      <span style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>
                        {formatDateTime(review.reviewedAt)}
                      </span>
                    </div>
                    {review.comments && (
                      <p
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--slate-300)",
                          lineHeight: 1.6,
                        }}
                      >
                        {review.comments}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {reviewing && (
        <IdeaReviewModal
          project={project}
          onClose={() => setReviewing(false)}
          onDone={() => {
            setReviewing(false);
            refetch();
          }}
        />
      )}

      {assigning && (
        <MentorAssignModal
          project={project}
          onClose={() => setAssigning(false)}
          onDone={() => {
            setAssigning(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

const DECISIONS = [
  {
    value: "APPROVED",
    label: "Approve",
    icon: CheckCircle2,
    tone: "green",
    hint: "The idea is sound — unlock mentor assignment.",
  },
  {
    value: "CHANGES_REQUIRED",
    label: "Request changes",
    icon: MessageSquareWarning,
    tone: "orange",
    hint: "The student can revise and resubmit.",
  },
  {
    value: "REJECTED",
    label: "Reject",
    icon: XCircle,
    tone: "red",
    hint: "The idea can't proceed in its current form.",
  },
];

function IdeaReviewModal({ project, onClose, onDone }) {
  const [status, setStatus] = useState("APPROVED");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  const commentRequired = status !== "APPROVED";
  const commentTooShort = commentRequired && comments.trim().length < 10;

  const submit = async (e) => {
    e.preventDefault();
    if (commentTooShort) {
      toast.error("Please explain your decision in at least 10 characters.");
      return;
    }
    setSaving(true);
    try {
      await projectApi.reviewIdea(project.id, { status, comments: comments.trim() || undefined });
      toast.success(
        status === "APPROVED" ? "Idea approved." : "Feedback sent to the student."
      );
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
      title="Review Project Idea"
      subtitle={project.idea?.title}
      width={560}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="idea-review-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Submitting…" : "Submit Review"}
          </button>
        </>
      }
    >
      <form id="idea-review-form" onSubmit={submit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
          {DECISIONS.map(({ value, label, icon: Icon, tone, hint }) => {
            const selected = status === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "13px 15px",
                  borderRadius: 12,
                  textAlign: "left",
                  border: `1px solid ${selected ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                  background: selected ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.02)",
                  transition: "all 150ms",
                }}
              >
                <Icon
                  size={18}
                  color={`var(--${tone === "green" ? "green-400" : tone === "red" ? "red-400" : "orange-500"})`}
                  style={{ flexShrink: 0, marginTop: 1 }}
                />
                <span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.875rem",
                      fontWeight: 700,
                      color: "var(--white)",
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ display: "block", fontSize: "0.75rem", color: "var(--slate-400)" }}>
                    {hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="form-group">
          <label className="form-label">
            Comments{" "}
            {commentRequired ? (
              <span style={{ color: "var(--red-400)" }}>(required)</span>
            ) : (
              <span style={{ color: "var(--slate-500)", fontWeight: 400 }}>(optional)</span>
            )}
          </label>
          <textarea
            className="form-input"
            rows={4}
            placeholder="e.g. The problem statement is too broad — please define the target users and the specific pain point."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
          {commentTooShort && comments.length > 0 && (
            <span className="form-error">At least 10 characters, please.</span>
          )}
        </div>
      </form>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function MentorAssignModal({ project, onClose, onDone }) {
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    projectApi
      .getMentorRecommendation(project.id)
      .then(({ data }) => {
        if (!active) return;
        const recommended = data.recommended || data.recommendation || null;
        setRecommendation(recommended);
        setCandidates(data.mentors || data.candidates || []);
        setSelected(recommended?.id || "");
      })
      .catch((err) => active && toast.error(apiErrorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [project.id]);

  const assign = async () => {
    if (!selected) {
      toast.error("Pick a mentor to assign.");
      return;
    }
    setSaving(true);
    try {
      await projectApi.assignMentor(project.id, { mentorId: selected });
      toast.success("Mentor assigned — the team has been notified.");
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const maxLoad = Math.max(1, ...candidates.map((c) => c.activeProjects ?? 0));

  return (
    <Modal
      open
      onClose={onClose}
      title="Assign Mentor"
      subtitle={`Domain: ${project.domain?.name || "not set"}`}
      width={560}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={assign}
            disabled={saving || loading || !selected}
          >
            {saving ? <Loader2 size={15} className="spin" /> : <UserCheck size={15} />}
            {saving ? "Assigning…" : "Confirm Assignment"}
          </button>
        </>
      }
    >
      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto" }} />
        </div>
      ) : !candidates.length ? (
        <EmptyState
          compact
          icon={UserCheck}
          title="No mentors cover this domain"
          message="Add a mentor to this domain under Admin → Mentors, then come back."
        />
      ) : (
        <>
          {recommendation && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 14px",
                borderRadius: 11,
                background: "rgba(124,58,237,0.1)",
                border: "1px solid rgba(124,58,237,0.25)",
                marginBottom: 16,
                fontSize: "0.8125rem",
              }}
            >
              <Sparkles size={15} color="var(--purple-400)" style={{ flexShrink: 0 }} />
              <span style={{ color: "var(--slate-300)" }}>
                Recommended:{" "}
                <strong style={{ color: "var(--white)" }}>{recommendation.user?.name}</strong> —
                lightest workload in this domain.
              </span>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {candidates
              .slice()
              .sort((a, b) => (a.activeProjects ?? 0) - (b.activeProjects ?? 0))
              .map((mentor) => {
                const isSelected = selected === mentor.id;
                const isRecommended = recommendation?.id === mentor.id;
                const load = mentor.activeProjects ?? 0;

                return (
                  <button
                    key={mentor.id}
                    type="button"
                    onClick={() => setSelected(mentor.id)}
                    style={{
                      textAlign: "left",
                      padding: "13px 15px",
                      borderRadius: 12,
                      border: `1px solid ${isSelected ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                      background: isSelected ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.02)",
                      transition: "all 150ms",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span
                        style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--white)" }}
                      >
                        {mentor.user?.name}
                        {isRecommended && (
                          <span
                            className="badge badge-purple"
                            style={{ marginLeft: 8, fontSize: "0.58rem", padding: "2px 7px" }}
                          >
                            Recommended
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--slate-400)" }}>
                        {load} active
                      </span>
                    </div>

                    {mentor.expertise && (
                      <div
                        style={{ fontSize: "0.75rem", color: "var(--slate-500)", marginBottom: 7 }}
                      >
                        {mentor.expertise}
                      </div>
                    )}

                    <ProgressBar
                      value={(load / maxLoad) * 100}
                      height={4}
                      variant={load >= maxLoad && maxLoad > 3 ? "at-risk" : undefined}
                    />
                  </button>
                );
              })}
          </div>
        </>
      )}
    </Modal>
  );
}
