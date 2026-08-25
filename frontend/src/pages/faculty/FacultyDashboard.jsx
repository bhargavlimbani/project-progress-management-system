import { useState, useEffect } from "react";
import { analyticsApi, projectApi } from "../../services/index.js";
import { FolderKanban, AlertTriangle, CheckCircle, Clock, TrendingUp, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--navy-800)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px 14px", fontSize: "0.8125rem" }}>
      {label && <div style={{ color: "var(--slate-400)", marginBottom: "4px" }}>{label}</div>}
      {payload.map((p, i) => <div key={i} style={{ color: p.color || "white", fontWeight: 600 }}>{p.name}: {p.value}</div>)}
    </div>
  );
};

function KpiCard({ label, value, icon: Icon, color = "purple" }) {
  const colors = {
    purple: "#a78bfa", blue: "#60a5fa", green: "#4ade80",
    orange: "#fb923c", red: "#f87171", yellow: "#facc15",
  };
  return (
    <div className="glass-card glass-card-hover kpi-card">
      <div className="kpi-icon" style={{ background: `${colors[color]}15`, border: `1px solid ${colors[color]}30` }}>
        <Icon size={20} color={colors[color]} />
      </div>
      <div className="kpi-value">{value ?? 0}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

export default function FacultyDashboard() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.facultyStats(),
      projectApi.list({ limit: 10 }),
    ]).then(([s, p]) => {
      setStats(s.data);
      setProjects(p.data.projects || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const statusData = projects.reduce((acc, p) => {
    const key = p.status;
    const existing = acc.find((a) => a.name === key);
    if (existing) existing.count++;
    else acc.push({ name: key.replace(/_/g, " "), count: 1 });
    return acc;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800 }}>Faculty Dashboard</h1>
        <p style={{ color: "var(--slate-400)", marginTop: "4px" }}>Monitor and review your assigned projects</p>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Total Projects" value={stats?.totalProjects} icon={FolderKanban} color="blue" />
        <KpiCard label="Pending Approvals" value={stats?.pendingApprovals} icon={Clock} color="yellow" />
        <KpiCard label="At Risk" value={stats?.atRisk} icon={AlertTriangle} color="orange" />
        <KpiCard label="Delayed" value={stats?.delayed} icon={AlertTriangle} color="red" />
        <KpiCard label="Completed" value={stats?.completed} icon={CheckCircle} color="green" />
        <KpiCard label="Pending Reviews" value={stats?.pendingWeeklyReviews} icon={TrendingUp} color="purple" />
      </div>

      <div className="chart-grid">
        <div className="glass-card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "20px", fontSize: "1rem" }}>Project Status Overview</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData}>
              <XAxis dataKey="name" tick={{ fill: "var(--slate-500)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--slate-500)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Projects" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pending Approvals List */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "16px", fontSize: "1rem" }}>Pending Idea Reviews</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {projects.filter((p) => p.status === "IDEA_SUBMITTED").slice(0, 5).map((p) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div className="avatar-placeholder" style={{ width: "36px", height: "36px", fontSize: "0.75rem" }}>
                  {p.members?.[0]?.student?.name?.charAt(0) || "S"}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600 }} className="truncate">{p.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--slate-400)" }}>{p.members?.[0]?.student?.name}</div>
                </div>
                <span className="badge badge-yellow">Pending</span>
              </div>
            ))}
            {projects.filter((p) => p.status === "IDEA_SUBMITTED").length === 0 && (
              <div className="empty-state" style={{ padding: "24px" }}>
                <CheckCircle size={28} style={{ opacity: 0.3 }} />
                <p style={{ fontSize: "0.875rem" }}>No pending reviews</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Projects Table */}
      <div className="glass-card" style={{ padding: "24px" }}>
        <div className="section-header">
          <h3 className="section-title">Recent Projects</h3>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Student</th>
                <th>Domain</th>
                <th>Mentor</th>
                <th>Progress</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.slice(0, 8).map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.title}</td>
                  <td>{p.members?.[0]?.student?.name || "—"}</td>
                  <td>{p.domain?.name || "—"}</td>
                  <td>{p.mentor?.user?.name || "—"}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div className="progress-bar-track" style={{ width: "70px" }}>
                        <div className="progress-bar-fill" style={{ width: `${p.progress}%` }} />
                      </div>
                      <span style={{ fontSize: "0.8125rem" }}>{p.progress}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${
                      p.status === "COMPLETED" ? "badge-green" :
                      p.status === "AT_RISK" ? "badge-orange" :
                      p.status === "DELAYED" ? "badge-red" :
                      p.status === "IN_PROGRESS" ? "badge-blue" : "badge-gray"
                    }`}>
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {projects.length === 0 && (
            <div className="empty-state">
              <FolderKanban size={40} style={{ opacity: 0.3 }} />
              <p>No projects found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
