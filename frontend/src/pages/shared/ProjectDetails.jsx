import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  LayoutDashboard, CalendarRange, TrendingUp, FileText, MessageSquareQuote,
  MessageSquare, Presentation as PresentationIcon, Trophy, History,
  ArrowLeft, User, UserCheck, BookOpen, Layers, Sparkles, AlertTriangle,
  FileDown, UserPlus, X, Loader2, CheckCircle2,
} from "lucide-react";
import { projectApi, studentApi } from "../../services/index.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  expectedProgress, riskLevel, formatPercent, formatDate, apiErrorMessage,
} from "../../utils/format.js";
import {
  PageHeader, Tabs, StatusBadge, ProgressBar, CircularProgress, EmptyState,
  SkeletonCard, Modal,
} from "../../components/ui/index.js";

import OverviewTab from "../../features/project/OverviewTab.jsx";
import TimelineTab from "../../features/project/TimelineTab.jsx";
import ProgressTab from "../../features/project/ProgressTab.jsx";
import DocumentsTab from "../../features/project/DocumentsTab.jsx";
import FeedbackTab from "../../features/project/FeedbackTab.jsx";
import ChatTab from "../../features/project/ChatTab.jsx";
import PresentationTab from "../../features/project/PresentationTab.jsx";
import EvaluationTab from "../../features/project/EvaluationTab.jsx";
import ActivityTab from "../../features/project/ActivityTab.jsx";

const normalizeTabKey = (raw) => {
  const key = (raw || "").toLowerCase().trim();
  if (!key) return null;
  if (key === "idea" || key === "overview") return "overview";
  if (key === "timeline" || key === "milestones") return "timeline";
  if (key === "progress" || key === "weekly" || key === "weekly-progress") return "progress";
  if (key === "documents" || key === "document" || key === "files") return "documents";
  if (key === "feedback" || key === "remarks") return "feedback";
  if (key === "chat" || key === "messages") return "chat";
  if (key === "presentation" || key === "presentations") return "presentation";
  if (key === "evaluation" || key === "evaluations" || key === "marks") return "evaluation";
  if (key === "activity" || key === "history" || key === "logs") return "activity";
  return null;
};

/**
 * Project workspace with the nine tabs from spec §54. Everything a project
 * accumulates over the semester lives here; the header always shows the
 * expected-vs-actual comparison.
 */
