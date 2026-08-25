import { ChevronLeft, ChevronRight } from "lucide-react";

/** Build a compact page list with ellipses: 1 … 4 5 6 … 20 */
function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < total - 1) pages.push("…");
  pages.push(total);

  return pages;
}

export default function Pagination({
  page = 1,
  totalPages = 1,
  total = 0,
  limit = 20,
  onPageChange,
  onLimitChange,
}) {
  if (totalPages <= 1 && total <= limit) return null;

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const btnStyle = (active) => ({
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    fontSize: "0.8125rem",
    fontWeight: 600,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: active ? "var(--gradient-glow)" : "rgba(255,255,255,0.05)",
    color: active ? "#fff" : "var(--slate-300)",
    border: `1px solid ${active ? "transparent" : "rgba(255,255,255,0.08)"}`,
    transition: "all 150ms",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "14px 16px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: "0.8125rem", color: "var(--slate-400)" }}>
        Showing <strong style={{ color: "var(--white)" }}>{from}–{to}</strong> of{" "}
        <strong style={{ color: "var(--white)" }}>{total}</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {onLimitChange && (
          <select
            className="form-input"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            style={{ width: "auto", padding: "6px 10px", fontSize: "0.8125rem", marginRight: 8 }}
            aria-label="Rows per page"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={() => onPageChange?.(page - 1)}
          disabled={page <= 1}
          style={{ ...btnStyle(false), opacity: page <= 1 ? 0.4 : 1 }}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>

        {pageWindow(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} style={{ color: "var(--slate-500)", padding: "0 2px" }}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange?.(p)}
              style={btnStyle(p === page)}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange?.(page + 1)}
          disabled={page >= totalPages}
          style={{ ...btnStyle(false), opacity: page >= totalPages ? 0.4 : 1 }}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
