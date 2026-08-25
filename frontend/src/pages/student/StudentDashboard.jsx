import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { analyticsApi, projectApi } from "../../services/index.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  FolderKanban, AlertTriangle, CheckCircle, Clock,
  TrendingUp, BookOpen, ArrowRight, Zap,
} from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

function ProjectCard({ project }) {
  const statusColor = {
    IN_PROGRESS: "badge-blue",
    AT_RISK: "badge-orange",
    DELAYED: "badge-red",
    COMPLETED: "badge-green",
    IDEA_SUBMITTED: "badge-purple",
    APPROVED: "badge-green",
    MENTOR_ASSIGNED: "badge-blue",
    DRAFT: "badge-gray",
  };

  return (
    <div className="glass-card glass-card-hover" style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: "0.6875rem", color: "var(--purple-400)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
            {project.subject?.name}
          </div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1.3 }} className="truncate">{project.title}</h3>
        </div>
        <span className={`badge ${statusColor[project.status] || "badge-gray"}`} style={{ marginLeft: "8px", flexShrink: 0 }}>
          {project.status?.replace(/_/g, " ")}
        </span>
      </div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "14px" }}>
        {project.domain && (
          <span style={{ fontSize: "0.75rem", color: "var(--slate-400)" }}>
            🔬 {project.domain.name}
          </span>
        )}
        <span style={{ fontSize: "0.75rem", color: "var(--slate-400)" }}>
          📅 Week {project.currentWeek}
        </span>
      </div>

      {/* Faculty & Mentor */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "14px" }}>
        {project.faculty && (
          <div style={{ fontSize: "0.75rem", color: "var(--slate-400)" }}>
            👩‍🏫 {project.faculty.user?.name}
          </div>
        )}
        {project.mentor && (
          <div style={{ fontSize: "0.75rem", color: "var(--slate-400)" }}>
            🧑‍🏫 {project.mentor.user?.name}
          </div>
        )}
      </div>

      {/* Progress */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--slate-400)" }}>Progress</span>
          <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "white" }}>{project.progress}%</span>
        </div>
        <div className="progress-bar-track">
          <div
            className={`progress-bar-fill ${
              project.status === "AT_RISK" ? "at-risk" :
              project.status === "DELAYED" ? "delayed" :
              project.status === "COMPLETED" ? "completed" : ""
            }`}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Next milestone */}
      {project.milestones?.find((m) => m.status !== "APPROVED") && (
        <div style={{
          fontSize: "0.75rem",
          color: "var(--slate-400)",
          padding: "8px 10px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: "8px",
          marginBottom: "12px",
        }}>
          📌 Next: {project.milestones.find((m) => m.status !== "APPROVED")?.title}
        </div>
      )}

      <Link
        to={`/student/projects/${project.id}`}
        className="btn btn-secondary"
        style={{ width: "100%", justifyContent: "center" }}
        id={`view-project-${project.id}`}
      >
        View Project <ArrowRight size={14} />
      </Link>
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  useEffect(() => {
    Promise.all([
      analyticsApi.studentStats(),
      projectApi.myProjects(),
    ]).then(([s, p]) => {
      setStats(s.data);
      setProjects(p.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const overallProgress = stats?.overallProgress || 0;
  const radialData = [{ name: "Progress", value: overallProgress, fill: "#7c3aed" }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Greeting */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800 }}>
            {greeting}, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p style={{ color: "var(--slate-400)", marginTop: "4px" }}>
            Here's an overview of all your academic projects
          </p>
        </div>
        <div style={{
          padding: "10px 18px",
          background: "rgba(124,58,237,0.1)",
          border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--purple-400)",
        }}>
          <Zap size={16} />
          Sem {user?.semester} • {user?.academicYear}
        </div>
      </div>

      {/* Overall Progress + KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "20px", alignItems: "start" }}>
        {/* Circular Progress */}
        <div className="glass-card" style={{ padding: "20px", textAlign: "center" }}>
          <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--slate-400)", marginBottom: "8px" }}>Overall Progress</div>
          <div style={{ position: "relative", height: "140px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                data={radialData}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar
                  background={{ fill: "rgba(255,255,255,0.05)" }}
                  dataKey="value"
                  cornerRadius={8}
                  angleAxisId={0}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "white" }}>{overallProgress}%</div>
              <div style={{ fontSize: "0.65rem", color: "var(--slate-400)" }}>Avg Progress</div>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
          {[
            { label: "Total Projects", value: stats?.totalProjects, icon: FolderKanban, color: "#60a5fa" },
            { label: "Active", value: stats?.activeProjects, icon: TrendingUp, color: "#a78bfa" },
            { label: "Completed", value: stats?.completedProjects, icon: CheckCircle, color: "#4ade80" },
            { label: "At Risk", value: stats?.atRiskProjects, icon: AlertTriangle, color: "#fb923c" },
          ].map((k, i) => (
            <div key={i} className="glass-card glass-card-hover" style={{ padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <k.icon size={18} color={k.color} />
                <span style={{ fontSize: "0.75rem", color: "var(--slate-400)", fontWeight: 600 }}>{k.label}</span>
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "white" }}>{k.value ?? 0}</div>
            </div>
          ))}
        </div>
      </div>

      {/* My Projects */}
      <div>
        <div className="section-header">
          <h2 className="section-title">My Projects</h2>
          <Link to="/student/projects" style={{ fontSize: "0.875rem", color: "var(--purple-400)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card" style={{ height: "200px" }}>
                <div className="skeleton" style={{ height: "100%", borderRadius: "16px" }} />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="glass-card">
            <div className="empty-state">
              <FolderKanban size={48} style={{ opacity: 0.2 }} />
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700 }}>No projects yet</h3>
              <p style={{ color: "var(--slate-400)" }}>Your academic projects will appear here once assigned.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
