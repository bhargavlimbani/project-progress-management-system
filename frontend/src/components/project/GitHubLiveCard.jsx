import { useEffect, useState } from "react";
import {
  Github, GitBranch, GitCommit, Star, GitFork, AlertCircle, RefreshCw,
  ExternalLink, CheckCircle2,
} from "lucide-react";
import { progressApi } from "../../services/index.js";
import { timeAgo } from "../../utils/format.js";

export default function GitHubLiveCard({ projectId, defaultUrl }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await progressApi.getGitHubStats(projectId, defaultUrl ? { url: defaultUrl } : undefined);
      setData(res.data);
    } catch (err) {
      setError("Unable to connect to GitHub service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, defaultUrl]);

  if (loading && !data) {
    return (
      <div className="glass-card mb-4" style={{ padding: 18 }}>
        <div className="flex items-center gap-3">
          <div className="spinner" style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: "0.8rem", color: "var(--slate-400)" }}>
            Syncing live GitHub repository activity…
          </span>
        </div>
      </div>
    );
  }

  if (!data?.hasRepo) {
    return (
      <div
        className="glass-card mb-4"
        style={{
          padding: 16,
          background: "rgba(124, 58, 237, 0.04)",
          border: "1px dashed rgba(124, 58, 237, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--slate-300)",
            }}
          >
            <Github size={18} />
          </div>
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>GitHub Activity Sync</div>
            <div style={{ fontSize: "0.72rem", color: "var(--slate-400)" }}>
              Include a GitHub URL when submitting weekly progress to view live commits and repository stats here.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = data.stats;

  if (stats?.isPrivateOrNotFound || stats?.error) {
    return (
      <div className="glass-card mb-4" style={{ padding: 18 }}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Github size={18} color="var(--slate-300)" />
            <a
              href={data.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="hover-underline flex items-center gap-1"
              style={{ fontSize: "0.85rem", fontWeight: 700 }}
            >
              {data.repoUrl.replace("https://github.com/", "")}
              <ExternalLink size={12} />
            </a>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={fetchStats}
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} />
          </button>
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--yellow-400)", margin: 0 }}>
          {stats.error || "Repository is private or cannot be reached by public GitHub API."}
        </p>
      </div>
    );
  }

  return (
    <div
      className="glass-card mb-4"
      style={{
        padding: 20,
        background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.6) 100%)",
        border: "1px solid rgba(124, 58, 237, 0.2)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4" style={{ flexWrap: "wrap" }}>
        <div className="flex items-center gap-3">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--white)",
            }}
          >
            <Github size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <a
                href={stats.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="hover-underline flex items-center gap-1"
                style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--white)" }}
              >
                {stats.fullName || stats.name}
                <ExternalLink size={13} color="var(--slate-400)" />
              </a>
              {stats.language && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: "rgba(99, 102, 241, 0.15)",
                    border: "1px solid rgba(99, 102, 241, 0.3)",
                    color: "var(--purple-300)",
                  }}
                >
                  {stats.language}
                </span>
              )}
            </div>
            {stats.description && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--slate-400)",
                  marginTop: 2,
                  marginBottom: 0,
                  maxWidth: 600,
                }}
              >
                {stats.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4" style={{ fontSize: "0.75rem", color: "var(--slate-400)" }}>
            <span className="flex items-center gap-1" title="Default Branch">
              <GitBranch size={13} color="var(--purple-400)" />
              {stats.defaultBranch || "main"}
            </span>
            <span className="flex items-center gap-1" title="Stars">
              <Star size={13} color="var(--yellow-400)" />
              {stats.stars || 0}
            </span>
            <span className="flex items-center gap-1" title="Forks">
              <GitFork size={13} color="var(--blue-400)" />
              {stats.forks || 0}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchStats}
            disabled={loading}
            style={{ fontSize: "0.72rem", padding: "4px 9px" }}
          >
            <RefreshCw size={12} className={loading ? "spin" : ""} />
            Sync
          </button>
        </div>
      </div>

      {/* Recent Commits */}
      {stats.commits?.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: 14 }}>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--slate-400)",
              marginBottom: 10,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <GitCommit size={13} color="var(--green-400)" />
            Recent Live Commits ({stats.commits.length})
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {stats.commits.map((c, i) => (
              <div
                key={c.fullSha || i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "7px 10px",
                  borderRadius: 6,
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.04)",
                  fontSize: "0.78rem",
                }}
              >
                <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                  <a
                    href={c.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 700,
                      color: "var(--purple-400)",
                      background: "rgba(124, 58, 237, 0.12)",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: "0.72rem",
                      textDecoration: "none",
                    }}
                  >
                    {c.sha}
                  </a>
                  <span
                    className="truncate"
                    style={{ color: "var(--slate-200)", fontWeight: 500 }}
                    title={c.message}
                  >
                    {c.message}
                  </span>
                </div>

                <div
                  className="flex items-center gap-3"
                  style={{ fontSize: "0.7rem", color: "var(--slate-500)", flexShrink: 0 }}
                >
                  <span>{c.author}</span>
                  {c.date && <span>{timeAgo(c.date)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
