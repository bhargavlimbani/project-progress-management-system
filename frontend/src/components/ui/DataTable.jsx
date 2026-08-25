import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import EmptyState from "./EmptyState.jsx";
import Pagination from "./Pagination.jsx";
import { SkeletonTable } from "./LoadingSkeleton.jsx";

/**
 * Table with sorting, client-side search and pagination that collapses into
 * cards on narrow screens (spec §69).
 *
 * Columns: { key, label, render?, sortable?, width?, align?, hideOnMobile? }
 *
 * Pass `serverPagination` to let the parent own paging (for endpoints that
 * page in the API); otherwise rows are paged locally.
 */
export default function DataTable({
  columns = [],
  rows = [],
  loading = false,
  rowKey = (row, i) => row.id ?? i,
  onRowClick,
  emptyTitle = "No records found",
  emptyMessage,
  emptyIcon,
  emptyAction,
  searchTerm = "",
  searchKeys,
  pageSize = 20,
  serverPagination,
  initialSort,
  footer,
}) {
  const [sort, setSort] = useState(initialSort || { key: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(pageSize);

  // ── Filter ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term || serverPagination) return rows;

    const keys = searchKeys || columns.map((c) => c.key);
    return rows.filter((row) =>
      keys.some((k) => {
        const value = k.split(".").reduce((acc, part) => acc?.[part], row);
        return value !== null && value !== undefined && String(value).toLowerCase().includes(term);
      })
    );
  }, [rows, searchTerm, searchKeys, columns, serverPagination]);

  // ── Sort ────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const column = columns.find((c) => c.key === sort.key);
    const accessor = column?.sortValue || ((row) => sort.key.split(".").reduce((a, p) => a?.[p], row));

    return [...filtered].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;

      const result =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });

      return sort.dir === "asc" ? result : -result;
    });
  }, [filtered, sort, columns]);

  // ── Page ────────────────────────────────────────────────────────────────
  const paged = useMemo(() => {
    if (serverPagination) return sorted;
    const start = (page - 1) * limit;
    return sorted.slice(start, start + limit);
  }, [sorted, page, limit, serverPagination]);

  const totalPages = serverPagination
    ? serverPagination.totalPages
    : Math.max(1, Math.ceil(sorted.length / limit));

  const toggleSort = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    setPage(1);
  };

  if (loading) return <SkeletonTable rows={6} cols={Math.min(columns.length || 5, 6)} />;

  if (!paged.length) {
    return (
      <div className="glass-card">
        <EmptyState
          title={emptyTitle}
          message={emptyMessage}
          icon={emptyIcon}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ overflow: "hidden" }}>
      {/* Desktop table */}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: col.width,
                    textAlign: col.align || "left",
                    cursor: col.sortable === false ? "default" : "pointer",
                    userSelect: "none",
                  }}
                  className={col.hideOnMobile ? "hide-mobile" : undefined}
                  onClick={col.sortable === false ? undefined : () => toggleSort(col.key)}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      justifyContent: col.align === "right" ? "flex-end" : "flex-start",
                    }}
                  >
                    {col.label}
                    {col.sortable !== false &&
                      (sort.key === col.key ? (
                        sort.dir === "asc" ? (
                          <ArrowUp size={11} color="var(--purple-400)" />
                        ) : (
                          <ArrowDown size={11} color="var(--purple-400)" />
                        )
                      ) : (
                        <ChevronsUpDown size={11} style={{ opacity: 0.35 }} />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: "pointer" } : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{ textAlign: col.align || "left" }}
                    className={col.hideOnMobile ? "hide-mobile" : undefined}
                  >
                    {col.render
                      ? col.render(row, i)
                      : col.key.split(".").reduce((a, p) => a?.[p], row) ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — same data, stacked (spec §69) */}
      <div className="table-cards">
        {paged.map((row, i) => (
          <div
            key={rowKey(row, i)}
            className="table-card"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={onRowClick ? { cursor: "pointer" } : undefined}
          >
            {columns.map((col) => {
              const content = col.render
                ? col.render(row, i)
                : col.key.split(".").reduce((a, p) => a?.[p], row) ?? "—";
              return (
                <div key={col.key} className="table-card-row">
                  <span className="table-card-label">{col.label}</span>
                  <span className="table-card-value">{content}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {footer}

      <Pagination
        page={serverPagination ? serverPagination.page : page}
        totalPages={totalPages}
        total={serverPagination ? serverPagination.total : sorted.length}
        limit={serverPagination ? serverPagination.limit : limit}
        onPageChange={serverPagination ? serverPagination.onPageChange : setPage}
        onLimitChange={
          serverPagination
            ? serverPagination.onLimitChange
            : (n) => {
                setLimit(n);
                setPage(1);
              }
        }
      />
    </div>
  );
}
