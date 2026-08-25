import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, Github, ExternalLink, Image as ImageIcon, Paperclip, Eye,
  AlertTriangle, CheckCircle2,
} from "lucide-react";
import { projectApi, progressApi } from "../../services/index.js";
import { useApi } from "../../hooks/useApi.js";
import {
  expectedProgress, riskLevel, formatPercent, timeAgo, formatDateTime,
} from "../../utils/format.js";
import {
  PageHeader, EmptyState, SkeletonCard, StatusBadge, ProgressBar, Tabs,
} from "../../components/ui/index.js";

/**
 * A student's weekly submissions across every project, plus how each project
 * is actually tracking against its expected pace.
 */
export default function Progress() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState("all");
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const { data: projects, loading } = useApi(() => projectApi.myProjects(), [], {
    initialData: [],
  });

  const list = useMemo(
    () => (Array.isArray(projects) ? projects : projects?.projects || []),
    [projects]
  );

  // Pull every project's submissions, then flatten into one timeline.
  useEffect(() => {
    if (!list.length) {
      setLoadingEntries(false);
      return;
    }
    let active = true;
    setLoadingEntries(true);

    Promise.allSettled(
      list.map((p) => progressApi.list(p.id).then(({ data }) => ({ project: p, data })))
    ).then((results) => {
      if (!active) return;

      const flattened = [];
      results.forEach((r) => {
        if (r.status !== "fulfilled") return;
        const { project, data } = r.value;
        const rows = Array.isArray(data) ? data : data.progress || [];
        rows.forEach((entry) => flattened.push({ ...entry, project }));
      });

      flattened.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setEntries(flattened);
      setLoadingEntries(false);
    });

    return () => {
      active = false;
    };
  }, [list]);

  const visible = useMemo(
    () => (selected === "all" ? entries : entries.filter((e) => e.projectId === selected)),
    [entries, selected]
  );

  if (loading) {
    return (
      <>
        <PageHeader icon={TrendingUp} title="Weekly Progress" />
        <div className="card-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} height={180} />
          ))}
        </div>
      </>
    );
  }

  if (!list.length) {
    return (
      <>
        <PageHeader
          icon={TrendingUp}
          title="Weekly Progress"
          crumbs={[{ label: "Student", to: "/student" }, { label: "Weekly Progress" }]}
        />
        <div className="glass-card">
          <EmptyState
            icon={TrendingUp}
            title="No projects yet"
            message="Start a project first — then you can submit weekly progress against it."
            action={
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => navigate("/student/projects")}
              >
                Go to My Projects
              </button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={TrendingUp}
        title="Weekly Progress"
        subtitle="Everything you've submitted, and how each project is tracking against its expected pace."
        crumbs={[{ label: "Student", to: "/student" }, { label: "Weekly Progress" }]}
      />

      {/* Per-project pace summary */}
      <div className="card-grid-sm" style={{ marginBottom: 22 }}>
        {list.map((project) => {
          const duration = project.subject?.durationWeeks || 12;
          const expected = expectedProgress(project.currentWeek, duration);
          const risk = riskLevel(project.progress, expected);
          const submitted = entries.filter((e) => e.projectId === project.id).length;

          return (
            <div key={project.id} className="glass-card" style={{ padding: 18 }}>
              <div className="flex items-start justify-between gap-2 mb-2" style={{ flexWrap: "wrap" }}>
                <span
                  className="truncate"
                  style={{ fontSize: "0.72rem", color: "var(--purple-400)", fontWeight: 600 }}
                >
                  {project.subject?.name}
                </span>
                <span className={`badge badge-${risk.tone}`} style={{ fontSize: "0.58rem" }}>
                  {risk.label}
                </span>
              </div>

              <h3 className="truncate" style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: 10 }}>
                {project.title}
              </h3>

              <div
                className="flex items-baseline justify-between"
                style={{ fontSize: "0.72rem", marginBottom: 6 }}
              >
                <span style={{ color: "var(--slate-400)" }}>
                  Week {project.currentWeek}/{duration} · {submitted} submitted
                </span>
                <span style={{ color: "var(--white)", fontWeight: 700 }}>
                  {formatPercent(project.progress)}
                </span>
              </div>

              <ProgressBar value={project.progress} expected={expected} height={6} />

              <div style={{ fontSize: "0.68rem", color: "var(--slate-500)", marginTop: 6 }}>
                Expected {formatPercent(expected)} by now
              </div>
            </div>
          );
        })}
      </div>

      <Tabs
        active={selected}
        onChange={setSelected}
        tabs={[
          { key: "all", label: "All projects", icon: TrendingUp, badge: entries.length },
          ...list.map((p) => ({
            key: p.id,
            label: p.subject?.name || p.title,
            badge: entries.filter((e) => e.projectId === p.id).length,
          })),
        ]}
      />

      {loadingEntries ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} height={160} />
          ))}
        </div>
      ) : !visible.length ? (
        <div className="glass-card">
          <EmptyState
            icon={TrendingUp}
            title="No submissions yet"
            message="Open a project and submit your week with evidence — a screenshot, GitHub link or demo URL."
            action={
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() =>
                  navigate(`/student/projects/${selected === "all" ? list[0].id : selected}`)
                }
              >
                Open project
              </button>
            }
          />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visible.map((entry) => {
            const mentorReview = entry.reviews?.find((r) => r.mentorId);
            const facultyReview = entry.reviews?.find((r) => r.facultyId);
            const needsAttention =
              mentorReview?.status === "CHANGES_REQUIRED" ||
              mentorReview?.status === "REJECTED" ||
              facultyReview?.status === "CHANGES_REQUIRED" ||
              facultyReview?.status === "REJECTED";

            return (
              <div
                key={entry.id}
                className="glass-card"
                style={{
                  padding: 20,
                  borderColor: needsAttention ? "rgba(249,115,22,0.3)" : undefined,
                }}
              >
                <div
                  className="flex items-start justify-between gap-3 mb-3"
                  style={{ flexWrap: "wrap" }}
                >
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
                        {entry.project?.subject?.name} · {timeAgo(entry.submittedAt)}
                      </span>
                    </div>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>{entry.taskTitle}</h3>
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

                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {entry.githubUrl && (
                    <a
                      className="evidence-chip"
                      href={entry.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github size={12} /> GitHub
                    </a>
                  )}
                  {entry.demoUrl && (
                    <a
                      className="evidence-chip"
                      href={entry.demoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink size={12} /> Demo
                    </a>
                  )}
                  {(entry.screenshots || []).map((url, i) => (
                    <a
                      key={url}
                      className="evidence-chip"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ImageIcon size={12} /> Screenshot {i + 1}
                    </a>
                  ))}
                  {(entry.files || []).map((url, i) => (
                    <a
                      key={url}
                      className="evidence-chip"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Paperclip size={12} /> File {i + 1}
                    </a>
                  ))}
                </div>

                {(mentorReview?.feedback || facultyReview?.feedback) && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {[mentorReview, facultyReview]
                      .filter((r) => r?.feedback)
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
                          <div
                            className="flex items-center gap-2"
                            style={{ fontSize: "0.7rem", color: "var(--slate-500)", marginBottom: 2 }}
                          >
                            {review.mentorId ? "Mentor" : "Faculty"} feedback ·{" "}
                            {formatDateTime(review.reviewedAt)}
                          </div>
                          <p
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--slate-300)",
                              lineHeight: 1.6,
                            }}
                          >
                            {review.feedback}
                          </p>
                        </div>
                      ))}
                  </div>
                )}

                <div
                  className="flex items-center justify-between"
                  style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {needsAttention ? (
                    <span
                      className="flex items-center gap-2"
                      style={{ fontSize: "0.78rem", color: "var(--orange-500)" }}
                    >
                      <AlertTriangle size={14} />
                      Changes requested — update this submission
                    </span>
                  ) : facultyReview?.status === "APPROVED" ? (
                    <span
                      className="flex items-center gap-2"
                      style={{ fontSize: "0.78rem", color: "var(--green-400)" }}
                    >
                      <CheckCircle2 size={14} />
                      Verified by faculty
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.78rem", color: "var(--slate-500)" }}>
                      Awaiting review
                    </span>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/student/projects/${entry.projectId}`)}
                  >
                    <Eye size={13} />
                    Open project
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
