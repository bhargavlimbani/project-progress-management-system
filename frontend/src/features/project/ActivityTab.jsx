import { History, User } from "lucide-react";
import { activityApi } from "../../services/index.js";
import { useApi } from "../../hooks/useApi.js";
import { timeAgo, formatDateTime, humanize, initials } from "../../utils/format.js";
import { EmptyState, SkeletonTable } from "../../components/ui/index.js";

/** Colour hint per action family, so the feed is scannable. */
function toneFor(action = "") {
  if (/APPROV|VERIF|COMPLETE/i.test(action)) return "var(--green-500)";
  if (/REJECT|DELETE/i.test(action)) return "var(--red-500)";
  if (/CHANGES|RISK|DELAY/i.test(action)) return "var(--orange-500)";
  if (/CREATE|SUBMIT|UPLOAD/i.test(action)) return "var(--purple-500)";
  return "var(--slate-500)";
}

/** Audit trail for this project (spec §53). */
export default function ActivityTab({ project }) {
  const { data: logs, loading } = useApi(() => activityApi.forProject(project.id), [project.id], {
    initialData: [],
  });

  if (loading) return <SkeletonTable rows={6} cols={2} />;

  if (!logs?.length) {
    return (
      <div className="glass-card">
        <EmptyState
          icon={History}
          title="No activity recorded yet"
          message="Submissions, approvals, uploads and mark changes are logged here as they happen."
        />
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ position: "relative" }}>
        {logs.map((log, index) => {
          const tone = toneFor(log.action);
          const isLast = index === logs.length - 1;

          return (
            <div key={log.id} style={{ display: "flex", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: tone,
                    boxShadow: `0 0 0 3px ${tone}22`,
                    flexShrink: 0,
                    marginTop: 5,
                  }}
                />
                {!isLast && (
                  <div
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 26,
                      background: "rgba(255,255,255,0.07)",
                    }}
                  />
                )}
              </div>

              <div style={{ flex: 1, paddingBottom: isLast ? 0 : 18, minWidth: 0 }}>
                <div
                  className="flex items-center gap-2"
                  style={{ flexWrap: "wrap", marginBottom: 2 }}
                >
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--white)" }}>
                    {humanize(log.action)}
                  </span>
                  {log.entityType && (
                    <span
                      style={{
                        fontSize: "0.62rem",
                        fontWeight: 700,
                        color: "var(--slate-500)",
                        background: "rgba(255,255,255,0.05)",
                        padding: "2px 7px",
                        borderRadius: 99,
                      }}
                    >
                      {log.entityType}
                    </span>
                  )}
                </div>

                <div
                  className="flex items-center gap-2"
                  style={{ fontSize: "0.75rem", color: "var(--slate-500)" }}
                >
                  {log.actor && (
                    <>
                      <span
                        className="avatar-placeholder"
                        style={{ width: 18, height: 18, fontSize: "0.55rem" }}
                      >
                        {initials(log.actor.name)}
                      </span>
                      <span>{log.actor.name}</span>
                      <span style={{ opacity: 0.6 }}>·</span>
                      <span>{log.actor.role}</span>
                      <span style={{ opacity: 0.6 }}>·</span>
                    </>
                  )}
                  <span title={formatDateTime(log.createdAt)}>{timeAgo(log.createdAt)}</span>
                </div>

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: "0.72rem",
                      color: "var(--slate-400)",
                      background: "rgba(255,255,255,0.03)",
                      padding: "6px 10px",
                      borderRadius: 8,
                      display: "inline-block",
                    }}
                  >
                    {Object.entries(log.metadata)
                      .map(([k, v]) => `${humanize(k)}: ${v}`)
                      .join("  ·  ")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
