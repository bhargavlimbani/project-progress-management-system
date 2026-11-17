import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import {
  Lightbulb, CheckCircle2, XCircle, MessageSquareWarning, Sparkles, UserCheck,
  Loader2, Target, Compass, Cpu, Trophy, Users, Search, Check, Briefcase, Info,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // "all" | "domain"

  useEffect(() => {
    let active = true;
    projectApi
      .getMentorRecommendation(project.id)
      .then(({ data }) => {
        if (!active) return;
        const recommended = data.recommended || data.recommendation || null;
        const all = data.candidates || data.mentors || data.allMentors || [];
        setRecommendation(recommended);
        setCandidates(all);
        setSelected(recommended?.id || all[0]?.id || "");
      })
      .catch((err) => active && toast.error(apiErrorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [project.id]);

  const domainMatchesCount = useMemo(() => {
    return candidates.filter((c) => c.matchesDomain).length;
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    let list = candidates;
    if (activeTab === "domain") {
      list = list.filter((c) => c.matchesDomain);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => {
        const name = (c.user?.name || "").toLowerCase();
        const email = (c.user?.email || "").toLowerCase();
        const expertise = (c.expertise || "").toLowerCase();
        const id = (c.mentorId || "").toLowerCase();
        const domains = (c.domains || []).map((d) => (d?.name || "").toLowerCase()).join(" ");
        return name.includes(q) || email.includes(q) || expertise.includes(q) || id.includes(q) || domains.includes(q);
      });
    }
    return list;
  }, [candidates, activeTab, searchQuery]);

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
      subtitle={`Project Domain: ${project.domain?.name || "General / Unassigned"}`}
      width={640}
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
          <p style={{ marginTop: 12, color: "var(--slate-400)", fontSize: "0.85rem" }}>
            Loading all available mentors…
          </p>
        </div>
      ) : !candidates.length ? (
        <EmptyState
          compact
          icon={UserCheck}
          title="No mentors registered yet"
          message="Add mentors under Admin → Mentors, then you can assign them to projects."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Recommendation Banner */}
          {recommendation && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "12px 14px",
                borderRadius: 12,
                background: "linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(99,102,241,0.08) 100%)",
                border: "1px solid rgba(124,58,237,0.3)",
                fontSize: "0.825rem",
              }}
            >
              <Sparkles size={16} color="var(--purple-400)" style={{ flexShrink: 0 }} />
              <div style={{ color: "var(--slate-300)", lineHeight: 1.4 }}>
                <span style={{ color: "var(--purple-300)", fontWeight: 700 }}>AI Recommendation: </span>
                <strong style={{ color: "var(--white)" }}>{recommendation.user?.name}</strong>
                {recommendation.matchesDomain ? (
                  <span> — specialized in {project.domain?.name} with lightest current workload.</span>
                ) : (
                  <span> — available mentor with lightest current workload.</span>
                )}
              </div>
            </div>
          )}

          {/* Domain Notice Banner if no direct domain matches */}
          {project.domain?.name && domainMatchesCount === 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "10px 13px",
                borderRadius: 10,
                background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(59,130,246,0.22)",
                fontSize: "0.785rem",
                color: "var(--slate-300)",
              }}
            >
              <Info size={15} color="var(--blue-400)" style={{ flexShrink: 0 }} />
              <span>
                No mentor is specifically tagged with &quot;{project.domain.name}&quot;. Showing all active mentors so faculty can assign an advisor.
              </span>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--slate-500)",
                }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="Search mentor by name, email, domain, expertise…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 34, height: 36, fontSize: "0.825rem" }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--slate-400)",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {domainMatchesCount > 0 && (
              <div style={{ display: "flex", gap: 5 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: activeTab === "all" ? "1px solid rgba(124,58,237,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: activeTab === "all" ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.03)",
                    color: activeTab === "all" ? "var(--purple-300)" : "var(--slate-400)",
                  }}
                >
                  All Mentors ({candidates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("domain")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: activeTab === "domain" ? "1px solid rgba(16,185,129,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    background: activeTab === "domain" ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.03)",
                    color: activeTab === "domain" ? "var(--emerald-300)" : "var(--slate-400)",
                  }}
                >
                  Domain Specialists ({domainMatchesCount})
                </button>
              </div>
            )}
          </div>

          {/* Mentor List */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 9,
              maxHeight: 380,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {filteredCandidates.length === 0 ? (
              <div style={{ padding: "30px 15px", textAlign: "center", color: "var(--slate-400)" }}>
                <p style={{ fontSize: "0.85rem", marginBottom: 8 }}>
                  No mentors match your search {searchQuery ? `"${searchQuery}"` : ""}.
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setSearchQuery("");
                      setActiveTab("all");
                    }}
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            ) : (
              filteredCandidates.map((mentor) => {
                const isSelected = selected === mentor.id;
                const isRecommended = recommendation?.id === mentor.id;
                const load = mentor.activeProjects ?? 0;
                const initials = (mentor.user?.name || "M")
                  .split(" ")
                  .map((w) => w[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <button
                    key={mentor.id}
                    type="button"
                    onClick={() => setSelected(mentor.id)}
                    style={{
                      textAlign: "left",
                      padding: "13px 15px",
                      borderRadius: 12,
                      border: `1.5px solid ${isSelected ? "var(--purple-500)" : "rgba(255,255,255,0.08)"}`,
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(99,102,241,0.08) 100%)"
                        : "rgba(255,255,255,0.02)",
                      boxShadow: isSelected ? "0 0 14px rgba(124,58,237,0.22)" : "none",
                      transition: "all 150ms ease",
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Selection Radio Circle */}
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          border: `2px solid ${isSelected ? "var(--purple-400)" : "rgba(255,255,255,0.2)"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 3,
                          flexShrink: 0,
                          background: isSelected ? "var(--purple-600)" : "transparent",
                          transition: "all 120ms ease",
                        }}
                      >
                        {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                      </div>

                      {/* Mentor Avatar */}
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: isSelected
                            ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                            : "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.12)",
                          color: "var(--white)",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>

                      {/* Info Body */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--white)" }}>
                              {mentor.user?.name}
                            </span>
                            {mentor.mentorId && (
                              <span style={{ fontSize: "0.7rem", color: "var(--slate-400)", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>
                                {mentor.mentorId}
                              </span>
                            )}
                            {isRecommended && (
                              <span
                                className="badge badge-purple"
                                style={{ fontSize: "0.62rem", padding: "2px 7px", fontWeight: 600 }}
                              >
                                ⭐ Recommended
                              </span>
                            )}
                            {mentor.matchesDomain && (
                              <span
                                style={{
                                  fontSize: "0.62rem",
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  background: "rgba(16,185,129,0.15)",
                                  color: "var(--emerald-300)",
                                  border: "1px solid rgba(16,185,129,0.3)",
                                  fontWeight: 600,
                                }}
                              >
                                ✓ Domain Specialist
                              </span>
                            )}
                          </div>

                          <span style={{ fontSize: "0.75rem", color: "var(--slate-400)", fontWeight: 500 }}>
                            <strong style={{ color: load === 0 ? "var(--emerald-400)" : "var(--slate-200)" }}>{load}</strong> active project{load === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 3, fontSize: "0.75rem", color: "var(--slate-400)", flexWrap: "wrap" }}>
                          <span>{mentor.user?.email}</span>
                          {mentor.mobile && <span>• {mentor.mobile}</span>}
                          {mentor.expertise && (
                            <span style={{ color: "var(--slate-300)" }}>
                              • Expertise: {mentor.expertise}
                            </span>
                          )}
                        </div>

                        {/* Domain Tags */}
                        {mentor.domains?.length > 0 && (
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
                            {mentor.domains.map((dom) => {
                              const isTargetDomain = project.domain?.id === dom.id || project.domain?.name === dom.name;
                              return (
                                <span
                                  key={dom.id || dom.name}
                                  style={{
                                    fontSize: "0.68rem",
                                    padding: "2px 7px",
                                    borderRadius: 5,
                                    background: isTargetDomain ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                                    border: isTargetDomain ? "1px solid rgba(124,58,237,0.4)" : "1px solid rgba(255,255,255,0.06)",
                                    color: isTargetDomain ? "var(--purple-300)" : "var(--slate-400)",
                                    fontWeight: isTargetDomain ? 600 : 400,
                                  }}
                                >
                                  {dom.name}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div style={{ marginTop: 8 }}>
                          <ProgressBar
                            value={(load / maxLoad) * 100}
                            height={3}
                            variant={load >= maxLoad && maxLoad > 3 ? "at-risk" : undefined}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
