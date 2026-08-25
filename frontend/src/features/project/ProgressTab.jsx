import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  TrendingUp, Plus, Github, ExternalLink, Paperclip, Image as ImageIcon,
  CheckCircle2, XCircle, MessageSquareWarning, Loader2, Upload, ShieldCheck,
} from "lucide-react";
import { progressApi } from "../../services/index.js";
import { apiErrorMessage, formatDateTime, formatBytes } from "../../utils/format.js";
import {
  EmptyState, Modal, StatusBadge, SkeletonCard, FileUploader,
} from "../../components/ui/index.js";

const emptyForm = {
  weekNumber: 1,
  taskTitle: "",
  description: "",
  completedWork: "",
  problemsFaced: "",
  nextWeekPlan: "",
  githubUrl: "",
  demoUrl: "",
  screenshots: [],
  files: [],
};

/**
 * Weekly progress with evidence (spec §36–§39). Students submit, mentors
 * review, faculty verify — and a submission without evidence is rejected by
 * both this form and the server.
 */
export default function ProgressTab({ project, refetch, user, derived }) {
  const isStudent = user?.role === "STUDENT";
  const isMentor = user?.role === "MENTOR";
  const isFaculty = user?.role === "FACULTY" || user?.role === "ADMIN";

  const [entries, setEntries] = useState(project.weeklyProgress || []);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [reviewing, setReviewing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await progressApi.list(project.id);
      setEntries(Array.isArray(data) ? data : data.progress || []);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!project.weeklyProgress) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const submittedWeeks = useMemo(() => new Set(entries.map((e) => e.weekNumber)), [entries]);
  const nextWeek = Math.max(1, project.currentWeek || 1);

  const openSubmit = (week = nextWeek) => {
    const existing = entries.find((e) => e.weekNumber === week);
    setForm(
      existing
        ? {
            weekNumber: existing.weekNumber,
            taskTitle: existing.taskTitle,
            description: existing.description,
            completedWork: existing.completedWork,
            problemsFaced: existing.problemsFaced || "",
            nextWeekPlan: existing.nextWeekPlan || "",
            githubUrl: existing.githubUrl || "",
            demoUrl: existing.demoUrl || "",
            screenshots: existing.screenshots || [],
            files: existing.files || [],
          }
        : { ...emptyForm, weekNumber: week }
    );
    setSubmitting(true);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} height={160} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="flex items-center gap-3" style={{ flexWrap: "wrap" }}>
          <span className="badge badge-purple">
            {entries.length} of {derived.durationWeeks} weeks submitted
          </span>
          {submittedWeeks.has(project.currentWeek) ? (
            <span className="badge badge-green">Week {project.currentWeek} submitted</span>
          ) : (
            <span className="badge badge-yellow">Week {project.currentWeek} outstanding</span>
          )}
        </div>

        {isStudent && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openSubmit()}>
            <Plus size={14} />
            {submittedWeeks.has(nextWeek) ? `Update Week ${nextWeek}` : `Submit Week ${nextWeek}`}
          </button>
        )}
      </div>

      {!entries.length ? (
        <div className="glass-card">
          <EmptyState
            icon={TrendingUp}
            title="No weekly progress submitted yet"
            message={
              isStudent
                ? "Submit your first week with evidence — a screenshot, GitHub link or demo URL. Written claims alone aren't accepted."
                : "This team hasn't submitted any weekly progress yet."
            }
            action={
              isStudent && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => openSubmit()}>
                  <Plus size={14} />
                  Submit Week {nextWeek}
                </button>
              )
            }
          />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[...entries]
            .sort((a, b) => b.weekNumber - a.weekNumber)
            .map((entry) => (
              <ProgressEntry
                key={entry.id}
                entry={entry}
                isStudent={isStudent}
                canReview={isMentor || isFaculty}
                isFaculty={isFaculty}
                onEdit={() => openSubmit(entry.weekNumber)}
                onReview={() => setReviewing(entry)}
              />
            ))}
        </div>
      )}

      {submitting && (
        <SubmitModal
          project={project}
          form={form}
          setForm={setForm}
          durationWeeks={derived.durationWeeks}
          onClose={() => setSubmitting(false)}
          onDone={async () => {
            setSubmitting(false);
            await load();
            refetch();
          }}
        />
      )}

      {reviewing && (
        <ReviewModal
          entry={reviewing}
          isFaculty={isFaculty}
          onClose={() => setReviewing(null)}
          onDone={async () => {
            setReviewing(null);
            await load();
            refetch();
          }}
        />
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function ProgressEntry({ entry, isStudent, canReview, isFaculty, onEdit, onReview }) {
  const mentorReview = entry.reviews?.find((r) => r.mentorId);
  const facultyReview = entry.reviews?.find((r) => r.facultyId);

  // Faculty verify only after the mentor has approved (spec §39).
  const awaitingMe = isFaculty
    ? mentorReview?.status === "APPROVED" && !facultyReview
    : !mentorReview;

  const evidence = [
    ...(entry.screenshots || []).map((url) => ({ url, kind: "image" })),
    ...(entry.files || []).map((url) => ({ url, kind: "file" })),
  ];

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
              {formatDateTime(entry.submittedAt)}
            </span>
          </div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>{entry.taskTitle}</h3>
        </div>

        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.66rem", color: "var(--slate-500)" }}>Mentor</span>
          <StatusBadge status={mentorReview?.status || "PENDING"} size="sm" />
          <span style={{ fontSize: "0.66rem", color: "var(--slate-500)", marginLeft: 4 }}>
            Faculty
          </span>
          <StatusBadge status={facultyReview?.status || "PENDING"} size="sm" />
        </div>
      </div>

      <Field label="What was done" value={entry.completedWork} />
      <Field label="Description" value={entry.description} />
      {entry.problemsFaced && <Field label="Problems faced" value={entry.problemsFaced} />}
      {entry.nextWeekPlan && <Field label="Next week's plan" value={entry.nextWeekPlan} />}

      {/* Evidence */}
      {(entry.githubUrl || entry.demoUrl || evidence.length > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {entry.githubUrl && (
            <a
              className="evidence-chip"
              href={entry.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={13} />
              GitHub
              <ExternalLink size={10} style={{ opacity: 0.6 }} />
            </a>
          )}
          {entry.demoUrl && (
            <a
              className="evidence-chip"
              href={entry.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={13} />
              Live demo
            </a>
          )}
          {evidence.map((item, i) => (
            <a
              key={`${item.url}-${i}`}
              className="evidence-chip"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.kind === "image" ? <ImageIcon size={13} /> : <Paperclip size={13} />}
              {item.kind === "image" ? `Screenshot ${i + 1}` : "Attachment"}
            </a>
          ))}
        </div>
      )}

      {/* Reviews */}
      {(mentorReview?.feedback || facultyReview?.feedback) && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {mentorReview?.feedback && (
            <ReviewNote
              who={`Mentor · ${mentorReview.mentor?.user?.name || ""}`}
              status={mentorReview.status}
              text={mentorReview.feedback}
              at={mentorReview.reviewedAt}
            />
          )}
          {facultyReview?.feedback && (
            <ReviewNote
              who={`Faculty · ${facultyReview.faculty?.user?.name || ""}`}
              status={facultyReview.status}
              text={facultyReview.feedback}
              at={facultyReview.reviewedAt}
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div
        className="flex gap-2"
        style={{ marginTop: 16, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {isStudent && !facultyReview && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
            Update submission
          </button>
        )}
        {canReview && (
          <button
            type="button"
            className={`btn btn-sm ${awaitingMe ? "btn-primary" : "btn-secondary"}`}
            onClick={onReview}
          >
            {isFaculty ? <ShieldCheck size={13} /> : <CheckCircle2 size={13} />}
            {isFaculty ? "Verify" : "Review"}
            {awaitingMe && " — awaiting you"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: "0.66rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--slate-500)",
          marginBottom: 3,
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
  );
}

function ReviewNote({ who, status, text, at }) {
  const tone =
    status === "APPROVED" ? "green-500" : status === "REJECTED" ? "red-500" : "orange-500";
  return (
    <div style={{ paddingLeft: 12, borderLeft: `2px solid var(--${tone})` }}>
      <div className="flex items-center gap-2 mb-1" style={{ flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--white)" }}>{who}</span>
        <StatusBadge status={status} size="sm" />
        <span style={{ fontSize: "0.68rem", color: "var(--slate-500)" }}>
          {formatDateTime(at)}
        </span>
      </div>
      <p style={{ fontSize: "0.8125rem", color: "var(--slate-300)", lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function SubmitModal({ project, form, setForm, durationWeeks, onClose, onDone }) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const hasEvidence =
    form.screenshots.length > 0 ||
    form.files.length > 0 ||
    Boolean(form.githubUrl.trim()) ||
    Boolean(form.demoUrl.trim());

  const upload = async (files, target) => {
    setUploading(true);
    try {
      const data = new FormData();
      files.forEach((f) => data.append("files", f));
      const { data: stored } = await progressApi.uploadEvidence(project.id, data);
      setForm((f) => ({ ...f, [target]: [...f[target], ...stored.map((s) => s.url)] }));
      toast.success(`${stored.length} file(s) uploaded.`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!hasEvidence) {
      toast.error("Attach evidence — a screenshot, file, GitHub link or demo URL.");
      return;
    }
    setSaving(true);
    try {
      await progressApi.submit(project.id, {
        ...form,
        weekNumber: Number(form.weekNumber),
        githubUrl: form.githubUrl.trim() || undefined,
        demoUrl: form.demoUrl.trim() || undefined,
      });
      toast.success(`Week ${form.weekNumber} submitted — your mentor has been notified.`);
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
      title={`Week ${form.weekNumber} Progress`}
      subtitle="Evidence is mandatory — a written claim on its own can't be verified."
      width={680}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="progress-form"
            className="btn btn-primary"
            disabled={saving || uploading}
          >
            {saving ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
            {saving ? "Submitting…" : "Submit Progress"}
          </button>
        </>
      }
    >
      <form id="progress-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Week Number</label>
            <select
              className="form-input"
              value={form.weekNumber}
              onChange={(e) => setForm((f) => ({ ...f, weekNumber: Number(e.target.value) }))}
            >
              {Array.from({ length: durationWeeks }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Task Title</label>
            <input
              className="form-input"
              required
              placeholder="e.g. Backend authentication APIs"
              value={form.taskTitle}
              onChange={(e) => setForm((f) => ({ ...f, taskTitle: e.target.value }))}
            />
          </div>

          <div className="form-group form-grid-full">
            <label className="form-label">Completed Work</label>
            <textarea
              className="form-input"
              rows={3}
              required
              minLength={20}
              placeholder="What did you actually finish this week? Be specific."
              value={form.completedWork}
              onChange={(e) => setForm((f) => ({ ...f, completedWork: e.target.value }))}
            />
          </div>

          <div className="form-group form-grid-full">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              rows={2}
              required
              minLength={20}
              placeholder="How did you approach it?"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Problems Faced</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="Anything blocking you?"
              value={form.problemsFaced}
              onChange={(e) => setForm((f) => ({ ...f, problemsFaced: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Next Week's Plan</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="What will you tackle next?"
              value={form.nextWeekPlan}
              onChange={(e) => setForm((f) => ({ ...f, nextWeekPlan: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">GitHub URL</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://github.com/you/project/commit/…"
              value={form.githubUrl}
              onChange={(e) => setForm((f) => ({ ...f, githubUrl: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Demo URL</label>
            <input
              className="form-input"
              type="url"
              placeholder="https://your-demo.vercel.app"
              value={form.demoUrl}
              onChange={(e) => setForm((f) => ({ ...f, demoUrl: e.target.value }))}
            />
          </div>
        </div>

        {/* Evidence */}
        <div style={{ marginTop: 18 }}>
          <label className="form-label">Screenshots & Files</label>
          <FileUploader
            multiple
            accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.zip,.docx,.pptx,.mp4"
            maxSizeMb={50}
            label={uploading ? "Uploading…" : "Drop screenshots or files here"}
            hint="Images, PDFs, decks, archives or a short demo video"
            disabled={uploading}
            onFilesSelected={(files) => {
              const images = files.filter((f) => f.type.startsWith("image/"));
              const others = files.filter((f) => !f.type.startsWith("image/"));
              if (images.length) upload(images, "screenshots");
              if (others.length) upload(others, "files");
            }}
          />

          {(form.screenshots.length > 0 || form.files.length > 0) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {form.screenshots.map((url, i) => (
                <span key={url} className="evidence-chip">
                  <ImageIcon size={12} />
                  Screenshot {i + 1}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        screenshots: f.screenshots.filter((u) => u !== url),
                      }))
                    }
                    style={{ color: "var(--red-400)", marginLeft: 3, display: "flex" }}
                    aria-label="Remove screenshot"
                  >
                    <XCircle size={12} />
                  </button>
                </span>
              ))}
              {form.files.map((url, i) => (
                <span key={url} className="evidence-chip">
                  <Paperclip size={12} />
                  File {i + 1}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, files: f.files.filter((u) => u !== url) }))
                    }
                    style={{ color: "var(--red-400)", marginLeft: 3, display: "flex" }}
                    aria-label="Remove file"
                  >
                    <XCircle size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {!hasEvidence && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(234,179,8,0.08)",
                border: "1px solid rgba(234,179,8,0.22)",
                fontSize: "0.78rem",
                color: "var(--yellow-400)",
              }}
            >
              <Upload size={14} style={{ flexShrink: 0 }} />
              Add at least one piece of evidence before submitting.
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function ReviewModal({ entry, isFaculty, onClose, onDone }) {
  const [status, setStatus] = useState("APPROVED");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const feedbackRequired = status !== "APPROVED";
  const tooShort = feedbackRequired && feedback.trim().length < 10;

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
    { value: "APPROVED", label: isFaculty ? "Verify" : "Approve", icon: CheckCircle2, color: "var(--green-400)" },
    { value: "CHANGES_REQUIRED", label: "Request changes", icon: MessageSquareWarning, color: "var(--orange-500)" },
    { value: "REJECTED", label: "Reject", icon: XCircle, color: "var(--red-400)" },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={`${isFaculty ? "Verify" : "Review"} Week ${entry.weekNumber}`}
      subtitle={entry.taskTitle}
      width={560}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="review-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Submitting…" : "Submit"}
          </button>
        </>
      }
    >
      {/* Remind the reviewer what evidence was actually provided */}
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 11,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--slate-500)", marginBottom: 7 }}>
          EVIDENCE PROVIDED
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {entry.githubUrl && (
            <a className="evidence-chip" href={entry.githubUrl} target="_blank" rel="noopener noreferrer">
              <Github size={12} /> GitHub
            </a>
          )}
          {entry.demoUrl && (
            <a className="evidence-chip" href={entry.demoUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={12} /> Demo
            </a>
          )}
          {(entry.screenshots || []).map((url, i) => (
            <a key={url} className="evidence-chip" href={url} target="_blank" rel="noopener noreferrer">
              <ImageIcon size={12} /> Screenshot {i + 1}
            </a>
          ))}
          {(entry.files || []).map((url, i) => (
            <a key={url} className="evidence-chip" href={url} target="_blank" rel="noopener noreferrer">
              <Paperclip size={12} /> File {i + 1}
            </a>
          ))}
          {!entry.githubUrl &&
            !entry.demoUrl &&
            !entry.screenshots?.length &&
            !entry.files?.length && (
              <span style={{ fontSize: "0.78rem", color: "var(--red-400)" }}>
                No evidence attached.
              </span>
            )}
        </div>
      </div>

      <form id="review-form" onSubmit={submit}>
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
            {feedbackRequired ? (
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
