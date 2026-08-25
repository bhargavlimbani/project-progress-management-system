import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FileText, Download, CheckCircle2, XCircle, MessageSquareWarning, Eye, Clock,
} from "lucide-react";
import { projectApi, documentApi } from "../../services/index.js";
import { useApi } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  apiErrorMessage, formatDateTime, formatBytes, timeAgo,
} from "../../utils/format.js";
import { DOCUMENT_TYPES } from "../../utils/constants.js";
import {
  PageHeader, EmptyState, Modal, StatusBadge, SkeletonCard, SearchBar, Tabs,
} from "../../components/ui/index.js";

/**
 * Cross-project document review queue for faculty and mentors (spec §33–§34).
 * Only the latest version of each document type is actionable; older versions
 * stay readable inside the project's Documents tab.
 */
export default function DocumentReviews() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const basePath = `/${user?.role?.toLowerCase()}/projects`;

  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);

  const { data: projectData } = useApi(() => projectApi.list({ limit: 200 }), [], {
    initialData: { projects: [] },
  });

  const projects = projectData?.projects || [];

  // Fan out across the caller's projects and flatten to a single queue.
  const load = async () => {
    if (!projects.length) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const results = await Promise.allSettled(
      projects.map((p) => documentApi.list(p.id).then(({ data }) => ({ project: p, data })))
    );

    const flattened = [];
    results.forEach((result) => {
      if (result.status !== "fulfilled") return;
      const { project, data } = result.value;
      const documents = Array.isArray(data) ? data : data.documents || [];

      documents.forEach((doc) => {
        const versions = [...(doc.versions || [])].sort((a, b) => b.version - a.version);
        const latest = versions[0];
        if (!latest) return;
        flattened.push({ project, doc, latest, versionCount: versions.length });
      });
    });

    flattened.sort((a, b) => new Date(b.latest.uploadedAt) - new Date(a.latest.uploadedAt));
    setRows(flattened);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectData]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const isPending = row.latest.status === "PENDING";
      if (tab === "pending" && !isPending) return false;
      if (tab === "reviewed" && isPending) return false;

      if (!term) return true;
      return [
        row.project.title,
        row.project.subject?.name,
        DOCUMENT_TYPES[row.doc.type] || row.doc.type,
        row.latest.fileName,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [rows, tab, search]);

  const pendingCount = rows.filter((r) => r.latest.status === "PENDING").length;

  return (
    <>
      <PageHeader
        icon={FileText}
        title="Documents"
        subtitle="Problem statements, SRS documents and reports awaiting your review."
        crumbs={[{ label: "Documents" }]}
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "pending", label: "Awaiting review", icon: Clock, badge: pendingCount },
          { key: "reviewed", label: "Reviewed", icon: CheckCircle2 },
        ]}
      />

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search project or document…" />
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} height={130} />
          ))}
        </div>
      ) : !visible.length ? (
        <div className="glass-card">
          <EmptyState
            icon={tab === "pending" ? CheckCircle2 : FileText}
            title={tab === "pending" ? "Nothing awaiting review" : "No reviewed documents"}
            message={
              tab === "pending"
                ? "Documents uploaded by your students will appear here for review."
                : "Documents you've reviewed will be listed here."
            }
          />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visible.map(({ project, doc, latest, versionCount }) => (
            <div key={latest.id} className="glass-card" style={{ padding: 20 }}>
              <div className="flex items-start justify-between gap-3" style={{ flexWrap: "wrap" }}>
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
                    <div className="flex items-center gap-2 mb-1" style={{ flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: "0.9375rem", fontWeight: 700 }}>
                        {DOCUMENT_TYPES[doc.type] || doc.type}
                      </h3>
                      <span
                        style={{
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          color: "var(--purple-400)",
                          background: "rgba(124,58,237,0.12)",
                          padding: "2px 7px",
                          borderRadius: 99,
                        }}
                      >
                        v{latest.version}
                        {versionCount > 1 && ` of ${versionCount}`}
                      </span>
                      <StatusBadge status={latest.status} size="sm" />
                    </div>

                    <div style={{ fontSize: "0.78rem", color: "var(--slate-400)" }}>
                      {project.title}
                      {project.subject?.name && ` · ${project.subject.name}`}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--slate-500)", marginTop: 2 }}>
                      {latest.fileName} · {formatBytes(latest.fileSize)} · uploaded{" "}
                      {timeAgo(latest.uploadedAt)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
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
                  {latest.status === "PENDING" && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setReviewing({ project, doc, latest })}
                    >
                      <CheckCircle2 size={13} />
                      Review
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`${basePath}/${project.id}`)}
                  >
                    <Eye size={13} />
                  </button>
                </div>
              </div>

              {latest.comments && (
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
                  <div style={{ fontSize: "0.7rem", color: "var(--slate-500)", marginBottom: 2 }}>
                    Your feedback · {formatDateTime(latest.reviewedAt)}
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--slate-300)", lineHeight: 1.6 }}>
                    {latest.comments}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {reviewing && (
        <ReviewModal
          item={reviewing}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null);
            load();
          }}
        />
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function ReviewModal({ item, onClose, onDone }) {
  const [status, setStatus] = useState("APPROVED");
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);

  const required = status !== "APPROVED";
  const tooShort = required && comments.trim().length < 10;

  const submit = async (e) => {
    e.preventDefault();
    if (tooShort) {
      toast.error("Please explain your decision in at least 10 characters.");
      return;
    }
    setSaving(true);
    try {
      await documentApi.reviewVersion(item.latest.id, {
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
      title={`Review ${DOCUMENT_TYPES[item.doc.type] || item.doc.type} v${item.latest.version}`}
      subtitle={`${item.project.title} · ${item.latest.fileName}`}
      width={540}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="doc-queue-form" className="btn btn-primary" disabled={saving}>
            {saving ? "Submitting…" : "Submit Review"}
          </button>
        </>
      }
    >
      <a
        className="btn btn-secondary btn-sm"
        href={item.latest.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        download
        style={{ marginBottom: 18 }}
      >
        <Download size={13} />
        Download and read the document
      </a>

      <form id="doc-queue-form" onSubmit={submit}>
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
            {required ? (
              <span style={{ color: "var(--red-400)" }}>(required)</span>
            ) : (
              <span style={{ color: "var(--slate-500)", fontWeight: 400 }}>(optional)</span>
            )}
          </label>
          <textarea
            className="form-input"
            rows={4}
            placeholder="What's strong, and what has to change in the next version?"
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
