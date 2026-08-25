import { useState, useEffect } from "react";
import { analyticsApi, projectApi, progressApi } from "../../services/index.js";
import { FolderKanban, AlertTriangle, TrendingUp, Calendar, Users, CheckCircle } from "lucide-react";

function KpiCard({ label, value, icon: Icon, color = "purple" }) {
  const colors = { purple: "#a78bfa", blue: "#60a5fa", green: "#4ade80", orange: "#fb923c", red: "#f87171" };
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

export default function MentorDashboard() {
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.mentorStats(),
      projectApi.list({ limit: 20 }),
      progressApi.pendingReviews(),
    ]).then(([s, p, pr]) => {
      setStats(s.data);
      setProjects(p.data.projects || []);
      setPendingReviews(pr.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      <div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800 }}>Mentor Dashboard</h1>
        <p style={{ color: "var(--slate-400)", marginTop: "4px" }}>Guide and review your assigned students' progress</p>
      </div>

      <div className="kpi-grid">
        <KpiCard label="Total Projects" value={stats?.totalProjects} icon={FolderKanban} color="blue" />
        <KpiCard label="At Risk" value={stats?.atRisk} icon={AlertTriangle} color="orange" />
        <KpiCard label="Pending Reviews" value={stats?.pendingReviews} icon={TrendingUp} color="purple" />
        <KpiCard label="Upcoming Meetings" value={stats?.upcomingMeetings} icon={Calendar} color="green" />
      </div>

      <div className="chart-grid">
        {/* Pending Reviews */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <div className="section-header">
            <h3 className="section-title">Pending Reviews</h3>
            {pendingReviews.length > 0 && <span className="badge badge-orange">{pendingReviews.length}</span>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "320px", overflowY: "auto" }}>
            {pendingReviews.slice(0, 6).map((pr) => (
              <div key={pr.id} style={{
                padding: "12px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Week {pr.weekNumber}</span>
                  <span className="badge badge-yellow">Pending Review</span>
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--slate-300)", marginBottom: "4px" }}>{pr.taskTitle}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--slate-400)" }}>
                  {pr.project?.title} • {pr.student?.name}
                </div>
              </div>
            ))}
            {pendingReviews.length === 0 && (
              <div className="empty-state" style={{ padding: "24px" }}>
                <CheckCircle size={32} style={{ opacity: 0.3 }} />
                <p>All reviews completed!</p>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Projects */}
        <div className="glass-card" style={{ padding: "24px" }}>
          <h3 style={{ marginBottom: "16px", fontSize: "1rem" }}>My Projects</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "320px", overflowY: "auto" }}>
            {projects.slice(0, 6).map((p) => (
              <div key={p.id} style={{
                padding: "12px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}>
                <div className="avatar-placeholder" style={{ width: "36px", height: "36px", fontSize: "0.75rem" }}>
                  {p.members?.[0]?.student?.name?.charAt(0) || "S"}
                </div>
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600 }} className="truncate">{p.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--slate-400)" }}>
                    {p.members?.[0]?.student?.name} • Week {p.currentWeek}
                  </div>
                  <div style={{ marginTop: "6px" }}>
                    <div className="progress-bar-track">
                      <div className={`progress-bar-fill ${p.status === "AT_RISK" ? "at-risk" : p.status === "DELAYED" ? "delayed" : ""}`}
                        style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--purple-400)" }}>{p.progress}%</span>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="empty-state" style={{ padding: "24px" }}>
                <FolderKanban size={32} style={{ opacity: 0.3 }} />
                <p>No projects assigned</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
