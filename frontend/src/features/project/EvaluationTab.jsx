import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Trophy, Save, Loader2, Award, Lock, CheckCircle2, Download,
  Mail, Share2, Users, User, ExternalLink, AlertCircle
} from "lucide-react";
import { evaluationApi } from "../../services/index.js";
import { apiErrorMessage, formatDateTime, formatPercent } from "../../utils/format.js";
import {
  EmptyState, SkeletonCard, ProgressBar, ConfirmationDialog, StatusBadge,
} from "../../components/ui/index.js";

/**
 * Enhanced evaluation workspace supporting:
 * - Team/Project criteria marking
 * - Individual student viva, contribution and individual criteria marking
 * - Student privacy enforcement
 * - PDF downloads (Student & Project)
 * - Result publishing, email sharing, and manual WhatsApp sharing
 */
export default function EvaluationTab({ project, refetch, user }) {
  const canEvaluate = user?.role === "FACULTY" || user?.role === "ADMIN";
  const isStudent = user?.role === "STUDENT";

  const [sheet, setSheet] = useState(null);
  const [teamMarks, setTeamMarks] = useState({});
  const [studentEvals, setStudentEvals] = useState({});
  const [facultyRemarks, setFacultyRemarks] = useState("");
  const [mentorRemarks, setMentorRemarks] = useState("");
  const [activeStudentId, setActiveStudentId] = useState(null);
  const [activeSection, setActiveSection] = useState("team"); // 'team' | 'students'

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sharing, setSharing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await evaluationApi.forProject(project.id);
      setSheet(data);

      // Populate existing team marks
      const existingTeam = {};
      (data.evaluation?.marks || []).forEach((m) => {
        existingTeam[m.criteriaId] = m.marksAwarded;
      });
      setTeamMarks(existingTeam);

      // Populate existing student evals
      const existingStudents = {};
      (data.evaluation?.studentEvaluations || []).forEach((se) => {
        const indMarks = {};
        (se.marks || []).forEach((sm) => {
          indMarks[sm.criteriaId] = sm.marksAwarded;
        });
        existingStudents[se.studentId] = {
          vivaMarks: se.vivaMarks ?? 0,
          contributionMarks: se.contributionMarks ?? 0,
          marks: indMarks,
          feedback: se.feedback || "",
        };
      });

      // Initialize default records for any missing project members
      const members = project.members || [];
      members.forEach((m) => {
        if (!existingStudents[m.studentId]) {
          existingStudents[m.studentId] = {
            vivaMarks: 0,
            contributionMarks: 0,
            marks: {},
            feedback: "",
          };
        }
      });
      setStudentEvals(existingStudents);

      if (members.length > 0 && !activeStudentId) {
        setActiveStudentId(isStudent ? user.id : members[0].studentId);
      }

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

  // Student privacy view: unpublished
  if (isStudent && sheet?.isPublished === false) {
    return (
      <div className="glass-card" style={{ padding: 32, textAlign: "center" }}>
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "rgba(59,130,246,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Lock size={26} color="var(--blue-400)" />
        </div>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 8 }}>
          Evaluation In Progress
        </h3>
        <p style={{ color: "var(--slate-400)", fontSize: "0.875rem", maxWidth: 440, margin: "0 auto" }}>
          Faculty and mentors are currently conducting final reviews. Your individual evaluation and
          grade report will appear here as soon as results are officially published.
        </p>
      </div>
    );
  }

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

  const isPublished = Boolean(sheet.isPublished || sheet.evaluation?.isPublished);
  const locked = isPublished || !canEvaluate;

  const teamCriteria = (sheet.criteria || []).filter((c) => c.scope === "TEAM" || !c.scope);
  const individualCriteria = (sheet.criteria || []).filter((c) => c.scope === "INDIVIDUAL");

  const teamTotal = teamCriteria.reduce((sum, c) => sum + (Number(teamMarks[c.id]) || 0), 0);
  const maxTotal = sheet.maxTotal || 100;

  // Selected student score computation
  const curStudentData = studentEvals[activeStudentId] || { vivaMarks: 0, contributionMarks: 0, marks: {}, feedback: "" };
  const curStudentIndCritTotal = individualCriteria.reduce(
    (sum, c) => sum + (Number(curStudentData.marks?.[c.id]) || 0),
    0
  );
  const selectedStudentTotal = Math.min(
    maxTotal,
    teamTotal + Number(curStudentData.vivaMarks || 0) + Number(curStudentData.contributionMarks || 0) + curStudentIndCritTotal
  );
  const selectedStudentPct = maxTotal > 0 ? (selectedStudentTotal / maxTotal) * 100 : 0;
  const selectedStudentGrade = gradeFor(selectedStudentPct);

  const save = async (publish) => {
    // Format student evaluations payload
    const members = project.members || [];
    const formattedStudentEvals = members.map((m) => {
      const se = studentEvals[m.studentId] || {};
      return {
        studentId: m.studentId,
        vivaMarks: Number(se.vivaMarks) || 0,
        contributionMarks: Number(se.contributionMarks) || 0,
        feedback: se.feedback || "",
        marks: individualCriteria.map((c) => ({
          criteriaId: c.id,
          marksAwarded: Number(se.marks?.[c.id]) || 0,
        })),
      };
    });

    const payload = {
      teamMarks: teamCriteria.map((c) => ({
        criteriaId: c.id,
        marksAwarded: Number(teamMarks[c.id]) || 0,
      })),
      studentEvaluations: formattedStudentEvals,
      facultyRemarks,
      mentorRemarks,
      publish,
      complete: publish,
    };

    if (publish) setPublishing(true);
    else setSaving(true);

    try {
      await evaluationApi.submit(project.id, payload);
      toast.success(publish ? "Results published! All team members have been notified." : "Draft marks saved.");
      await load();
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  const handleDownloadStudentPdf = (studentId) => {
    evaluationApi.downloadStudentPdf(project.id, studentId || activeStudentId);
  };

  const handleDownloadProjectPdf = () => {
    evaluationApi.downloadProjectPdf(project.id);
  };

  const handleShareResult = async (channel, studentId) => {
    const sid = studentId || activeStudentId;
    setSharing(channel);
    try {
      const { data } = await evaluationApi.shareStudentResult(project.id, sid, { channel });
      if (channel === "whatsapp" && data.whatsAppUrl) {
        window.open(data.whatsAppUrl, "_blank", "noopener,noreferrer");
        toast.success("WhatsApp link opened!");
      } else {
        toast.success("Result shared via email successfully.");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSharing(null);
    }
  };

  return (
    <div className="split-grid">
      {/* Mark sheet area */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Evaluation & Mark Sheet</h3>
            <p style={{ fontSize: "0.78rem", color: "var(--slate-500)" }}>
              {project.subject?.name} · Maximum {maxTotal} Marks
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isPublished && (
              <StatusBadge tone="green" label="Published" size="sm" icon={CheckCircle2} />
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadProjectPdf}
              title="Download Team Evaluation Report"
            >
              <Download size={13} />
              Team PDF
            </button>
          </div>
        </div>

        {/* Section Tabs: Team Marks vs Individual Students */}
        {!isStudent && (
          <div className="flex gap-2 mb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 10 }}>
            <button
              type="button"
              className={`btn btn-sm ${activeSection === "team" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveSection("team")}
            >
              <Users size={14} />
              Team Criteria ({teamCriteria.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm ${activeSection === "students" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveSection("students")}
            >
              <User size={14} />
              Individual Students ({project.members?.length || 0})
            </button>
          </div>
        )}

        {/* ── Section 1: Team Criteria ────────────────────────────────────── */}
        {(!isStudent && activeSection === "team") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--purple-400)" }}>
              Common Team Rubrics
            </div>
            {teamCriteria.map((criterion) => {
              const awarded = Number(teamMarks[criterion.id]) || 0;
              const ratio = criterion.maxMarks ? (awarded / criterion.maxMarks) * 100 : 0;

              return (
                <div key={criterion.id}>
                  <div className="flex items-center justify-between gap-3" style={{ marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--white)" }}>
                        {criterion.name}
                      </div>
                      {criterion.description && (
                        <div style={{ fontSize: "0.72rem", color: "var(--slate-500)" }}>
                          {criterion.description}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        className="form-input"
                        type="number"
                        min={0}
                        max={criterion.maxMarks}
                        step={0.5}
                        disabled={locked}
                        value={teamMarks[criterion.id] ?? ""}
                        placeholder="0"
                        onChange={(e) =>
                          setTeamMarks((m) => ({ ...m, [criterion.id]: e.target.value }))
                        }
                        style={{ width: 76, textAlign: "center", padding: "7px 8px" }}
                      />
                      <span style={{ fontSize: "0.8125rem", color: "var(--slate-500)" }}>
                        / {criterion.maxMarks}
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={ratio} height={5} />
                </div>
              );
            })}
          </div>
        )}

        {/* ── Section 2: Individual Students ──────────────────────────────── */}
        {(isStudent || activeSection === "students") && (
          <div>
            {/* Student Selector pills (if faculty) */}
            {!isStudent && project.members?.length > 1 && (
              <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
                {project.members.map((m) => (
                  <button
                    key={m.studentId}
                    type="button"
                    className={`btn btn-sm ${activeStudentId === m.studentId ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setActiveStudentId(m.studentId)}
                  >
                    {m.student.name}
                  </button>
                ))}
              </div>
            )}

            <div style={{ background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--white)", marginBottom: 12 }}>
                Individual Assessment for {project.members?.find((m) => m.studentId === activeStudentId)?.student?.name || "Student"}
              </div>

              {/* Viva Marks */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Individual Viva & Defense</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>Personal presentation and question-answering</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    step={0.5}
                    disabled={locked}
                    value={curStudentData.vivaMarks ?? 0}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStudentEvals((prev) => ({
                        ...prev,
                        [activeStudentId]: { ...prev[activeStudentId], vivaMarks: val },
                      }));
                    }}
                    style={{ width: 76, textAlign: "center", padding: "6px" }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--slate-500)" }}>marks</span>
                </div>
              </div>

              {/* Contribution Marks */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Individual Contribution</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>Code committed, effort and weekly consistency</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    step={0.5}
                    disabled={locked}
                    value={curStudentData.contributionMarks ?? 0}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStudentEvals((prev) => ({
                        ...prev,
                        [activeStudentId]: { ...prev[activeStudentId], contributionMarks: val },
                      }));
                    }}
                    style={{ width: 76, textAlign: "center", padding: "6px" }}
                  />
                  <span style={{ fontSize: "0.8rem", color: "var(--slate-500)" }}>marks</span>
                </div>
              </div>

              {/* Individual criteria if configured */}
              {individualCriteria.map((crit) => (
                <div key={crit.id} className="flex items-center justify-between mb-3">
                  <div>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{crit.name}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>{crit.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      max={crit.maxMarks}
                      step={0.5}
                      disabled={locked}
                      value={curStudentData.marks?.[crit.id] ?? 0}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStudentEvals((prev) => ({
                          ...prev,
                          [activeStudentId]: {
                            ...prev[activeStudentId],
                            marks: { ...(prev[activeStudentId]?.marks || {}), [crit.id]: val },
                          },
                        }));
                      }}
                      style={{ width: 76, textAlign: "center", padding: "6px" }}
                    />
                    <span style={{ fontSize: "0.8rem", color: "var(--slate-500)" }}>/ {crit.maxMarks}</span>
                  </div>
                </div>
              ))}

              {/* Individual feedback */}
              <div style={{ marginTop: 12 }}>
                <label className="form-label" style={{ fontSize: "0.75rem" }}>Student-Specific Feedback</label>
                <textarea
                  className="form-input"
                  rows={2}
                  disabled={locked}
                  placeholder="Feedback specifically for this student."
                  value={curStudentData.feedback || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStudentEvals((prev) => ({
                      ...prev,
                      [activeStudentId]: { ...prev[activeStudentId], feedback: val },
                    }));
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Remarks section */}
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="form-group mb-3">
            <label className="form-label">Faculty Overall Remarks</label>
            <textarea
              className="form-input"
              rows={2}
              disabled={locked}
              placeholder="Overall evaluation assessment of the project."
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
              placeholder="Mentor's evaluation notes."
              value={mentorRemarks}
              onChange={(e) => setMentorRemarks(e.target.value)}
            />
          </div>
        </div>

        {/* Action buttons */}
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
              total={selectedStudentTotal}
              maxTotal={maxTotal}
            />
          </div>
        )}

        {isPublished && (
          <div
            className="flex items-center justify-between"
            style={{
              marginTop: 20,
              padding: "12px 16px",
              borderRadius: 11,
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.22)",
              fontSize: "0.8125rem",
              color: "var(--green-400)",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div className="flex items-center gap-2">
              <Lock size={14} />
              Published on {formatDateTime(sheet.evaluation?.publishedAt || sheet.evaluation?.completedAt)} — Final marks.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleDownloadStudentPdf(activeStudentId)}
              >
                <Download size={13} />
                Student PDF
              </button>

              {canEvaluate && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={sharing !== null}
                    onClick={() => handleShareResult("email")}
                    title="Email Result to Student"
                  >
                    <Mail size={13} />
                    Email
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={sharing !== null}
                    onClick={() => handleShareResult("whatsapp")}
                    title="Share via WhatsApp"
                    style={{ borderColor: "rgba(34,197,94,0.4)", color: "#4ade80" }}
                  >
                    <Share2 size={13} />
                    WhatsApp
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Result summary card */}
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
            fontSize: "2.4rem",
            fontWeight: 800,
            lineHeight: 1,
            background: "var(--gradient-glow)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {selectedStudentTotal}
        </div>
        <div style={{ fontSize: "0.8125rem", color: "var(--slate-400)", marginTop: 4 }}>
          out of {maxTotal} marks
        </div>

        <div style={{ margin: "20px 0" }}>
          <ProgressBar value={selectedStudentPct} height={8} />
        </div>

        <div className="stat-row">
          <span className="stat-row-label">Percentage</span>
          <span className="stat-row-value">{formatPercent(selectedStudentPct, 1)}</span>
        </div>
        <div className="stat-row">
          <span className="stat-row-label">Letter Grade</span>
          <span className="stat-row-value" style={{ color: "var(--purple-400)", fontSize: "1rem" }}>
            {selectedStudentGrade}
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-row-label">Common Team Marks</span>
          <span className="stat-row-value">{teamTotal}</span>
        </div>
        <div className="stat-row">
          <span className="stat-row-label">Viva & Contribution</span>
          <span className="stat-row-value">
            {Number(curStudentData.vivaMarks || 0) + Number(curStudentData.contributionMarks || 0)}
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-row-label">Status</span>
          <span className="stat-row-value">{isPublished ? "Published" : "Draft"}</span>
        </div>

        {/* Quick PDF download for student */}
        {isStudent && isPublished && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ width: "100%", marginTop: 20 }}
            onClick={() => handleDownloadStudentPdf(user.id)}
          >
            <Download size={14} />
            Download My Grade Sheet (PDF)
          </button>
        )}
      </div>
    </div>
  );
}

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
        title="Publish final project marks?"
        message={`Students will be notified via email & in-app, official PDF reports will become available, and the project status will change to COMPLETED.`}
        confirmLabel="Publish Marks"
      />
    </>
  );
}

function gradeFor(percentage) {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}
