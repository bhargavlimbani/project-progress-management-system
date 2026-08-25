import { useState, useEffect } from "react";
import {
  Users, BookOpen, UserCheck, FolderKanban, Layers, Building,
  TrendingUp, AlertTriangle, Clock, CheckCircle, XCircle, Zap,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { analyticsApi } from "../../services/index.js";

function KpiCard({ label, value, icon: Icon, color = "purple", sub }) {
  const colors = {
    purple: { bg: "rgba(124,58,237,0.1)", border: "rgba(124,58,237,0.2)", icon: "#a78bfa" },
    blue: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)", icon: "#60a5fa" },
    green: { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.2)", icon: "#4ade80" },
    orange: { bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)", icon: "#fb923c" },
    red: { bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)", icon: "#f87171" },
    yellow: { bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.2)", icon: "#facc15" },
  };
  const c = colors[color] || colors.purple;

  return (
    <div className="glass-card glass-card-hover kpi-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="kpi-icon" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
          <Icon size={20} color={c.icon} />
        </div>
      </div>
      <div>
        <div className="kpi-value">{value ?? "—"}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div style={{ fontSize: "0.7rem", color: "var(--slate-500)", marginTop: "2px" }}>{sub}</div>}
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  IN_PROGRESS: "#3b82f6",
  COMPLETED: "#22c55e",
  AT_RISK: "#f97316",
  DELAYED: "#ef4444",
  DRAFT: "#64748b",
  IDEA_SUBMITTED: "#a78bfa",
  APPROVED: "#22c55e",
  MENTOR_ASSIGNED: "#60a5fa",
};

const DOMAIN_COLORS = ["#7c3aed", "#3b82f6", "#22c55e", "#f97316", "#ef4444", "#eab308"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--navy-800)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "10px",
      padding: "10px 14px",
      fontSize: "0.8125rem",
    }}>
      {label && <div style={{ color: "var(--slate-400)", marginBottom: "4px" }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "white", fontWeight: 600 }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [statusData, setStatusData] = useState([]);
  const [domainData, setDomainData] = useState([]);
  const [mentorData, setMentorData] = useState([]);
  const [subjectData, setSubjectData] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [atRisk, setAtRisk] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.adminStats(),
      analyticsApi.projectStatus(),
      analyticsApi.domainDist(),
      analyticsApi.mentorWorkload(),
      analyticsApi.subjectStats(),
      analyticsApi.weeklySubmissions(),
      analyticsApi.atRisk(),
      analyticsApi.recentActivity(),
    ]).then(([s, ps, dd, mw, ss, ws, ar, ra]) => {
      setStats(s.data);
      setStatusData(ps.data.map((d) => ({ name: d.status.replace(/_/g, " "), value: d.count, color: STATUS_COLORS[d.status] || "#64748b" })));
      setDomainData(dd.data);
      setMentorData(mw.data);
      setSubjectData(ss.data);
      setWeeklyData(ws.data.map((d) => ({ name: `W${d.week}`, submissions: d.submissions })));
      setAtRisk(ar.data);
      setActivity(ra.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div className="kpi-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="glass-card" style={{ height: "100px" }}>
              <div className="skeleton" style={{ height: "100%" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "Total Students", value: stats?.totalStudents, icon: GraduationCap, color: "blue" },
    { label: "Total Faculty", value: stats?.totalFaculty, icon: Users, color: "purple" },
    { label: "Total Mentors", value: stats?.totalMentors, icon: UserCheck, color: "green" },
    { label: "Total Subjects", value: stats?.totalSubjects, icon: BookOpen, color: "blue" },
    { label: "Total Domains", value: stats?.totalDomains, icon: Building, color: "orange" },
    { label: "Active Projects", value: stats?.activeProjects, icon: FolderKanban, color: "purple" },
    { label: "Completed", value: stats?.completedProjects, icon: CheckCircle, color: "green" },
    { label: "At Risk", value: stats?.atRiskProjects, icon: AlertTriangle, color: "orange" },
    { label: "Delayed", value: stats?.delayedProjects, icon: XCircle, color: "red" },
    { label: "Pending Approvals", value: stats?.pendingApprovals, icon: Clock, color: "yellow" },
    { label: "Total Projects", value: stats?.totalProjects, icon: Layers, color: "blue" },
    { label: "Presentations", value: stats?.presentationScheduled, icon: TrendingUp, color: "purple" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800 }}>Admin Dashboard</h1>
        <p style={{ color: "var(--slate-400)", marginTop: "4px" }}>
          ICT Department — Academic Project Management Overview
        </p>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <KpiCard key={i} {...k} />
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="chart-grid">
        {/* Project Status Distribution */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "20px", fontSize: "1rem" }}>Project Status Distribution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
              >
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(v) => <span style={{ color: "var(--slate-300)", fontSize: "0.75rem" }}>{v}</span>}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Weekly Submissions */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "20px", fontSize: "1rem" }}>Weekly Submissions</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: "var(--slate-500)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--slate-500)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="submissions" stroke="#7c3aed" strokeWidth={2} fill="url(#subGrad)" name="Submissions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="chart-grid">
        {/* Domain Distribution */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "20px", fontSize: "1rem" }}>Domain Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={domainData} layout="vertical">
              <XAxis type="number" tick={{ fill: "var(--slate-500)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="domain" width={100} tick={{ fill: "var(--slate-300)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Projects" radius={[0, 6, 6, 0]}>
                {domainData.map((_, i) => (
                  <Cell key={i} fill={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Mentor Workload */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "20px", fontSize: "1rem" }}>Mentor Workload</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mentorData}>
              <XAxis dataKey="name" tick={{ fill: "var(--slate-500)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--slate-500)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="activeProjects" name="Active" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              <Bar dataKey="totalProjects" name="Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Legend formatter={(v) => <span style={{ color: "var(--slate-300)", fontSize: "0.75rem" }}>{v}</span>} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* At-Risk Projects */}
      {atRisk.length > 0 && (
        <div className="glass-card" style={{ padding: "24px" }}>
          <div className="section-header">
            <h3 className="section-title">⚠️ At-Risk & Delayed Projects</h3>
            <span className="badge badge-orange">{atRisk.length} projects</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Student</th>
                  <th>Subject</th>
                  <th>Faculty</th>
                  <th>Mentor</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.slice(0, 8).map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.title}</td>
                    <td>{p.members?.[0]?.student?.name || "—"}</td>
                    <td>{p.subject?.name || "—"}</td>
                    <td>{p.faculty?.user?.name || "—"}</td>
                    <td>{p.mentor?.user?.name || "—"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div className="progress-bar-track" style={{ width: "80px" }}>
                          <div
                            className={`progress-bar-fill ${p.status === "DELAYED" ? "delayed" : "at-risk"}`}
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${p.status === "DELAYED" ? "badge-red" : "badge-orange"}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {activity.length > 0 && (
        <div className="glass-card" style={{ padding: "24px" }}>
          <h3 className="section-title" style={{ marginBottom: "16px" }}>Recent Activity</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {activity.slice(0, 8).map((log) => (
              <div key={log.id} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "10px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                <div className="avatar-placeholder" style={{ width: "32px", height: "32px", fontSize: "0.7rem" }}>
                  {log.user?.name?.charAt(0) || "S"}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{log.user?.name || "System"}</span>
                  <span style={{ color: "var(--slate-400)", fontSize: "0.875rem" }}> {log.action.replace(/_/g, " ").toLowerCase()}</span>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--slate-500)" }}>
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Fix missing import
function GraduationCap(props) {
  return <UserCheck {...props} />;
}
