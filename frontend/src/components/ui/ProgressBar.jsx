/**
 * Linear progress bar. When `expected` is supplied it also draws the
 * expected-progress marker, which is the whole point of SAPMS — seeing the
 * gap between where a project is and where it should be (spec §41).
 */
export default function ProgressBar({
  value = 0,
  expected,
  variant,
  height = 8,
  showLabel = false,
  label,
}) {
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  const expectedClamped =
    expected === undefined ? null : Math.min(100, Math.max(0, Number(expected) || 0));

  // Derive the fill colour from the gap unless the caller forces a variant.
  let resolved = variant;
  if (!resolved && expectedClamped !== null) {
    const gap = expectedClamped - clamped;
    if (clamped >= 100) resolved = "completed";
    else if (gap >= 30) resolved = "delayed";
    else if (gap >= 15) resolved = "at-risk";
  }

  return (
    <div style={{ width: "100%" }}>
      {showLabel && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 6,
            fontSize: "0.75rem",
          }}
        >
          <span style={{ color: "var(--slate-400)", fontWeight: 500 }}>{label || "Progress"}</span>
          <span style={{ color: "var(--white)", fontWeight: 700 }}>{clamped.toFixed(0)}%</span>
        </div>
      )}

      <div className="progress-bar-track" style={{ height, position: "relative" }}>
        <div
          className={`progress-bar-fill ${resolved || ""}`}
          style={{ width: `${clamped}%` }}
        />

        {expectedClamped !== null && (
          <div
            title={`Expected ${expectedClamped.toFixed(0)}%`}
            style={{
              position: "absolute",
              left: `${expectedClamped}%`,
              top: -2,
              bottom: -2,
              width: 2,
              background: "rgba(255,255,255,0.65)",
              borderRadius: 2,
              boxShadow: "0 0 6px rgba(255,255,255,0.5)",
            }}
          />
        )}
      </div>
    </div>
  );
}
