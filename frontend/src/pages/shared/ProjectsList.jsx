import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FolderKanban, LayoutGrid, List, Eye, Plus, BookOpen, Layers3 } from "lucide-react";
import { projectApi, subjectApi, domainApi, mentorApi, facultyApi } from "../../services/index.js";
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
  const isFaculty = user?.role === "FACULTY";

  const [view, setView] = useState("table");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(isFaculty ? 50 : 15);
  const [groupBySubject, setGroupBySubject] = useState(isFaculty);
  const [filters, setFilters] = useState({
    subjectId: params.get("subjectId") || "",
    facultyId: "",
    domainId: "",
    mentorId: "",
    status: params.get("status") || "",
    minProgress: "",
  });

  const { data: meta } = useApiAll(
    {
      subjects: () => subjectApi.list(),
      domains: () => domainApi.list(),
      ...(isAdmin ? { mentors: () => mentorApi.list(), faculty: () => facultyApi.list() } : {}),
    },
    [isAdmin]
  );

  const query = useMemo(
    () => ({
      page,
      limit,
      ...(search && { search }),
      ...(filters.subjectId && { subjectId: filters.subjectId }),
      ...(filters.facultyId && { facultyId: filters.facultyId }),
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

  // Determine subjects relevant to this faculty/user
  const facultySubjects = useMemo(() => {
    const allSubs = meta?.subjects || [];
    if (isFaculty) {
      // Find subjects of projects assigned to this faculty
      const assignedSubjectIds = new Set(
        (data?.projects || []).map((p) => p.subjectId).filter(Boolean)
      );
      const relevant = allSubs.filter((s) => assignedSubjectIds.has(s.id));
      if (relevant.length > 0) return relevant;
      return allSubs.filter((s) => s.faculty?.some((f) => f.faculty?.userId === user?.id));
    }
    return allSubs;
  }, [meta?.subjects, data?.projects, isFaculty, user]);

  // Progress is a client-side filter — the API doesn't range-query on it.
  const projects = useMemo(() => {
    const rows = data?.projects || [];
    if (!filters.minProgress) return rows;
    return rows.filter((p) => (p.progress || 0) >= Number(filters.minProgress));
  }, [data, filters.minProgress]);

  // Count projects per subject for badges
  const subjectProjectCounts = useMemo(() => {
    const counts = {};
    for (const p of data?.projects || []) {
      if (p.subjectId) {
        counts[p.subjectId] = (counts[p.subjectId] || 0) + 1;
      }
    }
    return counts;
  }, [data?.projects]);

  // Group projects by subject when subject-wise grouping is active
  const groupedSubjectSections = useMemo(() => {
    if (!projects.length) return [];
    const map = new Map();

    for (const sub of facultySubjects) {
      map.set(sub.id, { subject: sub, list: [] });
    }

    for (const p of projects) {
      const subId = p.subjectId;
      if (subId && map.has(subId)) {
        map.get(subId).list.push(p);
      } else {
        const fallbackSub = p.subject || { id: subId || "unassigned", name: "Other Projects", code: "OTHER" };
        if (!map.has(fallbackSub.id)) {
          map.set(fallbackSub.id, { subject: fallbackSub, list: [] });
        }
        map.get(fallbackSub.id).list.push(p);
      }
    }

    return Array.from(map.values()).filter((sec) => sec.list.length > 0);
  }, [projects, facultySubjects]);

  const resetFilters = () => {
    setFilters({ subjectId: "", facultyId: "", domainId: "", mentorId: "", status: "", minProgress: "" });
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
    ...(isAdmin
      ? [
          {
            key: "faculty.user.name",
            label: "Assigned Faculty",
            width: 160,
            hideOnMobile: true,
            render: (p) => (
              <div style={{ minWidth: 0 }}>
                <div className="truncate" style={{ fontWeight: 600, color: "var(--white)", fontSize: "0.8125rem" }}>
                  {p.faculty?.user?.name || (
                    <span style={{ color: "var(--yellow-400)" }}>Unassigned</span>
                  )}
                </div>
                {p.faculty?.designation && (
                  <div className="truncate" style={{ fontSize: "0.7rem", color: "var(--slate-400)" }}>
                    {p.faculty.designation}
                  </div>
                )}
              </div>
            ),
          },
        ]
      : []),
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

      {/* Subject-Wise Filter Pills Bar */}
      {facultySubjects.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 4,
            marginBottom: 16,
            scrollbarWidth: "thin",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setFilters((f) => ({ ...f, subjectId: "" }));
              setPage(1);
            }}
            className={`btn btn-sm ${!filters.subjectId ? "btn-primary" : "btn-secondary"}`}
            style={{
              borderRadius: 20,
              padding: "6px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              fontSize: "0.8125rem",
            }}
          >
            <BookOpen size={14} />
            All Subjects
            <span
              style={{
                background: !filters.subjectId ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
                padding: "1px 7px",
                borderRadius: 10,
                fontSize: "0.72rem",
                fontWeight: 700,
              }}
            >
              {data?.total ?? projects.length}
            </span>
          </button>

          {facultySubjects.map((sub) => {
            const isSelected = filters.subjectId === sub.id;
            const count = subjectProjectCounts[sub.id] || sub._count?.projects || 0;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => {
                  setFilters((f) => ({ ...f, subjectId: sub.id }));
                  setPage(1);
                }}
                className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-secondary"}`}
                style={{
                  borderRadius: 20,
                  padding: "6px 14px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                  fontSize: "0.8125rem",
                }}
              >
                <span>{sub.name}</span>
                {sub.code && (
                  <span style={{ opacity: 0.7, fontSize: "0.72rem" }}>
                    ({sub.code})
                  </span>
                )}
                <span
                  style={{
                    background: isSelected ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)",
                    padding: "1px 7px",
                    borderRadius: 10,
                    fontSize: "0.72rem",
                    fontWeight: 700,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {isFaculty && (
            <button
              type="button"
              onClick={() => setGroupBySubject((g) => !g)}
              className={`btn btn-sm ${groupBySubject ? "btn-secondary" : "btn-secondary"}`}
              style={{
                marginLeft: "auto",
                borderRadius: 20,
                padding: "6px 14px",
                fontSize: "0.75rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: groupBySubject ? "rgba(139, 92, 246, 0.2)" : undefined,
                borderColor: groupBySubject ? "var(--purple-500)" : undefined,
                color: groupBySubject ? "var(--purple-300)" : undefined,
                whiteSpace: "nowrap",
              }}
              title="Toggle subject-wise grouped sections"
            >
              <Layers3 size={13} />
              {groupBySubject ? "Grouped Subject-Wise" : "Group by Subject"}
            </button>
          )}
        </div>
      )}

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
                    key: "facultyId",
                    label: "Assigned Faculty",
                    options: (meta.faculty || []).map((f) => ({
                      value: f.id,
                      label: f.user?.name,
                    })),
                  },
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

      {groupBySubject && !filters.subjectId ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {groupedSubjectSections.map(({ subject, list }) => (
            <div
              key={subject.id}
              className="glass-card"
              style={{
                padding: 20,
                borderRadius: 14,
                background: "var(--navy-900)",
                border: "1px solid var(--navy-700)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: "rgba(139, 92, 246, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <BookOpen size={18} color="var(--purple-400)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#fff" }}>
                      {subject.name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--slate-400)", display: "flex", gap: 8 }}>
                      <span>Code: {subject.code}</span>
                      {subject.durationWeeks && <span>• {subject.durationWeeks} Weeks</span>}
                      <span>• {list.length} {list.length === 1 ? "Project" : "Projects"}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: "0.75rem" }}
                  onClick={() => {
                    setFilters((f) => ({ ...f, subjectId: subject.id }));
                    setPage(1);
                  }}
                >
                  View Subject Only →
                </button>
              </div>

              {view === "table" ? (
                <DataTable
                  columns={columns}
                  rows={list}
                  loading={loading}
                  onRowClick={(p) => navigate(`${basePath}/${p.id}`)}
                  emptyIcon={FolderKanban}
                  emptyTitle={`No projects in ${subject.name}`}
                  emptyMessage="Projects in this subject will appear here once students submit ideas."
                />
              ) : (
                <div className="card-grid">
                  {list.map((project, i) => (
                    <ProjectCard key={project.id} project={project} basePath={basePath} index={i} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : view === "table" ? (
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
