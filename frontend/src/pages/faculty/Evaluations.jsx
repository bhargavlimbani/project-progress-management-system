import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Eye, Award, CheckCircle2, Clock } from "lucide-react";
import { projectApi, evaluationApi } from "../../services/index.js";
import { useApiAll } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { formatPercent, formatDate } from "../../utils/format.js";
import {
  PageHeader, DataTable, SearchBar, StatusBadge, Tabs, ProgressBar,
} from "../../components/ui/index.js";

/** Projects ready for — or already carrying — a final evaluation (spec §50). */
export default function Evaluations() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const basePath = `/${user?.role?.toLowerCase()}/projects`;

  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");

  const { data, loading } = useApiAll(
    {
      projects: () => projectApi.list({ limit: 200 }),
      evaluations: () => evaluationApi.list(),
    },
    []
  );

  const evaluationByProject = useMemo(() => {
    const map = new Map();
    (data.evaluations || []).forEach((e) => map.set(e.projectId, e));
    return map;
  }, [data.evaluations]);

  const rows = useMemo(() => {
    const projects = data.projects?.projects || [];

    return projects
      .map((p) => {
        const evaluation = evaluationByProject.get(p.id);
        const maxTotal =
          evaluation?.marks?.reduce((s, m) => s + (m.criteria?.maxMarks || 0), 0) || 0;
        const percentage = maxTotal ? (evaluation.totalMarks / maxTotal) * 100 : 0;

        return {
          ...p,
          evaluation,
          maxTotal,
          percentage,
          isPublished: Boolean(evaluation?.completedAt),
        };
      })
      .filter((p) => {
        if (tab === "pending" && p.isPublished) return false;
        if (tab === "published" && !p.isPublished) return false;
        return true;
      });
  }, [data.projects, evaluationByProject, tab]);

  const publishedCount = rows.length && tab === "published" ? rows.length : undefined;

  const columns = [
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
      key: "members",
      label: "Student(s)",
      sortable: false,
      hideOnMobile: true,
      render: (p) => p.members?.map((m) => m.student.name).join(", ") || "—",
    },
    {
      key: "status",
      label: "Project Status",
      width: 150,
      render: (p) => <StatusBadge status={p.status} size="sm" />,
    },
    {
      key: "progress",
      label: "Progress",
      width: 120,
      render: (p) => (
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--white)", fontWeight: 700, marginBottom: 4 }}>
            {formatPercent(p.progress)}
          </div>
          <ProgressBar value={p.progress} height={5} />
        </div>
      ),
    },
    {
      key: "marks",
      label: "Marks",
      width: 140,
      sortValue: (p) => p.evaluation?.totalMarks ?? -1,
      render: (p) =>
        p.evaluation ? (
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--white)" }}>
              {p.evaluation.totalMarks ?? 0}
              <span style={{ color: "var(--slate-500)", fontWeight: 400 }}>
                {" "}
                / {p.maxTotal || "—"}
              </span>
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--purple-400)" }}>
              {p.evaluation.grade || "—"} · {formatPercent(p.percentage)}
            </div>
          </div>
        ) : (
          <span style={{ fontSize: "0.78rem", color: "var(--slate-500)" }}>Not evaluated</span>
        ),
    },
    {
      key: "isPublished",
      label: "Result",
      width: 130,
      render: (p) =>
        p.isPublished ? (
          <StatusBadge tone="green" label="Published" size="sm" icon={CheckCircle2} />
        ) : p.evaluation ? (
          <StatusBadge tone="yellow" label="Draft" size="sm" icon={Clock} />
        ) : (
          <StatusBadge tone="gray" label="Pending" size="sm" />
        ),
    },
    {
      key: "actions",
      label: "Action",
      align: "right",
      width: 110,
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
          {p.isPublished ? <Eye size={13} /> : <Award size={13} />}
          {p.isPublished ? "View" : "Evaluate"}
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={Trophy}
        title="Evaluations"
        subtitle="Award final marks against each subject's configured criteria."
        crumbs={[{ label: "Evaluations" }]}
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "pending", label: "Awaiting evaluation", icon: Clock },
          { key: "published", label: "Published", icon: CheckCircle2, badge: publishedCount },
        ]}
      />

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search project or student…" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        searchTerm={search}
        searchKeys={["title", "subject.name"]}
        onRowClick={(p) => navigate(`${basePath}/${p.id}`)}
        emptyIcon={Trophy}
        emptyTitle={tab === "pending" ? "Nothing awaiting evaluation" : "No published results yet"}
        emptyMessage={
          tab === "pending"
            ? "Projects appear here once they reach the final stage of their timeline."
            : "Published mark sheets will be listed here."
        }
      />
    </>
  );
}
