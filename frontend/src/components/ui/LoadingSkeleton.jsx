/**
 * Shimmer placeholders. Preferred over a spinner for content areas because
 * the layout doesn't jump when the real data lands.
 */
export function Skeleton({ width = "100%", height = 16, radius = 8, style }) {
  return <div className="skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonText({ lines = 3, lastWidth = "60%" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? lastWidth : "100%"} />
      ))}
    </div>
  );
}

export function SkeletonCard({ height = 130 }) {
  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton width={44} height={44} radius={12} />
        <Skeleton width={40} height={12} />
      </div>
      <Skeleton width="55%" height={28} style={{ marginBottom: 10 }} />
      <Skeleton width="75%" height={12} />
      <div style={{ height: Math.max(0, height - 130) }} />
    </div>
  );
}

export function SkeletonKpiGrid({ count = 6 }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }) {
  return (
    <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 16,
          padding: "14px 16px",
          background: "rgba(255,255,255,0.02)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={10} width="70%" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 16,
            padding: "16px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={12} width={c === 0 ? "85%" : "60%"} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ height = 260 }) {
  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <Skeleton width="35%" height={14} style={{ marginBottom: 20 }} />
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height }}>
        {[60, 85, 45, 95, 70, 55, 80].map((h, i) => (
          <Skeleton key={i} height={`${h}%`} radius={6} />
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
