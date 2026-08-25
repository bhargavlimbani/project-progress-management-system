import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  TrendingUp, Github, ExternalLink, Image as ImageIcon, Paperclip,
  CheckCircle2, XCircle, MessageSquareWarning, ShieldCheck, Eye,
} from "lucide-react";
import { progressApi } from "../../services/index.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiErrorMessage, formatDateTime, timeAgo } from "../../utils/format.js";
import {
  PageHeader, EmptyState, Modal, StatusBadge, SkeletonCard, SearchBar, Tabs,
} from "../../components/ui/index.js";

/**
 * The review queue for mentors and faculty (spec §38–§39).
 * Mentors review first; faculty verify once the mentor has approved.
 */
export default function WeeklyReviews() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isFaculty = user?.role === "FACULTY" || user?.role === "ADMIN";

  const { data, loading, refetch } = useApi(() => progressApi.pendingReviews(), [], {
    initialData: [],
  });

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("pending");
  const [reviewing, setReviewing] = useState(null);

  const entries = useMemo(() => {
    const rows = Array.isArray(data) ? data : data?.submissions || data?.progress || [];
    const term = search.trim().toLowerCase();

    return rows.filter((entry) => {
      const mentorReview = entry.reviews?.find((r) => r.mentorId);
      const facultyReview = entry.reviews?.find((r) => r.facultyId);

      // "Pending" means pending for *this* role.
      const needsMe = isFaculty
        ? mentorReview?.status === "APPROVED" && !facultyReview
        : !mentorReview;

      if (tab === "pending" && !needsMe) return false;
      if (tab === "reviewed" && needsMe) return false;

      if (!term) return true;
      return [
        entry.taskTitle,
        entry.student?.name,
        entry.student?.enrollmentNumber,
        entry.project?.title,
        entry.project?.subject?.name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [data, search, tab, isFaculty]);

  const allRows = Array.isArray(data) ? data : data?.submissions || data?.progress || [];
  const pendingCount = allRows.filter((entry) => {
    const mentorReview = entry.reviews?.find((r) => r.mentorId);
    const facultyReview = entry.reviews?.find((r) => r.facultyId);
    return isFaculty ? mentorReview?.status === "APPROVED" && !facultyReview : !mentorReview;
  }).length;

  return (
    <>
      <PageHeader
        icon={TrendingUp}
        title={isFaculty ? "Weekly Verification" : "Weekly Reviews"}
        subtitle={
          isFaculty
            ? "Submissions your mentors have approved and that now need your verification."
            : "Student submissions waiting on your review — check the evidence before approving."
        }
        crumbs={[{ label: isFaculty ? "Weekly Reviews" : "Weekly Reviews" }]}
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "pending", label: "Awaiting me", icon: TrendingUp, badge: pendingCount },
          { key: "reviewed", label: "Already handled", icon: CheckCircle2 },
        ]}
      />

      <div className="toolbar">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search student, project or task…"
        />
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} height={170} />
          ))}
        </div>
      ) : !entries.length ? (
        <div className="glass-card">
          <EmptyState
            icon={tab === "pending" ? CheckCircle2 : TrendingUp}
            title={tab === "pending" ? "Nothing waiting on you" : "Nothing handled yet"}
            message={
              tab === "pending"
                ? "Every submission in your queue has been reviewed. New ones appear here as students submit."
                : "Submissions you've reviewed will be listed here."
            }
          />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {entries.map((entry) => (
            <ReviewRow
              key={entry.id}
              entry={entry}
              isFaculty={isFaculty}
              onReview={() => setReviewing(entry)}
              onOpenProject={() =>
                navigate(`/${user.role.toLowerCase()}/projects/${entry.projectId}`)
              }
            />
          ))}
        </div>
      )}

      {reviewing && (
        <ReviewModal
          entry={reviewing}
          isFaculty={isFaculty}
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

function ReviewRow({ entry, isFaculty, onReview, onOpenProject }) {
  const mentorReview = entry.reviews?.find((r) => r.mentorId);
  const facultyReview = entry.reviews?.find((r) => r.facultyId);

  const evidence = [
    entry.githubUrl && { icon: Github, label: "GitHub", url: entry.githubUrl },
    entry.demoUrl && { icon: ExternalLink, label: "Demo", url: entry.demoUrl },
    ...(entry.screenshots || []).map((url, i) => ({
      icon: ImageIcon,
      label: `Screenshot ${i + 1}`,
      url,
    })),
    ...(entry.files || []).map((url, i) => ({ icon: Paperclip, label: `File ${i + 1}`, url })),
  ].filter(Boolean);

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div className="flex items-start justify-between gap-3 mb-3" style={{ flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="flex items-center gap-2 mb-1" style={{ flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "0.66rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--purple-400)",
              }}
            >
              Week {entry.weekNumber}
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>
              submitted {timeAgo(entry.submittedAt)}
            </span>
          </div>

          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 3 }}>{entry.taskTitle}</h3>

          <div style={{ fontSize: "0.78rem", color: "var(--slate-400)" }}>
            <strong style={{ color: "var(--slate-200)" }}>{entry.student?.name}</strong>
            {entry.student?.enrollmentNumber && ` (${entry.student.enrollmentNumber})`} ·{" "}
            {entry.project?.title}
            {entry.project?.subject?.name && ` · ${entry.project.subject.name}`}
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.64rem", color: "var(--slate-500)" }}>Mentor</span>
          <StatusBadge status={mentorReview?.status || "PENDING"} size="sm" />
          <span style={{ fontSize: "0.64rem", color: "var(--slate-500)", marginLeft: 3 }}>
            Faculty
          </span>
          <StatusBadge status={facultyReview?.status || "PENDING"} size="sm" />
        </div>
      </div>

      <p
        style={{
          fontSize: "0.8125rem",
          color: "var(--slate-300)",
          lineHeight: 1.65,
          marginBottom: 12,
        }}
      >
        {entry.completedWork}
      </p>

      {evidence.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {evidence.map((item, i) => {
            const Icon = item.icon;
            return (
              <a
                key={`${item.url}-${i}`}
                className="evidence-chip"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon size={12} />
                {item.label}
              </a>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: "0.78rem", color: "var(--red-400)" }}>
          No evidence attached — ask the student to provide proof of work.
        </div>
      )}

      {mentorReview?.feedback && isFaculty && (
        <div
          style={{
            marginTop: 13,
            paddingLeft: 12,
            borderLeft: "2px solid var(--purple-500)",
          }}
        >
          <div style={{ fontSize: "0.7rem", color: "var(--slate-500)", marginBottom: 2 }}>
            Mentor feedback · {mentorReview.mentor?.user?.name}
          </div>
          <p style={{ fontSize: "0.8125rem", color: "var(--slate-300)", lineHeight: 1.6 }}>
            {mentorReview.feedback}
          </p>
        </div>
      )}

      <div
        className="flex gap-2"
        style={{ marginTop: 16, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button type="button" className="btn btn-primary btn-sm" onClick={onReview}>
          {isFaculty ? <ShieldCheck size={13} /> : <CheckCircle2 size={13} />}
          {isFaculty ? "Verify" : "Review"}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenProject}>
          <Eye size={13} />
          Open project
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function ReviewModal({ entry, isFaculty, onClose, onDone }) {
  const [status, setStatus] = useState("APPROVED");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const required = status !== "APPROVED";
  const tooShort = required && feedback.trim().length < 10;

  const submit = async (e) => {
    e.preventDefault();
    if (tooShort) {
      toast.error("Give the student at least 10 characters of feedback.");
      return;
    }
    setSaving(true);
    try {
      await progressApi.review(entry.id, { status, feedback: feedback.trim() || undefined });
      toast.success(isFaculty ? "Verification recorded." : "Review submitted.");
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
      label: isFaculty ? "Verify" : "Approve",
      icon: CheckCircle2,
      color: "var(--green-400)",
    },
    {
      value: "CHANGES_REQUIRED",
      label: "Request changes",
      icon: MessageSquareWarning,
      color: "var(--orange-500)",
    },
    { value: "REJECTED", label: "Reject", icon: XCircle, color: "var(--red-400)" },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={`${isFaculty ? "Verify" : "Review"} Week ${entry.weekNumber}`}
      subtitle={`${entry.student?.name} · ${entry.taskTitle}`}
      width={580}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="queue-review-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Submitting…" : "Submit"}
          </button>
        </>
      }
    >
      <div
        style={{
          padding: "13px 15px",
          borderRadius: 11,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--slate-500)", marginBottom: 6 }}>
          WHAT THE STUDENT REPORTED
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--slate-300)", lineHeight: 1.65 }}>
          {entry.completedWork}
        </p>

        {entry.problemsFaced && (
          <>
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "var(--slate-500)",
                margin: "12px 0 5px",
              }}
            >
              PROBLEMS FACED
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--slate-300)", lineHeight: 1.65 }}>
              {entry.problemsFaced}
            </p>
          </>
        )}
      </div>

      <form id="queue-review-form" onSubmit={submit}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {options.map(({ value, label, icon: Icon, color }) => {
            const selected = status === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                style={{
                  flex: "1 1 140px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "11px 12px",
                  borderRadius: 11,
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  border: `1px solid ${selected ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                  background: selected ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.02)",
                  color: selected ? "var(--white)" : "var(--slate-400)",
                }}
              >
                <Icon size={15} color={color} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="form-group">
          <label className="form-label">
            Feedback{" "}
            {required ? (
              <span style={{ color: "var(--red-400)" }}>(required)</span>
            ) : (
              <span style={{ color: "var(--slate-500)", fontWeight: 400 }}>(optional)</span>
            )}
          </label>
          <textarea
            className="form-input"
            rows={4}
            placeholder="What was good, and what needs to change before next week?"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          {tooShort && feedback.length > 0 && (
            <span className="form-error">At least 10 characters, please.</span>
          )}
        </div>
      </form>
    </Modal>
  );
}
