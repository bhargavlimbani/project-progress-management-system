import { STATUS_TONE_HEX } from "../../utils/constants.js";

/**
 * SVG ring gauge used for overall progress figures. An optional `expected`
 * value is drawn as a faint tick on the track so the gap stays visible even
 * in the compact form.
 */
export default function CircularProgress({
  value = 0,
  expected,
  size = 120,
  strokeWidth = 10,
  tone,
  label,
  sublabel,
}) {
  const clamped = Math.min(100, Math.max(0, Number(value) || 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (clamped / 100) * circumference;

  let resolvedTone = tone;
  if (!resolvedTone) {
    if (clamped >= 100) resolvedTone = "green";
    else if (expected !== undefined && expected - clamped >= 30) resolvedTone = "red";
    else if (expected !== undefined && expected - clamped >= 15) resolvedTone = "orange";
  }

  const gradientId = `ring-${resolvedTone || "default"}`;
  const solid = resolvedTone ? STATUS_TONE_HEX[resolvedTone] : null;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={solid || "#7c3aed"} />
            <stop offset="100%" stopColor={solid || "#3b82f6"} />
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{
            transition: "stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1)",
            filter: "drop-shadow(0 0 6px rgba(124,58,237,0.5))",
          }}
        />

        {expected !== undefined && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={strokeWidth}
            strokeDasharray={`2 ${circumference}`}
            strokeDashoffset={-((Math.min(100, expected) / 100) * circumference)}
          />
        )}
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
        }}
      >
        <span
          style={{
            fontSize: size > 100 ? "1.6rem" : "1.1rem",
            fontWeight: 800,
            color: "var(--white)",
            lineHeight: 1,
          }}
        >
          {clamped.toFixed(0)}
          <span style={{ fontSize: "0.7em", opacity: 0.7 }}>%</span>
        </span>
        {label && (
          <span style={{ fontSize: "0.65rem", color: "var(--slate-400)", fontWeight: 600 }}>
            {label}
          </span>
        )}
        {sublabel && (
          <span style={{ fontSize: "0.6rem", color: "var(--slate-500)" }}>{sublabel}</span>
        )}
      </div>
    </div>
  );
}
