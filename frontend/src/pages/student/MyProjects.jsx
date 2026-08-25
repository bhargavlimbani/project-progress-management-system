import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FolderKanban, Plus, Lightbulb, Loader2, BookOpen } from "lucide-react";
import { projectApi, subjectApi, domainApi, academicApi } from "../../services/index.js";
import { useApi, useApiAll } from "../../hooks/useApi.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiErrorMessage } from "../../utils/format.js";
import {
  PageHeader, EmptyState, Modal, SkeletonCard, SearchBar,
} from "../../components/ui/index.js";
import ProjectCard from "../../components/project/ProjectCard.jsx";

const emptyIdea = {
  subjectId: "",
  title: "",
  abstract: "",
  problemStatement: "",
  objectives: "",
  scope: "",
  technologies: "",
  expectedOutcome: "",
  domainId: "",
  teamMembers: "",
};

/**
 * A student's projects across every subject (spec §27). Creating a project
 * and submitting its idea happen in one flow — the project is created, then
 * the idea attached, so the approval workflow starts immediately.
 */
export default function MyProjects() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: projects, loading, refetch } = useApi(() => projectApi.myProjects(), [], {
    initialData: [],
  });

  const { data: meta } = useApiAll(
    {
      subjects: () => subjectApi.list({ isActive: "true" }),
      domains: () => domainApi.list(),
      years: () => academicApi.getYears(),
    },
    []
  );

  const rows = useMemo(() => {
    const list = Array.isArray(projects) ? projects : projects?.projects || [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((p) =>
      [p.title, p.subject?.name, p.domain?.name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [projects, search]);

  // A student shouldn't start two projects in the same subject.
  const usedSubjectIds = new Set(
    (Array.isArray(projects) ? projects : projects?.projects || []).map((p) => p.subjectId)
  );

  const availableSubjects = (meta.subjects || []).filter((s) => !usedSubjectIds.has(s.id));

  return (
    <>
      <PageHeader
        icon={FolderKanban}
        title="My Projects"
        subtitle="Every project you're working on this semester, across all your subjects."
        crumbs={[{ label: "Student", to: "/student" }, { label: "My Projects" }]}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreating(true)}
            disabled={!availableSubjects.length}
            title={
              !availableSubjects.length
                ? "You already have a project in every available subject"
                : undefined
            }
          >
            <Plus size={16} />
            Start a Project
          </button>
        }
      />

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search your projects…" />
      </div>

      {loading ? (
        <div className="card-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} height={330} />
          ))}
        </div>
      ) : !rows.length ? (
        <div className="glass-card">
          <EmptyState
            icon={FolderKanban}
            title={search ? "No projects match your search" : "You haven't started a project yet"}
            message={
              search
                ? "Try a different search term."
                : "Pick a subject and submit your project idea. Your faculty reviews it, then a mentor is assigned automatically."
            }
            action={
              !search &&
              availableSubjects.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setCreating(true)}
                >
                  <Plus size={14} />
                  Start your first project
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="card-grid">
          {rows.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              basePath="/student/projects"
              index={i}
            />
          ))}
        </div>
      )}

      {creating && (
        <NewProjectModal
          subjects={availableSubjects}
          domains={meta.domains || []}
          years={meta.years || []}
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            refetch();
          }}
        />
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function NewProjectModal({ subjects, domains, years, onClose, onDone }) {
  const [form, setForm] = useState(emptyIdea);
  const [saving, setSaving] = useState(false);

  const activeYear = years.find((y) => y.isActive) || years[0];
  const selectedSubject = subjects.find((s) => s.id === form.subjectId);

  const submit = async (e) => {
    e.preventDefault();

    if (!activeYear) {
      toast.error("No academic year is active — ask your admin to activate one.");
      return;
    }

    setSaving(true);
    try {
      // Create the project shell, then attach the idea so faculty review starts.
      const { data: project } = await projectApi.create({
        title: form.title,
        subjectId: form.subjectId,
        academicYearId: activeYear.id,
      });

      await projectApi.submitIdea(project.id, {
        title: form.title,
        abstract: form.abstract,
        problemStatement: form.problemStatement,
        objectives: form.objectives,
        scope: form.scope,
        technologies: form.technologies,
        expectedOutcome: form.expectedOutcome,
        domainId: form.domainId,
        teamMembers: form.teamMembers || undefined,
      });

      toast.success("Idea submitted — your faculty has been notified.");
      onDone();
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
      title="Start a Project"
      subtitle="Your idea goes straight to faculty review. Be specific — vague problem statements get sent back."
      width={720}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="new-project-form" className="btn btn-primary" disabled={saving}>
            {saving ? <Loader2 size={15} className="spin" /> : <Lightbulb size={15} />}
            {saving ? "Submitting…" : "Submit Idea"}
          </button>
        </>
      }
    >
      <form id="new-project-form" onSubmit={submit}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Subject</label>
            <select
              className="form-input"
              required
              value={form.subjectId}
              onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value }))}
            >
              <option value="">Select a subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            {selectedSubject && (
              <span
                className="flex items-center gap-1"
                style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}
              >
                <BookOpen size={11} />
                {selectedSubject.durationWeeks}-week project
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Domain</label>
            <select
              className="form-input"
              required
              value={form.domainId}
              onChange={(e) => setForm((f) => ({ ...f, domainId: e.target.value }))}
            >
              <option value="">Select a domain…</option>
              {domains
                .filter((d) => d.isActive)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
            <span style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>
              This decides which mentor is recommended.
            </span>
          </div>

          <div className="form-group form-grid-full">
            <label className="form-label">Project Title</label>
            <input
              className="form-input"
              required
              minLength={5}
              placeholder="e.g. AI Resume Analyzer for Campus Placements"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="form-group form-grid-full">
            <label className="form-label">Abstract</label>
            <textarea
              className="form-input"
              rows={3}
              required
              minLength={50}
              placeholder="A short summary of what you're building and why it matters."
              value={form.abstract}
              onChange={(e) => setForm((f) => ({ ...f, abstract: e.target.value }))}
            />
            <CharCount value={form.abstract} min={50} />
          </div>

          <div className="form-group form-grid-full">
            <label className="form-label">Problem Statement</label>
            <textarea
              className="form-input"
              rows={3}
              required
              minLength={50}
              placeholder="Who has this problem, and what specifically goes wrong for them today?"
              value={form.problemStatement}
              onChange={(e) => setForm((f) => ({ ...f, problemStatement: e.target.value }))}
            />
            <CharCount value={form.problemStatement} min={50} />
          </div>

          <div className="form-group">
            <label className="form-label">Objectives</label>
            <textarea
              className="form-input"
              rows={3}
              required
              placeholder="One objective per line."
              value={form.objectives}
              onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Scope</label>
            <textarea
              className="form-input"
              rows={3}
              required
              placeholder="What's in scope — and what you're deliberately leaving out."
              value={form.scope}
              onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Technologies</label>
            <textarea
              className="form-input"
              rows={2}
              required
              placeholder="React, Node.js, PostgreSQL, Python…"
              value={form.technologies}
              onChange={(e) => setForm((f) => ({ ...f, technologies: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Expected Outcome</label>
            <textarea
              className="form-input"
              rows={2}
              required
              placeholder="What will exist at the end of the semester?"
              value={form.expectedOutcome}
              onChange={(e) => setForm((f) => ({ ...f, expectedOutcome: e.target.value }))}
            />
          </div>

          <div className="form-group form-grid-full">
            <label className="form-label">Team Members (optional)</label>
            <input
              className="form-input"
              placeholder="Enrollment numbers of teammates, comma-separated"
              value={form.teamMembers}
              onChange={(e) => setForm((f) => ({ ...f, teamMembers: e.target.value }))}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}

function CharCount({ value, min }) {
  const length = value.trim().length;
  const ok = length >= min;
  return (
    <span
      style={{
        fontSize: "0.68rem",
        color: ok ? "var(--green-400)" : "var(--slate-500)",
        textAlign: "right",
      }}
    >
      {length} / {min} characters minimum
    </span>
  );
}