export default function ProjectDetails() {
  const { id, subpath } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const initialTab = normalizeTabKey(subpath) || normalizeTabKey(searchParams.get("tab")) || "overview";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const nextTab = normalizeTabKey(subpath) || normalizeTabKey(searchParams.get("tab"));
    if (nextTab && nextTab !== tab) {
      setTab(nextTab);
    }
  }, [subpath, searchParams]);

  const { data: project, loading, error, refetch } = useApi(() => projectApi.get(id), [id]);

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [memberEnrollment, setMemberEnrollment] = useState("");
  const [peerSuggestions, setPeerSuggestions] = useState([]);
  const [savingMember, setSavingMember] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState(null);

  const isStaff = user?.role === "ADMIN" || user?.role === "FACULTY";
  const isTeamLead = project?.members?.some((m) => m.studentId === user?.id && m.isLead);
  const canManageTeam = isStaff || isTeamLead;

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await projectApi.downloadReportPdf(project.id);
      toast.success("Academic Report PDF downloaded successfully.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDownloadingPdf(false);
    }
  };

  useEffect(() => {
    if (!memberEnrollment || memberEnrollment.trim().length < 2) {
      setPeerSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await studentApi.searchPeers(memberEnrollment.trim());
        setPeerSuggestions(res?.data?.students || []);
      } catch {
        /* silent */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [memberEnrollment]);

  const handleAddMember = async (enrollment) => {
    const val = (enrollment || memberEnrollment).trim();
    if (!val) {
      toast.error("Please enter teammate's enrollment number.");
      return;
    }
    setSavingMember(true);
    try {
      await projectApi.addMember(project.id, { enrollmentNumber: val });
      toast.success("Teammate added and invitation sent.");
      setMemberEnrollment("");
      setPeerSuggestions([]);
      setAddingMember(false);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSavingMember(false);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this project?`)) return;
    setRemovingMemberId(memberId);
    try {
      await projectApi.removeMember(project.id, memberId);
      toast.success(`${memberName} removed from project.`);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setRemovingMemberId(null);
    }
  };

  const derived = useMemo(() => {
    if (!project) return null;
    const durationWeeks = project.subject?.durationWeeks || 12;
    const expected = expectedProgress(project.currentWeek, durationWeeks);
    return {
      durationWeeks,
      expected,
      risk: riskLevel(project.progress, expected),
      pendingReviews:
        project.weeklyProgress?.filter((wp) => !wp.reviews?.some((r) => r.status === "APPROVED"))
          .length || 0,
    };
  }, [project]);

  const homePath = `/${user?.role?.toLowerCase()}`;

  if (loading) {
    return (
      <>
        <PageHeader title="Loading project…" crumbs={[{ label: "Projects", to: `${homePath}/projects` }]} />
        <div className="card-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} height={200} />
          ))}
        </div>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <PageHeader title="Project" crumbs={[{ label: "Projects", to: `${homePath}/projects` }]} />
        <div className="glass-card">
          <EmptyState
            icon={AlertTriangle}
            title="Project not available"
            message={
              error ||
              "This project either doesn't exist or isn't part of what your account can access."
            }
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate(-1)}>
                <ArrowLeft size={14} />
                Go back
              </button>
            }
          />
        </div>
      </>
    );
  }

  const tabs = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "timeline", label: "Timeline", icon: CalendarRange },
    { key: "progress", label: "Weekly Progress", icon: TrendingUp, badge: derived.pendingReviews },
    { key: "documents", label: "Documents", icon: FileText },
    { key: "feedback", label: "Feedback", icon: MessageSquareQuote },
    { key: "chat", label: "Chat", icon: MessageSquare },
    { key: "presentation", label: "Presentation", icon: PresentationIcon },
    { key: "evaluation", label: "Evaluation", icon: Trophy },
    { key: "activity", label: "Activity", icon: History },
  ];

  const shared = { project, refetch, user, derived };

  return (
    <>
      <PageHeader
        title={project.title}
        crumbs={[
          { label: "Projects", to: `${homePath}/projects` },
          { label: project.subject?.name || "Project" },
        ]}
        actions={
          <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm flex items-center gap-1"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              title="Download official Academic Evaluation & Project Report (PDF)"
            >
              {downloadingPdf ? <Loader2 size={13} className="spin" /> : <FileDown size={13} />}
              Academic Report (PDF)
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>
              <ArrowLeft size={13} />
              Back
            </button>
          </div>
        }
      />

      {/* ── Header card: identity + the expected-vs-actual comparison ────── */}
      <div className="glass-card" style={{ padding: 22, marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            gap: 26,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div style={{ flex: "1 1 340px", minWidth: 0 }}>
            <div className="flex items-center gap-2 mb-3" style={{ flexWrap: "wrap" }}>
              <StatusBadge status={project.status} />
              <span className={`badge badge-${derived.risk.tone}`}>{derived.risk.label}</span>
              <span
                className="flex items-center gap-1"
                style={{ fontSize: "0.72rem", color: "var(--slate-500)" }}
              >
                <CalendarRange size={12} />
                Week {project.currentWeek} of {derived.durationWeeks}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <Fact icon={BookOpen} label="Subject" value={project.subject?.name} />
              <Fact icon={Layers} label="Domain" value={project.domain?.name || "Not set"} />
              <Fact icon={User} label="Faculty" value={project.faculty?.user?.name} />
              <Fact
                icon={UserCheck}
                label="Mentor"
                value={project.mentor?.user?.name || "Not yet assigned"}
                warn={!project.mentor}
              />
            </div>

            <div>
              <div
                className="flex items-baseline justify-between"
                style={{ marginBottom: 7, flexWrap: "wrap", gap: 8 }}
              >
                <span style={{ fontSize: "0.78rem", color: "var(--slate-400)", fontWeight: 500 }}>
                  Actual vs expected progress
                </span>
                <span style={{ fontSize: "0.78rem" }}>
                  <strong style={{ color: "var(--white)" }}>
                    {formatPercent(project.progress, 1)}
                  </strong>
                  <span style={{ color: "var(--slate-500)" }}>
                    {" "}
                    against {formatPercent(derived.expected)} expected
                  </span>
                </span>
              </div>
              <ProgressBar value={project.progress} expected={derived.expected} height={9} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
            <CircularProgress
              value={project.progress}
              expected={derived.expected}
              size={124}
              label="Complete"
              sublabel={`Week ${project.currentWeek}`}
            />

            <div style={{ minWidth: 130 }}>
              <MiniStat label="Submissions" value={project._count?.weeklyProgress ?? 0} />
              <MiniStat label="Documents" value={project._count?.documents ?? 0} />
              <MiniStat label="Milestones" value={project.milestones?.length ?? 0} />
              <MiniStat
                label="Started"
                value={project.startDate ? formatDate(project.startDate) : "Not started"}
              />
            </div>
          </div>
        </div>

        {project.members?.length > 0 && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "0.72rem", color: "var(--slate-500)", fontWeight: 600 }}>
              TEAM
            </span>
            {project.members.map((m) => (
              <span
                key={m.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 12px",
                  borderRadius: 99,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  fontSize: "0.78rem",
                }}
              >
                <span style={{ color: "var(--white)", fontWeight: 600 }}>{m.student.name}</span>
                <span style={{ color: "var(--slate-500)", fontSize: "0.7rem" }}>
                  {m.student.enrollmentNumber}
                </span>
                {m.isLead && (
                  <Sparkles size={11} color="var(--yellow-400)" aria-label="Team lead" />
                )}
                {!m.isLead && canManageTeam && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id, m.student.name)}
                    disabled={removingMemberId === m.id}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      color: "var(--slate-500)",
                    }}
                    title={`Remove ${m.student.name}`}
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
            {canManageTeam && (
              <button
                type="button"
                onClick={() => setAddingMember(true)}
                className="btn btn-secondary btn-sm"
                style={{
                  padding: "4px 10px",
                  fontSize: "0.72rem",
                  borderRadius: 99,
                }}
              >
                <UserPlus size={12} />
                Add Teammate
              </button>
            )}
          </div>
        )}
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "overview" && <OverviewTab {...shared} />}
      {tab === "timeline" && <TimelineTab {...shared} />}
      {tab === "progress" && <ProgressTab {...shared} />}
      {tab === "documents" && <DocumentsTab {...shared} />}
      {tab === "feedback" && <FeedbackTab {...shared} />}
      {tab === "chat" && <ChatTab {...shared} />}
      {tab === "presentation" && <PresentationTab {...shared} />}
      {tab === "evaluation" && <EvaluationTab {...shared} />}
      {tab === "activity" && <ActivityTab {...shared} />}

      {addingMember && (
        <Modal
          open
          onClose={() => {
            setAddingMember(false);
            setMemberEnrollment("");
            setPeerSuggestions([]);
          }}
          title="Add Team Member"
          subtitle={`Add another student to "${project.title}". They will receive an invitation and gain shared access.`}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setAddingMember(false);
                  setMemberEnrollment("");
                  setPeerSuggestions([]);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleAddMember()}
                disabled={savingMember || !memberEnrollment.trim()}
              >
                {savingMember ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />}
                Add Teammate
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Teammate Enrollment Number or Name</label>
              <input
                className="form-input"
                placeholder="e.g. 92301733021 or Yash"
                value={memberEnrollment}
                onChange={(e) => setMemberEnrollment(e.target.value)}
                autoFocus
              />
            </div>

            {peerSuggestions.length > 0 && (
              <div>
                <span style={{ fontSize: "0.72rem", color: "var(--slate-400)", fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Matching Students:
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {peerSuggestions.map((p) => {
                    const alreadyInTeam = project.members?.some((m) => m.studentId === p.id);
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderRadius: 6,
                          background: "rgba(255, 255, 255, 0.03)",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--slate-500)" }}>
                            {p.enrollmentNumber} • {p.email}
                          </div>
                        </div>
                        {alreadyInTeam ? (
                          <span className="badge badge-gray" style={{ fontSize: "0.68rem" }}>
                            Already on team
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: "0.72rem" }}
                            onClick={() => handleAddMember(p.enrollmentNumber)}
                            disabled={savingMember}
                          >
                            Select & Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Fact({ icon: Icon, label, value, warn }) {
  return (
    <div>
      <div
        className="flex items-center gap-1"
        style={{ fontSize: "0.66rem", color: "var(--slate-500)", fontWeight: 600, marginBottom: 3 }}
      >
        <Icon size={11} />
        {label.toUpperCase()}
      </div>
      <div
        className="truncate"
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: warn ? "var(--yellow-400)" : "var(--white)",
        }}
        title={value}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "6px 0",
        fontSize: "0.78rem",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <span style={{ color: "var(--slate-400)" }}>{label}</span>
      <span style={{ color: "var(--white)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}
