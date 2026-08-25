import { Calendar, Paperclip, Scale, Pencil, Trash2 } from "lucide-react";
import StatusBadge from "../ui/StatusBadge.jsx";
import { formatDate, deadlineLabel, daysUntil } from "../../utils/format.js";

/** A single milestone as a card — used on the admin/faculty milestone board. */
export default function MilestoneCard({ milestone, onEdit, onDelete, onClick, currentWeek }) {
  const overdue =
    milestone.status !== "APPROVED" &&
    milestone.endDate &&
    daysUntil(milestone.endDate) < 0;

  const isCurrent = milestone.weekNumber === currentWeek;

  return (
    <div
      className="glass-card glass-card-hover"
      onClick={onClick}
      style={{
        padding: 18,
        cursor: onClick ? "pointer" : "default",
        borderColor: isCurrent ? "rgba(124,58,237,0.35)" : undefined,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isCurrent && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: "var(--gradient-glow)",
          }}
        />
      )}

      <div className="flex items-start justify-between gap-3 mb-2">
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: isCurrent ? "var(--purple-400)" : "var(--slate-500)",
              marginBottom: 3,
            }}
          >
            Week {milestone.weekNumber}
          </div>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 700 }} className="truncate">
            {milestone.title}
          </h3>
        </div>

        <StatusBadge
          status={milestone.status}
          size="sm"
          {...(overdue ? { tone: "red", label: "Overdue" } : {})}
        />
      </div>

      {milestone.description && (
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--slate-400)",
            lineHeight: 1.55,
            marginBottom: 12,
          }}
        >
          {milestone.description}
        </p>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          fontSize: "0.7rem",
          color: "var(--slate-500)",
        }}
      >
        {milestone.weight > 0 && (
          <span className="flex items-center gap-1">
            <Scale size={12} />
            {milestone.weight}% weight
          </span>
        )}
        {milestone.endDate && (
          <span
            className="flex items-center gap-1"
            style={{ color: overdue ? "var(--red-400)" : undefined }}
          >
            <Calendar size={12} />
            {milestone.status === "APPROVED"
              ? formatDate(milestone.completedAt || milestone.endDate)
              : deadlineLabel(milestone.endDate)}
          </span>
        )}
        {milestone.requiredEvidence && (
          <span className="flex items-center gap-1" title={milestone.requiredEvidence}>
            <Paperclip size={12} />
            Evidence required
          </span>
        )}
      </div>

      {(onEdit || onDelete) && (
        <div
          className="flex gap-2"
          style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          {onEdit && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(milestone);
              }}
            >
              <Pencil size={13} />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(milestone);
              }}
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
