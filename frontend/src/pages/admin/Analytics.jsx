import { useMemo } from "react";
import {
  BarChart3, TrendingUp, Users, UserCheck, Layers, BookOpen, AlertTriangle,
  CheckCircle2, Activity,
} from "lucide-react";
import { analyticsApi } from "../../services/index.js";
import { useApiAll } from "../../hooks/useApi.js";
import { PROJECT_STATUS, STATUS_TONE_HEX, CHART_COLORS } from "../../utils/constants.js";
import { humanize, formatPercent } from "../../utils/format.js";
import { PageHeader, DashboardCard, SkeletonChart, SkeletonKpiGrid } from "../../components/ui/index.js";
import {
  ChartCard, StatusDonut, HorizontalBars, GroupedBars, ProgressTrend, SubmissionLine,
  CompletionGauge,
} from "../../components/charts/index.jsx";

/**
 * Department-wide analytics (spec §52). Every figure comes from the database
 * — nothing here is precomputed or hard-coded.
 */
export default function Analytics() {
  const { data, loading } = useApiAll(
    {
      stats: () => analyticsApi.adminStats(),
      status: () => analyticsApi.projectStatus(),
      domains: () => analyticsApi.domainDist(),
      mentors: () => analyticsApi.mentorWorkload(),
      faculty: () => analyticsApi.facultyWorkload(),
      subjects: () => analyticsApi.subjectStats(),
      weekly: () => analyticsApi.weeklySubmissions(),
      trend: () => analyticsApi.progressTrend(),
    },
    []
  );

  const stats = data.stats || {};
  const statusData = useMemo(
    () =>
      (data.status || []).map((s) => ({
        name: PROJECT_STATUS[s.status]?.label || humanize(s.status),
        value: s.count ?? s._count ?? 0,
        tone: PROJECT_STATUS[s.status]?.tone || "gray",
      })),
    [data.status]
  );

  const domainData = useMemo(
    () =>
      (data.domains || []).map((d) => ({
        name: d.domain ?? d.name,
        projects: d.count ?? d.projects ?? 0,
      })),
    [data.domains]
  );

  const mentorData = useMemo(
    () =>
      (data.mentors || [])
        .map((m) => ({ name: m.name, active: m.activeProjects ?? 0, total: m.totalProjects ?? 0 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
    [data.mentors]
  );

  const facultyData = useMemo(
    () =>
      (data.faculty || [])
        .map((f) => ({
          name: f.name,
          active: f.activeProjects ?? 0,
          pending: f.pendingApprovals ?? 0,
        }))
        .sort((a, b) => b.active - a.active)
        .slice(0, 10),
    [data.faculty]
  );

  const subjectData = useMemo(
    () =>
      (data.subjects || []).map((s) => ({
        name: s.name?.length > 18 ? `${s.name.slice(0, 17)}…` : s.name,
        total: s.total ?? 0,
        completed: s.completed ?? 0,
        atRisk: s.atRisk ?? 0,
      })),
    [data.subjects]
  );

  const weeklyData = useMemo(
    () =>
      (data.weekly || []).map((w) => ({
        week: `W${w.week ?? w.weekNumber}`,
        submissions: w.submissions ?? w.count ?? 0,
      })),
    [data.weekly]
  );

  // Real expected-vs-actual, computed server-side from approved milestones.
  const trendData = useMemo(
    () =>
      (data.trend || []).map((t) => ({
        week: `W${t.week}`,
        expected: t.expected,
        actual: t.actual,
      })),
    [data.trend]
  );

  const totalProjects = stats.totalProjects ?? 0;
  const onTrack = Math.max(
    0,
    totalProjects - (stats.atRiskProjects ?? 0) - (stats.delayedProjects ?? 0)
  );
  const completionRate = totalProjects
    ? ((stats.completedProjects ?? 0) / totalProjects) * 100
    : 0;

  const healthData = [
    { name: "On Track", value: onTrack, tone: "green" },
    { name: "At Risk", value: stats.atRiskProjects ?? 0, tone: "orange" },
    { name: "Delayed", value: stats.delayedProjects ?? 0, tone: "red" },
  ].filter((d) => d.value > 0);

  return (
    <>
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        subtitle="Where the department actually stands — by subject, domain, mentor and week."
        crumbs={[{ label: "Admin", to: "/admin" }, { label: "Analytics" }]}
      />

      {loading ? (
        <>
          <SkeletonKpiGrid count={4} />
          <div className="chart-grid" style={{ marginTop: 20 }}>
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </>
      ) : (
        <>
          {/* Headline figures */}
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <DashboardCard
              label="Total Projects"
              value={totalProjects}
              icon={BarChart3}
              tone="purple"
              index={0}
            />
            <DashboardCard
              label="On Track"
              value={onTrack}
              icon={CheckCircle2}
              tone="green"
              trendLabel={totalProjects ? formatPercent((onTrack / totalProjects) * 100) : "—"}
              index={1}
            />
            <DashboardCard
              label="At Risk / Delayed"
              value={(stats.atRiskProjects ?? 0) + (stats.delayedProjects ?? 0)}
              icon={AlertTriangle}
              tone="orange"
              trendLabel="Behind expected pace"
              index={2}
            />
            <DashboardCard
              label="Completion Rate"
              value={formatPercent(completionRate)}
              icon={TrendingUp}
              tone="blue"
              trendLabel={`${stats.completedProjects ?? 0} completed`}
              index={3}
            />
          </div>

          {/* The core USP chart */}
          <div style={{ marginBottom: 20 }}>
            <ChartCard
              title="Expected vs Actual Progress"
              subtitle="The gap between where projects should be and where they are — the reason SAPMS exists."
              height={300}
              isEmpty={!trendData.length}
              emptyMessage="Once projects start submitting weekly progress, the comparison appears here."
            >
              <ProgressTrend data={trendData} />
            </ChartCard>
          </div>

          <div className="chart-grid" style={{ marginBottom: 20 }}>
            <ChartCard
              title="Project Health"
              subtitle="On track vs at risk vs delayed"
              isEmpty={!healthData.length}
              emptyMessage="No active projects to assess yet."
            >
              <StatusDonut data={healthData} colorFor={(e) => STATUS_TONE_HEX[e.tone]} />
            </ChartCard>

            <ChartCard
              title="Project Status Distribution"
              subtitle="Every project by lifecycle stage"
              isEmpty={!statusData.length}
              emptyMessage="No projects created yet."
            >
              <StatusDonut data={statusData} colorFor={(e) => STATUS_TONE_HEX[e.tone]} />
            </ChartCard>
          </div>

          <div className="chart-grid" style={{ marginBottom: 20 }}>
            <ChartCard
              title="Projects by Domain"
              subtitle="Where students are choosing to work"
              isEmpty={!domainData.length}
              emptyMessage="No projects have a domain assigned yet."
            >
              <HorizontalBars data={domainData} dataKey="projects" color="#7c3aed" />
            </ChartCard>

            <ChartCard
              title="Weekly Submission Volume"
              subtitle="Submissions received per project week"
              isEmpty={!weeklyData.length}
              emptyMessage="No weekly progress has been submitted yet."
            >
              <SubmissionLine data={weeklyData} />
            </ChartCard>
          </div>

          <div className="chart-grid" style={{ marginBottom: 20 }}>
            <ChartCard
              title="Mentor Workload"
              subtitle="Top 10 by assigned projects"
              isEmpty={!mentorData.length}
              emptyMessage="No mentors have been assigned to projects yet."
              height={300}
            >
              <GroupedBars
                data={mentorData}
                series={[
                  { key: "active", label: "Active", color: "#7c3aed" },
                  { key: "total", label: "Total", color: "#3b82f6" },
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Faculty Workload"
              subtitle="Top 10 by active projects and pending approvals"
              isEmpty={!facultyData.length}
              emptyMessage="No faculty have supervised projects yet."
              height={300}
            >
              <GroupedBars
                data={facultyData}
                series={[
                  { key: "active", label: "Active Projects", color: "#22c55e" },
                  { key: "pending", label: "Pending Approvals", color: "#f97316" },
                ]}
              />
            </ChartCard>
          </div>

          <div className="split-grid">
            <ChartCard
              title="Subject-wise Projects"
              subtitle="Total, completed and at-risk projects per subject"
              isEmpty={!subjectData.length}
              emptyMessage="No subjects have projects yet."
              height={300}
            >
              <GroupedBars
                data={subjectData}
                series={[
                  { key: "total", label: "Total", color: "#3b82f6" },
                  { key: "completed", label: "Completed", color: "#22c55e" },
                  { key: "atRisk", label: "At Risk", color: "#f97316" },
                ]}
              />
            </ChartCard>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <ChartCard
                title="Completion Rate"
                subtitle="Projects finished this cycle"
                height={200}
                isEmpty={totalProjects === 0}
                emptyMessage="No projects yet."
              >
                <CompletionGauge value={completionRate} />
              </ChartCard>

              <div className="glass-card chart-card">
                <h3 className="chart-card-title">At a glance</h3>
                <p className="chart-card-subtitle">Current department totals</p>

                <div className="stat-row">
                  <span className="stat-row-label flex items-center gap-2">
                    <Users size={13} /> Students
                  </span>
                  <span className="stat-row-value">{stats.totalStudents ?? 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row-label flex items-center gap-2">
                    <Users size={13} /> Faculty
                  </span>
                  <span className="stat-row-value">{stats.totalFaculty ?? 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row-label flex items-center gap-2">
                    <UserCheck size={13} /> Mentors
                  </span>
                  <span className="stat-row-value">{stats.totalMentors ?? 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row-label flex items-center gap-2">
                    <BookOpen size={13} /> Subjects
                  </span>
                  <span className="stat-row-value">{stats.totalSubjects ?? 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row-label flex items-center gap-2">
                    <Layers size={13} /> Domains
                  </span>
                  <span className="stat-row-value">{stats.totalDomains ?? 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row-label flex items-center gap-2">
                    <Activity size={13} /> Average progress
                  </span>
                  <span className="stat-row-value">
                    {formatPercent(stats.averageProgress ?? 0, 1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
