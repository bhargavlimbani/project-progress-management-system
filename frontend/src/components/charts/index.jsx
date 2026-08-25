import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  RadialBarChart, RadialBar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { CHART_COLORS } from "../../utils/constants.js";
import { EmptyState } from "../ui/index.js";
import { BarChart3 } from "lucide-react";

const AXIS = { stroke: "#64748b", fontSize: 11 };
const GRID = "rgba(255,255,255,0.05)";

/** Shared dark tooltip so every chart reads the same. */
export function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--navy-800)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10,
        padding: "10px 13px",
        fontSize: "0.8125rem",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {label !== undefined && label !== "" && (
        <div style={{ color: "var(--slate-400)", marginBottom: 5, fontWeight: 600 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 2 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: p.color || p.payload?.fill,
              flexShrink: 0,
            }}
          />
          <span style={{ color: "var(--slate-300)" }}>{p.name}</span>
          <span style={{ color: "var(--white)", fontWeight: 700, marginLeft: "auto" }}>
            {formatter ? formatter(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Card shell with a title, optional subtitle, and an empty state. */
export function ChartCard({ title, subtitle, children, height = 260, isEmpty, emptyMessage, action }) {
  return (
    <div className="glass-card chart-card">
      <div className="flex items-start justify-between" style={{ gap: 12 }}>
        <div>
          <h3 className="chart-card-title">{title}</h3>
          {subtitle && <p className="chart-card-subtitle">{subtitle}</p>}
        </div>
        {action}
      </div>

      {isEmpty ? (
        <EmptyState compact icon={BarChart3} title="No data yet" message={emptyMessage} />
      ) : (
        <div style={{ height, width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ── Ready-made chart bodies ──────────────────────────────────────────────── */

export function StatusDonut({ data = [], colorFor, nameKey = "name", valueKey = "value" }) {
  return (
    <PieChart>
      <Pie
        data={data}
        dataKey={valueKey}
        nameKey={nameKey}
        cx="50%"
        cy="50%"
        innerRadius={58}
        outerRadius={92}
        paddingAngle={3}
        stroke="none"
      >
        {data.map((entry, i) => (
          <Cell key={i} fill={colorFor ? colorFor(entry) : CHART_COLORS[i % CHART_COLORS.length]} />
        ))}
      </Pie>
      <Tooltip content={<ChartTooltip />} />
      <Legend
        verticalAlign="bottom"
        height={40}
        iconType="circle"
        iconSize={8}
        formatter={(value) => (
          <span style={{ color: "var(--slate-400)", fontSize: "0.72rem" }}>{value}</span>
        )}
      />
    </PieChart>
  );
}

export function HorizontalBars({ data = [], dataKey, nameKey = "name", color = "#7c3aed", unit }) {
  return (
    <BarChart data={data} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
      <CartesianGrid horizontal={false} stroke={GRID} />
      <XAxis type="number" {...AXIS} axisLine={false} tickLine={false} />
      <YAxis
        type="category"
        dataKey={nameKey}
        {...AXIS}
        width={130}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        content={<ChartTooltip formatter={(v) => (unit ? `${v}${unit}` : v)} />}
        cursor={{ fill: "rgba(255,255,255,0.03)" }}
      />
      <Bar dataKey={dataKey} radius={[0, 6, 6, 0]} barSize={16}>
        {data.map((_, i) => (
          <Cell key={i} fill={color} />
        ))}
      </Bar>
    </BarChart>
  );
}

export function GroupedBars({ data = [], series = [], nameKey = "name" }) {
  return (
    <BarChart data={data} margin={{ left: -12, right: 8, top: 4, bottom: 4 }}>
      <CartesianGrid vertical={false} stroke={GRID} />
      <XAxis dataKey={nameKey} {...AXIS} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={54} />
      <YAxis {...AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
      <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
      <Legend
        iconType="circle"
        iconSize={8}
        formatter={(value) => (
          <span style={{ color: "var(--slate-400)", fontSize: "0.72rem" }}>{value}</span>
        )}
      />
      {series.map((s, i) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.label}
          fill={s.color || CHART_COLORS[i % CHART_COLORS.length]}
          radius={[5, 5, 0, 0]}
          barSize={18}
        />
      ))}
    </BarChart>
  );
}

/**
 * Expected vs actual progress across the weeks — the chart that makes the
 * core SAPMS argument visible (spec §3).
 */
export function ProgressTrend({ data = [] }) {
  return (
    <AreaChart data={data} margin={{ left: -14, right: 10, top: 6, bottom: 4 }}>
      <defs>
        <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.45} />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="expectedFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>

      <CartesianGrid vertical={false} stroke={GRID} />
      <XAxis dataKey="week" {...AXIS} axisLine={false} tickLine={false} />
      <YAxis {...AXIS} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
      <Tooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
      <Legend
        iconType="circle"
        iconSize={8}
        formatter={(value) => (
          <span style={{ color: "var(--slate-400)", fontSize: "0.72rem" }}>{value}</span>
        )}
      />

      <Area
        type="monotone"
        dataKey="expected"
        name="Expected"
        stroke="#3b82f6"
        strokeWidth={2}
        strokeDasharray="5 4"
        fill="url(#expectedFill)"
      />
      <Area
        type="monotone"
        dataKey="actual"
        name="Actual"
        stroke="#7c3aed"
        strokeWidth={2.5}
        fill="url(#actualFill)"
      />
    </AreaChart>
  );
}

export function SubmissionLine({ data = [] }) {
  return (
    <LineChart data={data} margin={{ left: -14, right: 10, top: 6, bottom: 4 }}>
      <CartesianGrid vertical={false} stroke={GRID} />
      <XAxis dataKey="week" {...AXIS} axisLine={false} tickLine={false} />
      <YAxis {...AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
      <Tooltip content={<ChartTooltip />} />
      <Line
        type="monotone"
        dataKey="submissions"
        name="Submissions"
        stroke="#22c55e"
        strokeWidth={2.5}
        dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
        activeDot={{ r: 5 }}
      />
    </LineChart>
  );
}

export function CompletionGauge({ value = 0, label = "Completion" }) {
  const data = [{ name: label, value: Math.min(100, value), fill: "#7c3aed" }];
  return (
    <RadialBarChart
      data={data}
      innerRadius="66%"
      outerRadius="100%"
      startAngle={90}
      endAngle={-270}
    >
      <RadialBar background={{ fill: "rgba(255,255,255,0.06)" }} dataKey="value" cornerRadius={12} />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ fill: "#fff", fontSize: 26, fontWeight: 800 }}
      >
        {Math.round(value)}%
      </text>
    </RadialBarChart>
  );
}

export { CHART_COLORS };
