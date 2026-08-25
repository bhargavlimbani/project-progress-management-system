import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { STATUS_TONE_HEX } from "../../utils/constants.js";

/**
 * KPI tile for the dashboards. `tone` colours the icon chip and accent glow;
 * `trend` renders an optional delta line beneath the value.
 */
export default function DashboardCard({
  label,
  value,
  icon: Icon,
  tone = "purple",
  trend,
  trendLabel,
  onClick,
  index = 0,
}) {
  const accent = STATUS_TONE_HEX[tone] || STATUS_TONE_HEX.purple;
  const isPositive = trend >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
      onClick={onClick}
      className={`glass-card kpi-card ${onClick ? "glass-card-hover" : ""}`}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      {/* Corner glow tinted to the card's tone */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -30,
          right: -30,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: accent,
          opacity: 0.12,
          filter: "blur(24px)",
          pointerEvents: "none",
        }}
      />

      <div className="flex items-center justify-between">
        <div
          className="kpi-icon"
          style={{ background: `${accent}22`, border: `1px solid ${accent}33` }}
        >
          {Icon && <Icon size={20} color={accent} />}
        </div>

        {trend !== undefined && trend !== null && (
          <div
            className="flex items-center gap-1"
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              color: isPositive ? "var(--green-400)" : "var(--red-400)",
            }}
          >
            {isPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <div>
        <div className="kpi-value" style={{ backgroundImage: `linear-gradient(135deg, ${accent}, #ffffff)` }}>
          {value ?? 0}
        </div>
        <div className="kpi-label" style={{ marginTop: 6 }}>
          {label}
        </div>
        {trendLabel && (
          <div style={{ fontSize: "0.7rem", color: "var(--slate-500)", marginTop: 4 }}>
            {trendLabel}
          </div>
        )}
      </div>
    </motion.div>
  );
}
