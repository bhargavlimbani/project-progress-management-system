import { CheckCircle2, Circle, Clock, AlertTriangle, Lock } from "lucide-react";
import { formatDate, deadlineLabel } from "../../utils/format.js";

/**
 * Vertical milestone timeline for a project. Each node shows the week, its
 * weight toward overall progress, and its review state — so a student can see
 * at a glance which week they are actually on versus where they should be.
 */
export default function Timeline({ milestones = [], currentWeek = 0, onSelect, compact = false }) {
  if (!milestones.length) return null;

  const ordered = [...milestones].sort((a, b) => a.weekNumber - b.weekNumber);

  const nodeFor = (milestone) => {
    const overdue =
      milestone.status !== "APPROVED" &&
      milestone.endDate &&
      new Date(milestone.endDate) < new Date();

    if (milestone.status === "APPROVED") {
      return { Icon: CheckCircle2, color: "var(--green-500)", ring: "rgba(34,197,94,0.2)" };
    }
    if (milestone.status === "CHANGES_REQUIRED" || overdue) {
      return { Icon: AlertTriangle, color: "var(--orange-500)", ring: "rgba(249,115,22,0.2)" };
    }
    if (milestone.status === "REJECTED") {
      return { Icon: AlertTriangle, color: "var(--red-500)", ring: "rgba(239,68,68,0.2)" };
    }
    if (milestone.weekNumber === currentWeek) {
      return { Icon: Clock, color: "var(--purple-500)", ring: "rgba(124,58,237,0.25)" };
    }
    if (milestone.weekNumber > currentWeek) {
      return { Icon: Lock, color: "var(--slate-600)", ring: "rgba(148,163,184,0.1)" };
    }
    return { Icon: Circle, color: "var(--slate-500)", ring: "rgba(148,163,184,0.12)" };
  };

  return (
    <div style={{ position: "relative", paddingLeft: 4 }}>
      {ordered.map((milestone, index) => {
        const { Icon, color, ring } = nodeFor(milestone);
        const isCurrent = milestone.weekNumber === currentWeek;
        const isLast = index === ordered.length - 1;

        return (
          <div key={milestone.id || milestone.weekNumber} style={{ display: "flex", gap: 14 }}>
            {/* Rail */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "var(--navy-900)",
                  border: `2px solid ${color}`,
                  boxShadow: isCurrent ? `0 0 0 5px ${ring}` : `0 0 0 3px ${ring}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  zIndex: 1,
                  transition: "box-shadow 250ms",
                }}
              >
                <Icon size={15} color={color} />
              </div>
              {!isLast && (
                <div
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: compact ? 22 : 34,
                    background:
                      milestone.status === "APPROVED"
                        ? "linear-gradient(180deg, var(--green-500), rgba(255,255,255,0.08))"
                        : "rgba(255,255,255,0.08)",
                  }}
                />
              )}
            </div>

            {/* Body */}
            <div
              onClick={onSelect ? () => onSelect(milestone) : undefined}
              style={{
                flex: 1,
                paddingBottom: isLast ? 0 : compact ? 16 : 22,
                cursor: onSelect ? "pointer" : "default",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: isCurrent ? "var(--purple-400)" : "var(--slate-500)",
                  }}
                >
                  Week {milestone.weekNumber}
                </span>
                {milestone.weight > 0 && (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      color: "var(--slate-400)",
                      background: "rgba(255,255,255,0.05)",
                      padding: "1px 7px",
                      borderRadius: 99,
                    }}
                  >
                    {milestone.weight}%
                  </span>
                )}
                {isCurrent && (
                  <span className="badge badge-purple" style={{ fontSize: "0.6rem", padding: "2px 7px" }}>
                    Current
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: compact ? "0.8125rem" : "0.9375rem",
                  fontWeight: 700,
                  color: milestone.weekNumber > currentWeek ? "var(--slate-400)" : "var(--white)",
                  marginBottom: 2,
                }}
              >
                {milestone.title}
              </div>

              {!compact && milestone.description && (
                <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)", lineHeight: 1.55 }}>
                  {milestone.description}
                </p>
              )}

              {milestone.endDate && (
                <div style={{ fontSize: "0.7rem", color: "var(--slate-500)", marginTop: 5 }}>
                  {milestone.status === "APPROVED"
                    ? `Completed ${formatDate(milestone.completedAt || milestone.endDate)}`
                    : `${formatDate(milestone.startDate)} → ${formatDate(milestone.endDate)} · ${deadlineLabel(
                        milestone.endDate
                      )}`}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
