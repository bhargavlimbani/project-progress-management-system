import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ClipboardCheck, CheckCircle2, XCircle, MessageSquareWarning, Eye, Sparkles,
  Lightbulb, Layers, Users,
} from "lucide-react";
import { projectApi } from "../../services/index.js";
import { useApi } from "../../hooks/useApi.js";
import { apiErrorMessage, timeAgo, truncate } from "../../utils/format.js";
import {
  PageHeader, EmptyState, Modal, StatusBadge, SkeletonCard, SearchBar, Tabs,
} from "../../components/ui/index.js";

const AWAITING = ["IDEA_SUBMITTED", "FACULTY_REVIEW"];

/**
 * Faculty idea approval queue (spec §30). Rejecting or requesting changes
 * requires a comment — enforced here and again on the server.
 */
export default function IdeaReviews() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState(null);

  const { data, loading, refetch } = useApi(() => projectApi.list({ limit: 100 }), [], {
    initialData: { projects: [] },
  });

  const projects = useMemo(() => {
    const rows = data?.projects || [];
    const term = search.trim().toLowerCase();

    return rows.filter((p) => {
      if (!p.idea) return false;

      const isPending = AWAITING.includes(p.status) && p.idea.status === "PENDING";
      if (tab === "pending" && !isPending) return false;
      if (tab === "reviewed" && isPending) return false;

      if (!term) return true;
      return [p.title, p.idea.title, p.subject?.name, p.domain?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [data, tab, search]);

  const pendingCount = (data?.projects || []).filter(
    (p) => p.idea && AWAITING.includes(p.status) && p.idea.status === "PENDING"
  ).length;

  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        title="Idea Reviews"
        subtitle="Approve, reject or send back project ideas before mentors are assigned."
        crumbs={[{ label: "Faculty", to: "/faculty" }, { label: "Idea Reviews" }]}
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "pending", label: "Awaiting review", icon: Lightbulb, badge: pendingCount },
          { key: "reviewed", label: "Reviewed", icon: CheckCircle2 },
        ]}
      />

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search idea, subject or domain…" />
      </div>

      {loading ? (
        <div className="card-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} height={230} />
          ))}
        </div>
      ) : !projects.length ? (
        <div className="glass-card">
          <EmptyState
            icon={tab === "pending" ? CheckCircle2 : Lightbulb}
            title={tab === "pending" ? "No ideas awaiting review" : "No reviewed ideas yet"}
            message={
              tab === "pending"
                ? "Everything in your subjects has been reviewed. New submissions appear here."
                : "Ideas you've approved or sent back will be listed here."
            }
          />
        </div>
      ) : (
        <div className="card-grid">
          {projects.map((project) => (
            <div key={project.id} className="glass-card glass-card-hover" style={{ padding: 20 }}>
              <div className="flex items-start justify-between gap-3 mb-3" style={{ flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: "var(--purple-400)",
                    background: "rgba(124,58,237,0.12)",
                    border: "1px solid rgba(124,58,237,0.2)",
                    padding: "4px 10px",
                    borderRadius: 99,
                  }}
                >
                  {project.subject?.name}
                </span>
                <StatusBadge status={project.idea.status} size="sm" />
              </div>

              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 8 }}>
                {project.idea.title}
              </h3>

              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--slate-400)",
                  lineHeight: 1.6,
                  marginBottom: 14,
                }}
              >
                {truncate(project.idea.abstract, 160)}
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: "0.75rem",
                  color: "var(--slate-400)",
                  marginBottom: 16,
                }}
              >
                <span className="flex items-center gap-2">
                  <Layers size={12} color="var(--slate-500)" />
                  {project.domain?.name || "No domain selected"}
                </span>
                <span className="flex items-center gap-2">
                  <Users size={12} color="var(--slate-500)" />
                  {project.members?.map((m) => m.student.name).join(", ") || "No members"}
                </span>
                <span style={{ color: "var(--slate-500)" }}>
                  Submitted {timeAgo(project.idea.submittedAt)}
                </span>
              </div>

              <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                {project.idea.status === "PENDING" && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setReviewing(project)}
                  >
                    <ClipboardCheck size={13} />
                    Review
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/faculty/projects/${project.id}`)}
                >
                  <Eye size={13} />
                  Open project
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewing && (
        <IdeaReviewModal
          project={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            refetch();
          }}
        />
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function IdeaReviewModal({ project, onClose, onDone }) {
  const [status, setStatus] = useState("APPROVED");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  const required = status !== "APPROVED";
  const tooShort = required && comments.trim().length < 10;

  const idea = project.idea;

  const submit = async (e) => {
    e.preventDefault();
    if (tooShort) {
      toast.error("Please explain your decision in at least 10 characters.");
      return;
    }
    setSaving(true);
    try {
      await projectApi.reviewIdea(project.id, { status, comments: comments.trim() || undefined });
      toast.success(
        status === "APPROVED"
          ? "Idea approved — you can now assign a mentor."
          : "Feedback sent to the student."
      );
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const options = [
    {
      value: "APPROVED",
      label: "Approve",
      icon: CheckCircle2,
      color: "var(--green-400)",
      hint: "Unlocks mentor assignment.",
    },
    {
      value: "CHANGES_REQUIRED",
      label: "Request changes",
      icon: MessageSquareWarning,
      color: "var(--orange-500)",
      hint: "The student revises and resubmits.",
    },
    {
      value: "REJECTED",
      label: "Reject",
      icon: XCircle,
      color: "var(--red-400)",
      hint: "The idea can't proceed as written.",
    },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title="Review Project Idea"
      subtitle={idea.title}
      width={680}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="idea-queue-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Submitting…" : "Submit Review"}
          </button>
        </>
      }
    >
      {/* The idea itself, so the decision is made with the content in view */}
      <div style={{ maxHeight: 260, overflowY: "auto", marginBottom: 18 }}>
        {[
          ["Abstract", idea.abstract],
          ["Problem Statement", idea.problemStatement],
          ["Objectives", idea.objectives],
          ["Scope", idea.scope],
          ["Technologies", idea.technologies],
          ["Expected Outcome", idea.expectedOutcome],
        ].map(([label, value]) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: "0.66rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--purple-400)",
                marginBottom: 4,
              }}
            >
              {label}
            </div>
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--slate-300)",
                lineHeight: 1.65,
                whiteSpace: "pre-wrap",
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <form id="idea-queue-form" onSubmit={submit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {options.map(({ value, label, icon: Icon, color, hint }) => {
            const selected = status === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 11,
                  padding: "12px 14px",
                  borderRadius: 11,
                  textAlign: "left",
                  border: `1px solid ${selected ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                  background: selected ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.02)",
                }}
              >
                <Icon size={17} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: "var(--white)",
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ display: "block", fontSize: "0.72rem", color: "var(--slate-400)" }}>
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
            {required ? (
              <span style={{ color: "var(--red-400)" }}>(required)</span>
            ) : (
              <span style={{ color: "var(--slate-500)", fontWeight: 400 }}>(optional)</span>
            )}
          </label>
          <textarea
            className="form-input"
            rows={4}
            placeholder="e.g. The problem statement is too broad — please define the target users."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
          {tooShort && comments.length > 0 && (
            <span className="form-error">At least 10 characters, please.</span>
          )}
        </div>

        {status === "APPROVED" && (
          <div
            className="flex items-center gap-2"
            style={{
              marginTop: 14,
              padding: "10px 13px",
              borderRadius: 10,
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.2)",
              fontSize: "0.78rem",
              color: "var(--slate-300)",
            }}
          >
            <Sparkles size={14} color="var(--purple-400)" style={{ flexShrink: 0 }} />
            After approval, open the project to see the recommended mentor for{" "}
            {project.domain?.name || "this domain"}.
          </div>
        )}
      </form>
    </Modal>
  );
}
