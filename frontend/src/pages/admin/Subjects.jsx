import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  BookOpen, Plus, Pencil, Trash2, Users, FolderKanban, CalendarDays,
  ClipboardCheck, Trophy, Sparkles, X,
} from "lucide-react";
import { subjectApi, academicApi, facultyApi, evaluationApi } from "../../services/index.js";
import { useApiAll } from "../../hooks/useApi.js";
import { apiErrorMessage } from "../../utils/format.js";
import {
  DEFAULT_MILESTONE_TEMPLATE,
  DEFAULT_EVALUATION_CRITERIA,
} from "../../utils/constants.js";
import {
  PageHeader, DataTable, Modal, ConfirmationDialog, SearchBar, StatusBadge, Tabs,
} from "../../components/ui/index.js";

const emptySubject = {
  name: "",
  code: "",
  semesterId: "",
  academicYearId: "",
  description: "",
  durationWeeks: 12,
  facultyIds: [],
  isActive: true,
};

export default function Subjects() {
  const { data, loading, refetch } = useApiAll(
    {
      subjects: () => subjectApi.list(),
      years: () => academicApi.getYears(),
      semesters: () => academicApi.getSemesters(),
      faculty: () => facultyApi.list(),
    },
    []
  );

  const subjects = data.subjects || [];
  const years = data.years || [];
  const semesters = data.semesters || [];
  const faculty = data.faculty || [];

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptySubject);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [configuring, setConfiguring] = useState(null);

  const semestersForYear = useMemo(
    () => semesters.filter((s) => s.academicYearId === form.academicYearId),
    [semesters, form.academicYearId]
  );

  const openCreate = () => {
    const activeYear = years.find((y) => y.isActive) || years[0];
    setForm({ ...emptySubject, academicYearId: activeYear?.id || "" });
    setEditing({});
  };

  const openEdit = (subject) => {
    setForm({
      name: subject.name,
      code: subject.code,
      semesterId: subject.semesterId,
      academicYearId: subject.academicYearId,
      description: subject.description || "",
      durationWeeks: subject.durationWeeks,
      facultyIds: subject.faculty?.map((f) => f.facultyId) || [],
      isActive: subject.isActive,
    });
    setEditing(subject);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) {
        await subjectApi.update(editing.id, form);
        toast.success("Subject updated.");
      } else {
        await subjectApi.create(form);
        toast.success("Subject created.");
      }
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await subjectApi.delete(deleting.id);
      toast.success("Subject deleted.");
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const toggleFaculty = (facultyId) =>
    setForm((f) => ({
      ...f,
      facultyIds: f.facultyIds.includes(facultyId)
        ? f.facultyIds.filter((id) => id !== facultyId)
        : [...f.facultyIds, facultyId],
    }));

  const columns = [
    {
      key: "name",
      label: "Subject",
      render: (s) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--white)" }}>{s.name}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--purple-400)", marginTop: 2 }}>
            {s.code}
          </div>
        </div>
      ),
    },
    {
      key: "semester.number",
      label: "Semester",
      width: 110,
      hideOnMobile: true,
      render: (s) => `Sem ${s.semester?.number ?? "—"}`,
    },
    {
      key: "durationWeeks",
      label: "Duration",
      width: 110,
      hideOnMobile: true,
      render: (s) => (
        <span className="flex items-center gap-1">
          <CalendarDays size={13} color="var(--slate-500)" />
          {s.durationWeeks} wks
        </span>
      ),
    },
    {
      key: "faculty",
      label: "Faculty",
      sortable: false,
      render: (s) =>
        s.faculty?.length ? (
          <span style={{ fontSize: "0.8125rem" }}>
            {s.faculty.map((fs) => fs.faculty.user.name).join(", ")}
          </span>
        ) : (
          <span style={{ color: "var(--yellow-400)", fontSize: "0.78rem" }}>Unassigned</span>
        ),
    },
    {
      key: "_count.projects",
      label: "Projects",
      align: "center",
      width: 100,
      render: (s) => (
        <span className="flex items-center gap-1" style={{ justifyContent: "center" }}>
          <FolderKanban size={13} color="var(--slate-500)" />
          {s._count?.projects ?? 0}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      width: 100,
      render: (s) => (
        <StatusBadge
          tone={s.isActive ? "green" : "gray"}
          label={s.isActive ? "Active" : "Inactive"}
          size="sm"
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      width: 150,
      sortable: false,
      render: (s) => (
        <div className="flex gap-2" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn-icon-sm"
            title="Configure timeline & marking"
            onClick={() => setConfiguring(s)}
            style={{ color: "var(--purple-400)" }}
          >
            <ClipboardCheck size={15} />
          </button>
          <button
            type="button"
            className="btn-icon-sm"
            title="Edit"
            onClick={() => openEdit(s)}
            style={{ color: "var(--slate-300)" }}
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className="btn-icon-sm"
            title="Delete"
            onClick={() => setDeleting(s)}
            style={{ color: "var(--red-400)" }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="Subjects"
        subtitle="Project-based subjects, their faculty and their timeline configuration."
        crumbs={[{ label: "Admin", to: "/admin" }, { label: "Subjects" }]}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate} disabled={!years.length}>
            <Plus size={16} />
            Add Subject
          </button>
        }
      />

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name or code…" />
      </div>

      <DataTable
        columns={columns}
        rows={subjects}
        loading={loading}
        searchTerm={search}
        searchKeys={["name", "code"]}
        emptyIcon={BookOpen}
        emptyTitle="No subjects yet"
        emptyMessage="Add the project-based subjects that run this year — Capstone Project, Advanced Web Technology, Mini Project and so on."
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} />
            Add Subject
          </button>
        }
      />

      {/* ── Create / edit ─────────────────────────────────────────────────── */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit Subject" : "Add Subject"}
        subtitle="Project duration is configurable per subject — it is not fixed at 12 weeks."
        width={640}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="subject-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing?.id ? "Save Changes" : "Create Subject"}
            </button>
          </>
        }
      >
        <form id="subject-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Subject Name</label>
              <input
                className="form-input"
                required
                placeholder="e.g. Capstone Project"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Subject Code</label>
              <input
                className="form-input"
                required
                placeholder="e.g. 01CT0714"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Academic Year</label>
              <select
                className="form-input"
                required
                value={form.academicYearId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, academicYearId: e.target.value, semesterId: "" }))
                }
                disabled={Boolean(editing?.id)}
              >
                <option value="">Select…</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Semester</label>
              <select
                className="form-input"
                required
                value={form.semesterId}
                onChange={(e) => setForm((f) => ({ ...f, semesterId: e.target.value }))}
                disabled={Boolean(editing?.id) || !form.academicYearId}
              >
                <option value="">Select…</option>
                {semestersForYear.map((s) => (
                  <option key={s.id} value={s.id}>
                    Semester {s.number}
                  </option>
                ))}
              </select>
              {!editing?.id && form.academicYearId && !semestersForYear.length && (
                <span className="form-error">
                  This year has no semesters yet — create one first.
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Project Duration (weeks)</label>
              <input
                className="form-input"
                type="number"
                min={1}
                max={52}
                required
                value={form.durationWeeks}
                onChange={(e) => setForm((f) => ({ ...f, durationWeeks: Number(e.target.value) }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={form.isActive ? "true" : "false"}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === "true" }))}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label">Description</label>
              <textarea
                className="form-input"
                rows={2}
                placeholder="What kind of projects run under this subject?"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="form-group form-grid-full">
              <label className="form-label">
                Assigned Faculty
                <span style={{ color: "var(--slate-500)", fontWeight: 400, marginLeft: 6 }}>
                  — they will only see projects from their subjects
                </span>
              </label>

              {!faculty.length ? (
                <div style={{ fontSize: "0.8125rem", color: "var(--yellow-400)" }}>
                  No faculty accounts exist yet. Create them under Faculty first.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {faculty.map((f) => {
                    const selected = form.facultyIds.includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFaculty(f.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          padding: "7px 13px",
                          borderRadius: 99,
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          border: `1px solid ${selected ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.1)"}`,
                          background: selected ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.04)",
                          color: selected ? "var(--purple-300)" : "var(--slate-400)",
                          transition: "all 150ms",
                        }}
                      >
                        {selected && <X size={12} />}
                        {f.user?.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── Timeline & marking configuration ──────────────────────────────── */}
      {configuring && (
        <SubjectConfigModal
          subject={configuring}
          onClose={() => setConfiguring(null)}
        />
      )}

      <ConfirmationDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete "${deleting?.name}"?`}
        message={
          deleting?._count?.projects > 0
            ? `${deleting._count.projects} project(s) belong to this subject. Deleting it will fail while those projects exist — deactivate it instead.`
            : "This removes the subject, its milestone template and its marking scheme."
        }
        confirmLabel="Delete Subject"
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Per-subject configuration: the milestone template that seeds every project's
 * timeline (spec §35) and the marking scheme used at evaluation (spec §50).
 */
function SubjectConfigModal({ subject, onClose }) {
  const [tab, setTab] = useState("timeline");
  const [milestones, setMilestones] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      subjectApi.getMilestoneTemplates(subject.id),
      evaluationApi.getCriteria(subject.id),
    ]).then(([m, c]) => {
      if (!active) return;
      if (m.status === "fulfilled") {
        const rows = Array.isArray(m.value.data) ? m.value.data : m.value.data?.templates || [];
        setMilestones(rows);
      }
      if (c.status === "fulfilled") setCriteria(c.value.data?.criteria || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [subject.id]);

  const totalWeight = milestones.reduce((s, m) => s + Number(m.weight || 0), 0);
  const totalMarks = criteria.reduce((s, c) => s + Number(c.maxMarks || 0), 0);

  const seedTimeline = () => {
    // Scale the default 12-week plan to this subject's configured duration.
    const weeks = subject.durationWeeks || 12;
    const source = DEFAULT_MILESTONE_TEMPLATE;
    const scaled = Array.from({ length: weeks }, (_, i) => {
      const template = source[Math.min(i, source.length - 1)];
      return {
        weekNumber: i + 1,
        title: i < source.length ? template.title : `Week ${i + 1} Milestone`,
        description: "",
        weight: Number((100 / weeks).toFixed(1)),
        isRequired: true,
      };
    });
    setMilestones(scaled);
    toast.success(`Seeded a ${weeks}-week timeline. Adjust the weights, then save.`);
  };

  const seedCriteria = () => {
    setCriteria(DEFAULT_EVALUATION_CRITERIA.map((c) => ({ ...c, description: "" })));
    toast.success("Loaded the default 100-mark scheme.");
  };

  const updateMilestone = (index, patch) =>
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));

  const updateCriterion = (index, patch) =>
    setCriteria((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const save = async () => {
    setSaving(true);
    try {
      if (tab === "timeline") {
        await subjectApi.upsertMilestoneTemplates(subject.id, { templates: milestones });
        toast.success("Milestone template saved.");
      } else {
        await evaluationApi.upsertCriteria(subject.id, criteria);
        toast.success("Marking scheme saved.");
      }
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Configure ${subject.name}`}
      subtitle={`${subject.code} · ${subject.durationWeeks}-week project`}
      width={760}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || loading}>
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "timeline", label: "Milestone Template", icon: ClipboardCheck },
          { key: "marking", label: "Marking Scheme", icon: Trophy },
        ]}
      />

      {loading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto" }} />
        </div>
      ) : tab === "timeline" ? (
        <>
          <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)", maxWidth: 400 }}>
              These milestones seed the timeline of every new project in this subject. Weights
              determine the weighted progress percentage.
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={seedTimeline}>
              <Sparkles size={14} />
              Load default plan
            </button>
          </div>

          {!milestones.length ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--slate-500)", fontSize: "0.875rem" }}>
              No milestone template yet. Load the default plan to get started.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
                {milestones.map((m, i) => (
                  <div
                    key={m.id || i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "52px 1fr 92px 40px",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        color: "var(--purple-400)",
                        textAlign: "center",
                      }}
                    >
                      W{m.weekNumber}
                    </span>
                    <input
                      className="form-input"
                      value={m.title}
                      onChange={(e) => updateMilestone(i, { title: e.target.value })}
                      placeholder="Milestone title"
                    />
                    <input
                      className="form-input"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={m.weight}
                      onChange={(e) => updateMilestone(i, { weight: Number(e.target.value) })}
                      title="Weight (%)"
                    />
                    <button
                      type="button"
                      className="btn-icon-sm"
                      onClick={() => setMilestones((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ color: "var(--red-400)" }}
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div
                className="flex items-center justify-between"
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                  fontSize: "0.8125rem",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setMilestones((prev) => [
                      ...prev,
                      { weekNumber: prev.length + 1, title: "", weight: 0, isRequired: true },
                    ])
                  }
                >
                  <Plus size={14} />
                  Add week
                </button>

                <span
                  style={{
                    fontWeight: 700,
                    color:
                      Math.abs(totalWeight - 100) < 0.5 ? "var(--green-400)" : "var(--yellow-400)",
                  }}
                >
                  Total weight: {totalWeight.toFixed(1)}%
                  {Math.abs(totalWeight - 100) >= 0.5 && " — should add up to 100%"}
                </span>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)", maxWidth: 400 }}>
              Criteria used when the final evaluation is recorded for projects in this subject.
            </p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={seedCriteria}>
              <Sparkles size={14} />
              Load default scheme
            </button>
          </div>

          {!criteria.length ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--slate-500)", fontSize: "0.875rem" }}>
              No marking scheme yet. Load the default 100-mark scheme to get started.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
                {criteria.map((c, i) => (
                  <div
                    key={c.id || i}
                    style={{ display: "grid", gridTemplateColumns: "1fr 92px 40px", gap: 10 }}
                  >
                    <input
                      className="form-input"
                      value={c.name}
                      onChange={(e) => updateCriterion(i, { name: e.target.value })}
                      placeholder="Criterion name"
                    />
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      value={c.maxMarks}
                      onChange={(e) => updateCriterion(i, { maxMarks: Number(e.target.value) })}
                      title="Max marks"
                    />
                    <button
                      type="button"
                      className="btn-icon-sm"
                      onClick={() => setCriteria((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ color: "var(--red-400)" }}
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div
                className="flex items-center justify-between"
                style={{
                  marginTop: 14,
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                  fontSize: "0.8125rem",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCriteria((prev) => [...prev, { name: "", maxMarks: 10 }])}
                >
                  <Plus size={14} />
                  Add criterion
                </button>
                <span style={{ fontWeight: 700, color: "var(--purple-400)" }}>
                  Total: {totalMarks} marks
                </span>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
