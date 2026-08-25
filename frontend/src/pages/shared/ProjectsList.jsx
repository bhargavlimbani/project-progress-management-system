import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FolderKanban, LayoutGrid, List, Eye, Plus } from "lucide-react";
import { projectApi, subjectApi, domainApi, mentorApi } from "../../services/index.js";
import { useApi, useApiAll } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  expectedProgress, riskLevel, formatPercent, formatDate, timeAgo,
} from "../../utils/format.js";
import { PROJECT_STATUS } from "../../utils/constants.js";
import {
  PageHeader, DataTable, SearchBar, FilterPanel, StatusBadge, ProgressBar,
  EmptyState, SkeletonCard,
} from "../../components/ui/index.js";
import ProjectCard from "../../components/project/ProjectCard.jsx";

/**
 * Project list shared by every role. The server scopes the rows — faculty see
 * their subjects, mentors their assignments, students their own projects — so
 * this page only decides how to present them (spec §44).
 */
export default function ProjectsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const basePath = `/${user?.role?.toLowerCase()}/projects`;
  const isAdmin = user?.role === "ADMIN";

  const [view, setView] = useState("table");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [filters, setFilters] = useState({
    subjectId: "",
    domainId: "",
    mentorId: "",
    status: params.get("status") || "",
    minProgress: "",
  });

  const { data: meta } = useApiAll(
    {
      subjects: () => subjectApi.list(),
      domains: () => domainApi.list(),
      ...(isAdmin ? { mentors: () => mentorApi.list() } : {}),
    },
    [isAdmin]
  );

  const query = useMemo(
    () => ({
      page,
      limit,
      ...(search && { search }),
      ...(filters.subjectId && { subjectId: filters.subjectId }),
      ...(filters.domainId && { domainId: filters.domainId }),
      ...(filters.mentorId && { mentorId: filters.mentorId }),
      ...(filters.status && { status: filters.status }),
    }),
    [page, limit, search, filters]
  );

  const { data, loading } = useApi(() => projectApi.list(query), [query], {
    initialData: { projects: [], total: 0, totalPages: 1 },
  });

  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  // Progress is a client-side filter — the API doesn't range-query on it.
  const projects = useMemo(() => {
    const rows = data?.projects || [];
    if (!filters.minProgress) return rows;
    return rows.filter((p) => (p.progress || 0) >= Number(filters.minProgress));
  }, [data, filters.minProgress]);

  const resetFilters = () => {
    setFilters({ subjectId: "", domainId: "", mentorId: "", status: "", minProgress: "" });
    setParams({}, { replace: true });
  };

  const columns = [
    {
      key: "members",
      label: "Student",
      sortable: false,
      render: (p) => {
        const names = p.members?.map((m) => m.student.name) || [];
        return (
          <div style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontWeight: 600, color: "var(--white)" }}>
              {names[0] || "Unassigned"}
              {names.length > 1 && (
                <span style={{ color: "var(--slate-500)", fontWeight: 400 }}>
                  {" "}
                  +{names.length - 1}
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--purple-400)" }}>
              {p.members?.[0]?.student?.enrollmentNumber}
            </div>
          </div>
        );
      },
    },
    {
      key: "title",
      label: "Project",
      render: (p) => (
        <div style={{ minWidth: 0 }}>
          <div className="truncate" style={{ fontWeight: 600, color: "var(--white)" }}>
            {p.title}
          </div>
          <div className="truncate" style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>
            {p.subject?.name}
          </div>
        </div>
      ),
    },
    {
      key: "domain.name",
      label: "Domain",
      width: 130,
      hideOnMobile: true,
      render: (p) => p.domain?.name || "—",
    },
    {
      key: "mentor.user.name",
      label: "Mentor",
      width: 150,
      hideOnMobile: true,
      render: (p) =>
        p.mentor?.user?.name || (
          <span style={{ color: "var(--yellow-400)", fontSize: "0.78rem" }}>Unassigned</span>
        ),
    },
    {
      key: "currentWeek",
      label: "Week",
      width: 80,
      align: "center",
      render: (p) => `${p.currentWeek}/${p.subject?.durationWeeks || 12}`,
    },
    {
      key: "progress",
      label: "Progress",
      width: 165,
      render: (p) => {
        const expected = expectedProgress(p.currentWeek, p.subject?.durationWeeks || 12);
        const risk = riskLevel(p.progress, expected);
        return (
          <div>
            <div
              className="flex items-center justify-between"
              style={{ fontSize: "0.72rem", marginBottom: 4 }}
            >
              <span style={{ color: "var(--white)", fontWeight: 700 }}>
                {formatPercent(p.progress)}
              </span>
              <span style={{ color: `var(--${risk.tone === "green" ? "green" : risk.tone}-400)` }}>
                vs {formatPercent(expected)}
              </span>
            </div>
            <ProgressBar value={p.progress} expected={expected} height={5} />
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      width: 150,
      render: (p) => <StatusBadge status={p.status} size="sm" />,
    },
    {
      key: "updatedAt",
      label: "Last Submission",
      width: 140,
      hideOnMobile: true,
      render: (p) => (
        <span style={{ fontSize: "0.78rem", color: "var(--slate-400)" }} title={formatDate(p.updatedAt)}>
          {timeAgo(p.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Action",
      align: "right",
      width: 90,
      sortable: false,
      render: (p) => (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`${basePath}/${p.id}`);
          }}
        >
          <Eye size={13} />
          View
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={FolderKanban}
        title={isAdmin ? "All Projects" : "My Projects"}
        subtitle={
          isAdmin
            ? "Every project in the department, with expected-vs-actual progress."
            : "Projects you're responsible for, with how they're actually tracking."
        }
        crumbs={[{ label: "Projects" }]}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              className={`btn btn-sm ${view === "table" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setView("table")}
              aria-label="Table view"
            >
              <List size={14} />
            </button>
            <button
              type="button"
              className={`btn btn-sm ${view === "grid" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setView("grid")}
              aria-label="Card view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        }
      />

      <div className="toolbar">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search project, student or enrollment…"
        />

        <FilterPanel
          value={filters}
          onChange={setFilters}
          onReset={resetFilters}
          filters={[
            {
              key: "subjectId",
              label: "Subject",
              options: (meta.subjects || []).map((s) => ({ value: s.id, label: s.name })),
            },
            {
              key: "domainId",
              label: "Domain",
              options: (meta.domains || []).map((d) => ({ value: d.id, label: d.name })),
            },
            ...(isAdmin
              ? [
                  {
                    key: "mentorId",
                    label: "Mentor",
                    options: (meta.mentors || []).map((m) => ({
                      value: m.id,
                      label: m.user?.name,
                    })),
                  },
                ]
              : []),
            {
              key: "status",
              label: "Status",
              options: Object.entries(PROJECT_STATUS).map(([value, cfg]) => ({
                value,
                label: cfg.label,
              })),
            },
            {
              key: "minProgress",
              label: "Minimum Progress",
              type: "range",
              min: 0,
              max: 100,
              suffix: "%",
            },
          ]}
        />
      </div>

      {view === "table" ? (
        <DataTable
          columns={columns}
          rows={projects}
          loading={loading}
          onRowClick={(p) => navigate(`${basePath}/${p.id}`)}
          emptyIcon={FolderKanban}
          emptyTitle="No projects found"
          emptyMessage={
            search || Object.values(filters).some(Boolean)
              ? "No projects match your search and filters."
              : "Projects will appear here once students submit their ideas."
          }
          serverPagination={{
            page,
            limit,
            total: data?.total ?? 0,
            totalPages: data?.totalPages ?? 1,
            onPageChange: setPage,
            onLimitChange: (n) => {
              setLimit(n);
              setPage(1);
            },
          }}
        />
      ) : loading ? (
        <div className="card-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} height={320} />
          ))}
        </div>
      ) : !projects.length ? (
        <div className="glass-card">
          <EmptyState
            icon={FolderKanban}
            title="No projects found"
            message="Projects will appear here once students submit their ideas."
          />
        </div>
      ) : (
        <div className="card-grid">
          {projects.map((project, i) => (
            <ProjectCard key={project.id} project={project} basePath={basePath} index={i} />
          ))}
        </div>
      )}
    </>
  );
}
