import { PROJECT_STATUS, REVIEW_STATUS } from "../../utils/constants.js";
import { humanize } from "../../utils/format.js";

/**
 * Renders any backend enum as a coloured pill. Looks the value up in the
 * project-status map first, then the review-status map, and falls back to a
 * humanised label so an unrecognised value still renders sensibly.
 */
export default function StatusBadge({ status, tone, label, size = "md", icon: Icon }) {
  const known = PROJECT_STATUS[status] || REVIEW_STATUS[status];
  const resolvedTone = tone || known?.tone || "gray";
  const resolvedLabel = label || known?.label || humanize(status);

  return (
    <span
      className={`badge badge-${resolvedTone}`}
      style={size === "sm" ? { fontSize: "0.625rem", padding: "3px 8px" } : undefined}
      title={resolvedLabel}
    >
      {Icon && <Icon size={size === "sm" ? 10 : 12} />}
      {resolvedLabel}
    </span>
  );
}
