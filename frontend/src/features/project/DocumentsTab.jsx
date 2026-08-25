import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FileText, Upload, Download, CheckCircle2, XCircle, MessageSquareWarning,
  Loader2, History, ListChecks,
} from "lucide-react";
import { documentApi } from "../../services/index.js";
import { apiErrorMessage, formatDateTime, formatBytes } from "../../utils/format.js";
import { DOCUMENT_TYPES, SRS_SECTIONS } from "../../utils/constants.js";
import {
  EmptyState, Modal, StatusBadge, SkeletonCard, FileUploader,
} from "../../components/ui/index.js";

/**
 * Project documents with full version history (spec §33–§34). Uploading the
 * same type again creates a new version — nothing is ever overwritten.
 */
export default function DocumentsTab({ project, refetch, user }) {
  const isStudent = user?.role === "STUDENT";
  const canReview = ["FACULTY", "MENTOR", "ADMIN"].includes(user?.role);

  const [documents, setDocuments] = useState(project.documents || []);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await documentApi.list(project.id);
      setDocuments(Array.isArray(data) ? data : data.documents || []);
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

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} height={140} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4" style={{ gap: 12, flexWrap: "wrap" }}>
        <span className="badge badge-purple">
          {documents.length} document type{documents.length === 1 ? "" : "s"}
        </span>
        {isStudent && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setUploading(true)}>
            <Upload size={14} />
            Upload Document
          </button>
        )}
      </div>

      {!documents.length ? (
        <div className="glass-card">
          <EmptyState
            icon={FileText}
            title="No documents uploaded yet"
            message={
              isStudent
                ? "Upload your problem statement, SRS, diagrams and final report. Each re-upload becomes a new version."
                : "This team hasn't uploaded any documents yet."
            }
            action={
              isStudent && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setUploading(true)}
                >
                  <Upload size={14} />
                  Upload Document
                </button>
              )
            }
          />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {documents.map((doc) => {
            const versions = [...(doc.versions || [])].sort((a, b) => b.version - a.version);
            const latest = versions[0];
            const isOpen = expanded === doc.id;

            return (
              <div key={doc.id} className="glass-card" style={{ padding: 20 }}>
                <div
                  className="flex items-start justify-between gap-3"
                  style={{ flexWrap: "wrap" }}
                >
                  <div className="flex items-start gap-3" style={{ minWidth: 0 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 11,
                        background: "rgba(124,58,237,0.14)",
                        border: "1px solid rgba(124,58,237,0.24)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FileText size={18} color="var(--purple-400)" />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: 3 }}>
                        {DOCUMENT_TYPES[doc.type] || doc.type}
                      </h3>
                      {latest && (
                        <div style={{ fontSize: "0.75rem", color: "var(--slate-500)" }}>
                          v{latest.version} · {latest.fileName} · {formatBytes(latest.fileSize)} ·{" "}
                          {formatDateTime(latest.uploadedAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                    {latest && <StatusBadge status={latest.status} size="sm" />}
                    {latest?.fileUrl && (
                      <a
                        className="btn btn-secondary btn-sm"
                        href={latest.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        <Download size={13} />
                        Download
                      </a>
                    )}
                    {canReview && latest && latest.status === "PENDING" && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setReviewing(latest)}
                      >
                        <CheckCircle2 size={13} />
                        Review
                      </button>
                    )}
                  </div>
                </div>

                {latest?.comments && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingLeft: 12,
                      borderLeft: `2px solid ${
                        latest.status === "APPROVED"
                          ? "var(--green-500)"
                          : latest.status === "REJECTED"
                          ? "var(--red-500)"
                          : "var(--orange-500)"
                      }`,
                    }}
                  >
                    <div
                      style={{ fontSize: "0.7rem", color: "var(--slate-500)", marginBottom: 3 }}
                    >
                      Reviewer feedback ·{" "}
                      {latest.faculty?.user?.name || latest.mentor?.user?.name || "Reviewer"}
                    </div>
                    <p style={{ fontSize: "0.8125rem", color: "var(--slate-300)", lineHeight: 1.6 }}>
                      {latest.comments}
                    </p>
                  </div>
                )}

                {versions.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : doc.id)}
                      className="flex items-center gap-2"
                      style={{
                        marginTop: 14,
                        fontSize: "0.78rem",
                        color: "var(--purple-400)",
                        fontWeight: 600,
                      }}
                    >
                      <History size={13} />
                      {isOpen ? "Hide" : "Show"} version history ({versions.length})
                    </button>

                    {isOpen && (
                      <div
                        style={{
                          marginTop: 12,
                          paddingTop: 12,
                          borderTop: "1px solid rgba(255,255,255,0.06)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {versions.map((version) => (
                          <div
                            key={version.id}
                            className="flex items-center justify-between gap-3"
                            style={{
                              padding: "9px 12px",
                              borderRadius: 9,
                              background: "rgba(255,255,255,0.03)",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                className="flex items-center gap-2"
                                style={{ fontSize: "0.8125rem", fontWeight: 600 }}
                              >
                                Version {version.version}
                                <StatusBadge status={version.status} size="sm" />
                              </div>
                              <div style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>
                                {formatDateTime(version.uploadedAt)}
                                {version.reviewedAt &&
                                  ` · reviewed ${formatDateTime(version.reviewedAt)}`}
                              </div>
                              {version.comments && (
                                <p
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "var(--slate-400)",
                                    marginTop: 4,
                                  }}
                                >
                                  {version.comments}
                                </p>
                              )}
                            </div>

                            <a
                              className="btn btn-secondary btn-sm"
                              href={version.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                            >
                              <Download size={12} />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {uploading && (
        <UploadModal
          project={project}
          existingTypes={documents.map((d) => d.type)}
          onClose={() => setUploading(false)}
          onDone={async () => {
            setUploading(false);
            await load();
            refetch();
          }}
        />
      )}

      {reviewing && (
        <DocumentReviewModal
          version={reviewing}
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

function UploadModal({ project, existingTypes, onClose, onDone }) {
  const [type, setType] = useState("SRS");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const isNewVersion = existingTypes.includes(type);

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    setSaving(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("type", type);
      const { data: result } = await documentApi.upload(project.id, data);
      toast.success(
        result.version > 1
          ? `Uploaded as version ${result.version} — reviewers notified.`
          : "Document uploaded — reviewers notified."
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
      title="Upload Document"
      subtitle="Re-uploading an existing type creates a new version — the old one is kept."
      width={600}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="doc-form" className="btn btn-primary" disabled={saving}>
            {saving ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
            {saving ? "Uploading…" : "Upload"}
          </button>
        </>
      }
    >
      <form id="doc-form" onSubmit={submit}>
        <div className="form-group mb-4">
          <label className="form-label">Document Type</label>
          <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
                {existingTypes.includes(value) ? "  (new version)" : ""}
              </option>
            ))}
          </select>
          {isNewVersion && (
            <span style={{ fontSize: "0.72rem", color: "var(--yellow-400)" }}>
              A {DOCUMENT_TYPES[type]} already exists — this will be added as the next version.
            </span>
          )}
        </div>

        {/* SRS checklist so students know what a complete document contains */}
        {type === "SRS" && (
          <div
            style={{
              padding: "13px 15px",
              borderRadius: 11,
              background: "rgba(124,58,237,0.07)",
              border: "1px solid rgba(124,58,237,0.18)",
              marginBottom: 18,
            }}
          >
            <div
              className="flex items-center gap-2"
              style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--purple-300)", marginBottom: 8 }}
            >
              <ListChecks size={14} />
              A complete SRS should cover
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {SRS_SECTIONS.map((section) => (
                <span
                  key={section}
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--slate-400)",
                    background: "rgba(255,255,255,0.05)",
                    padding: "3px 8px",
                    borderRadius: 99,
                  }}
                >
                  {section}
                </span>
              ))}
            </div>
          </div>
        )}

        <FileUploader
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg,.apk,.mp4"
          maxSizeMb={50}
          label="Drop your document here, or click to browse"
          value={file ? [file] : []}
          onFilesSelected={(files) => setFile(files[0])}
          onRemove={() => setFile(null)}
        />
      </form>
    </Modal>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function DocumentReviewModal({ version, onClose, onDone }) {
  const [status, setStatus] = useState("APPROVED");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  const commentRequired = status !== "APPROVED";
  const tooShort = commentRequired && comments.trim().length < 10;

  const submit = async (e) => {
    e.preventDefault();
    if (tooShort) {
      toast.error("Please explain your decision in at least 10 characters.");
      return;
    }
    setSaving(true);
    try {
      await documentApi.reviewVersion(version.id, {
        status,
        comments: comments.trim() || undefined,
      });
      toast.success("Review recorded.");
      onDone();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const options = [
    { value: "APPROVED", label: "Approve", icon: CheckCircle2, color: "var(--green-400)" },
    { value: "CHANGES_REQUIRED", label: "Request changes", icon: MessageSquareWarning, color: "var(--orange-500)" },
    { value: "REJECTED", label: "Reject", icon: XCircle, color: "var(--red-400)" },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={`Review version ${version.version}`}
      subtitle={version.fileName}
      width={540}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="doc-review-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Submitting…" : "Submit Review"}
          </button>
        </>
      }
    >
      <a
        className="btn btn-secondary btn-sm"
        href={version.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        download
        style={{ marginBottom: 18 }}
      >
        <Download size={13} />
        Download and read the document
      </a>

      <form id="doc-review-form" onSubmit={submit}>
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
            placeholder="e.g. The functional requirements are thorough, but the DFD is missing level 1."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
          {tooShort && comments.length > 0 && (
            <span className="form-error">At least 10 characters, please.</span>
          )}
        </div>
      </form>
    </Modal>
  );
}
