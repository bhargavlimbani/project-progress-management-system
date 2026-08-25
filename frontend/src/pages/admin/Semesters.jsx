import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Layers3, Plus, Trash2, GraduationCap, BookOpen, CalendarRange } from "lucide-react";
import { academicApi } from "../../services/index.js";
import { useApi, useApiAll } from "../../hooks/useApi.js";
import { apiErrorMessage } from "../../utils/format.js";
import {
  PageHeader, Modal, ConfirmationDialog, EmptyState, SkeletonCard, StatusBadge,
} from "../../components/ui/index.js";

const ALL_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

export default function Semesters() {
  const { data, loading, refetch } = useApiAll(
    {
      years: () => academicApi.getYears(),
      semesters: () => academicApi.getSemesters(),
    },
    []
  );

  const years = data.years || [];
  const semesters = data.semesters || [];

  const activeYear = years.find((y) => y.isActive);
  const [selectedYearId, setSelectedYearId] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ number: "", academicYearId: "" });

  // Default the filter to the active year once data arrives.
  const yearFilter = selectedYearId || activeYear?.id || years[0]?.id || "";

  const visible = useMemo(
    () => semesters.filter((s) => !yearFilter || s.academicYearId === yearFilter),
    [semesters, yearFilter]
  );

  const takenNumbers = new Set(visible.map((s) => s.number));
  const availableNumbers = ALL_SEMESTERS.filter((n) => !takenNumbers.has(n));

  const openCreate = () => {
    setForm({ number: availableNumbers[0] || "", academicYearId: yearFilter });
    setCreating(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.number || !form.academicYearId) {
      toast.error("Pick an academic year and a semester number.");
      return;
    }
    setSaving(true);
    try {
      await academicApi.createSemester({
        number: Number(form.number),
        academicYearId: form.academicYearId,
      });
      toast.success(`Semester ${form.number} created.`);
      setCreating(false);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    try {
      await academicApi.deleteSemester(deleting.id);
      toast.success("Semester deleted.");
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        icon={Layers3}
        title="Semesters"
        subtitle="Semesters group the subjects and students of an academic year."
        crumbs={[{ label: "Admin", to: "/admin" }, { label: "Semesters" }]}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
            disabled={!years.length || availableNumbers.length === 0}
            title={
              availableNumbers.length === 0
                ? "All eight semesters already exist for this year"
                : undefined
            }
          >
            <Plus size={16} />
            Add Semester
          </button>
        }
      />

      {/* Year filter */}
      {years.length > 0 && (
        <div className="toolbar">
          <div className="form-group" style={{ minWidth: 240 }}>
            <label className="form-label">Academic Year</label>
            <select
              className="form-input"
              value={yearFilter}
              onChange={(e) => setSelectedYearId(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                  {y.isActive ? "  (active)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card-grid-sm">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !years.length ? (
        <div className="glass-card">
          <EmptyState
            icon={CalendarRange}
            title="Create an academic year first"
            message="Semesters belong to an academic year. Add 2026-2027 (or similar) before creating semesters."
            action={
              <a href="/admin/academic-years" className="btn btn-primary btn-sm">
                Go to Academic Years
              </a>
            }
          />
        </div>
      ) : !visible.length ? (
        <div className="glass-card">
          <EmptyState
            icon={Layers3}
            title="No semesters in this year"
            message="Add the semesters that will run this academic year — typically 7 and 8 for capstone projects."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
                <Plus size={14} />
                Add Semester
              </button>
            }
          />
        </div>
      ) : (
        <div className="card-grid-sm">
          {visible
            .sort((a, b) => a.number - b.number)
            .map((semester) => (
              <div key={semester.id} className="glass-card glass-card-hover" style={{ padding: 20 }}>
                <div className="flex items-start justify-between mb-4">
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      background: "var(--gradient-glow)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.15rem",
                      fontWeight: 800,
                      color: "#fff",
                      boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
                    }}
                  >
                    {semester.number}
                  </div>

                  <button
                    type="button"
                    className="btn-icon-sm"
                    title="Delete semester"
                    onClick={() => setDeleting(semester)}
                    style={{ color: "var(--red-400)" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 2 }}>
                  Semester {semester.number}
                </h3>
                <div style={{ fontSize: "0.75rem", color: "var(--slate-500)", marginBottom: 14 }}>
                  {semester.academicYear?.label}
                </div>

                <div className="stat-row">
                  <span className="stat-row-label flex items-center gap-2">
                    <GraduationCap size={13} />
                    Students
                  </span>
                  <span className="stat-row-value">{semester._count?.students ?? 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row-label flex items-center gap-2">
                    <BookOpen size={13} />
                    Subjects
                  </span>
                  <span className="stat-row-value">{semester._count?.subjects ?? 0}</span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Create */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add Semester"
        subtitle="Each semester number can appear once per academic year."
        width={440}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button type="submit" form="semester-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Creating…" : "Create Semester"}
            </button>
          </>
        }
      >
        <form id="semester-form" onSubmit={submit}>
          <div className="form-group mb-4">
            <label className="form-label">Academic Year</label>
            <select
              className="form-input"
              value={form.academicYearId}
              onChange={(e) => setForm((f) => ({ ...f, academicYearId: e.target.value }))}
              required
            >
              <option value="">Select a year…</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Semester Number</label>
            <select
              className="form-input"
              value={form.number}
              onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
              required
            >
              <option value="">Select…</option>
              {ALL_SEMESTERS.map((n) => (
                <option key={n} value={n} disabled={form.academicYearId === yearFilter && takenNumbers.has(n)}>
                  Semester {n}
                  {form.academicYearId === yearFilter && takenNumbers.has(n) ? " — already exists" : ""}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete Semester ${deleting?.number}?`}
        message={
          (deleting?._count?.students ?? 0) > 0 || (deleting?._count?.subjects ?? 0) > 0
            ? `This semester still has ${deleting?._count?.students ?? 0} student(s) and ${
                deleting?._count?.subjects ?? 0
              } subject(s). Deleting it will fail while those records exist.`
            : "This cannot be undone."
        }
        confirmLabel="Delete Semester"
      />
    </>
  );
}
