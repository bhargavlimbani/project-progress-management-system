import { Inbox } from "lucide-react";

/**
 * Friendly empty state (spec §71). Every list in the app uses this rather
 * than rendering a blank area, so "nothing here" always reads as intentional.
 */
export default function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  message,
  action,
  compact = false,
}) {
  return (
    <div className="empty-state" style={compact ? { padding: "32px 16px" } : undefined}>
      <div className="empty-state-icon" style={compact ? { width: 48, height: 48 } : undefined}>
        <Icon size={compact ? 22 : 28} color="var(--slate-500)" />
      </div>
      <div style={{ fontSize: compact ? "0.9rem" : "1rem", fontWeight: 700, color: "var(--slate-300)" }}>
        {title}
      </div>
      {message && (
        <div style={{ fontSize: "0.8125rem", color: "var(--slate-500)", maxWidth: 380 }}>
          {message}
        </div>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
