import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  GraduationCap, Plus, Pencil, Trash2, KeyRound, Download, Upload, List,
  Mail, Phone, FolderKanban, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { studentApi, academicApi } from "../../services/index.js";
import { useApi, useApiAll } from "../../hooks/useApi.js";
import { apiErrorMessage, initials, formatPercent } from "../../utils/format.js";
import {
  PageHeader, DataTable, Modal, ConfirmationDialog, SearchBar, StatusBadge,
  FilterPanel, Tabs, ProgressBar,
} from "../../components/ui/index.js";
import BulkImportWizard from "../../features/students/BulkImportWizard.jsx";

const emptyForm = {
  name: "",
  enrollmentNumber: "",
  grNumber: "",
  email: "",
  mobile: "",
  academicYearId: "",
  semesterId: "",
};

export default function Students() {
  const [tab, setTab] = useState("roster");

  return (
    <>
      <PageHeader
        icon={GraduationCap}
        title="Students"
        subtitle="Manage the student roster manually or import a whole cohort from Excel."
        crumbs={[{ label: "Admin", to: "/admin" }, { label: "Students" }]}
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "roster", label: "Student Roster", icon: List },
          { key: "import", label: "Bulk Import", icon: Upload },
        ]}
      />

      {tab === "roster" ? <Roster /> : <BulkImportWizard onImported={() => setTab("roster")} />}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function Roster() {
  const { data: meta } = useApiAll(
    {
      years: () => academicApi.getYears(),
      semesters: () => academicApi.getSemesters(),
    },
    []
  );

  const years = meta.years || [];
  const semesters = meta.semesters || [];

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ academicYearId: "", semesterId: "", isActive: "" });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const params = useMemo(
    () => ({
      page,
      limit,
      ...(search && { search }),
      ...(filters.academicYearId && { academicYearId: filters.academicYearId }),
      ...(filters.semesterId && { semesterId: filters.semesterId }),
      ...(filters.isActive && { isActive: filters.isActive }),
    }),
    [page, limit, search, filters]
  );

  const { data, loading, refetch } = useApi(() => studentApi.list(params), [params], {
    initialData: { students: [], total: 0, totalPages: 1 },
  });

  const students = data?.students || [];

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Reset to page 1 whenever the query narrows.
  useEffect(() => {
    setPage(1);
  }, [search, filters]);

  const semestersForYear = semesters.filter(
    (s) => !form.academicYearId || s.academicYearId === form.academicYearId
  );

  const openCreate = () => {
    const activeYear = years.find((y) => y.isActive) || years[0];
    setForm({ ...emptyForm, academicYearId: activeYear?.id || "" });
    setEditing({});
  };

  const openEdit = (student) => {
    setForm({
      name: student.name,
      enrollmentNumber: student.enrollmentNumber,
      grNumber: student.grNumber || "",
      email: student.email,
      mobile: student.mobile,
      academicYearId: student.academicYearId,
      semesterId: student.semesterId,
    });
    setEditing(student);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) {
        await studentApi.update(editing.id, form);
        toast.success("Student updated.");
      } else {
        await studentApi.create(form);
        toast.success("Student created — they'll receive an activation link.");
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
      await studentApi.delete(deleting.id);
      toast.success("Student deleted.");
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const submitReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    try {
      await studentApi.resetPassword(resetting.id, { password: newPassword });
      toast.success(`Password reset for ${resetting.name}.`);
      setResetting(null);
      setNewPassword("");
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const exportRoster = async (format) => {
    setExporting(true);
    try {
      await studentApi.download({ ...params, page: undefined, limit: undefined, format });
      toast.success("Export downloaded.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Student",
      render: (s) => (
        <div className="flex items-center gap-3">
          {s.profilePhoto ? (
            <img src={s.profilePhoto} alt="" className="avatar" width={34} height={34} />
          ) : (
            <span className="avatar-placeholder" style={{ width: 34, height: 34, fontSize: "0.72rem" }}>
              {initials(s.name)}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "var(--white)" }}>{s.name}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--purple-400)" }}>
              {s.enrollmentNumber}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: "Contact",
      sortable: false,
      hideOnMobile: true,
      render: (s) => (
        <div style={{ fontSize: "0.78rem" }}>
          <div className="flex items-center gap-1 truncate" style={{ color: "var(--slate-300)" }}>
            <Mail size={12} color="var(--slate-500)" />
            {s.email}
          </div>
          <div className="flex items-center gap-1" style={{ color: "var(--slate-500)", marginTop: 2 }}>
            <Phone size={12} />
            {s.mobile}
          </div>
        </div>
      ),
    },
    {
      key: "semester.number",
      label: "Sem",
      width: 80,
      align: "center",
      hideOnMobile: true,
      render: (s) => s.semester?.number ?? "—",
    },
    {
      key: "projects",
      label: "Projects & Progress",
      sortable: false,
      width: 190,
      render: (s) => {
        const projects = s.projectMembers?.map((pm) => pm.project) || [];
        const avg = projects.length
          ? projects.reduce((sum, p) => sum + (p.progress || 0), 0) / projects.length
          : 0;
        return (
          <div>
            <div
              className="flex items-center justify-between"
              style={{ fontSize: "0.72rem", marginBottom: 4 }}
            >
              <span className="flex items-center gap-1" style={{ color: "var(--slate-400)" }}>
                <FolderKanban size={12} />
                {projects.length}
              </span>
              <span style={{ color: "var(--white)", fontWeight: 600 }}>{formatPercent(avg)}</span>
            </div>
            <ProgressBar value={avg} height={5} />
          </div>
        );
      },
    },
    {
      key: "isActivated",
      label: "Account",
      width: 120,
      render: (s) =>
        s.isActivated ? (
          <StatusBadge tone="green" label="Activated" size="sm" icon={ShieldCheck} />
        ) : (
          <StatusBadge tone="yellow" label="Pending" size="sm" icon={ShieldAlert} />
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
            title="Reset password"
            onClick={() => setResetting(s)}
            style={{ color: "var(--yellow-400)" }}
          >
            <KeyRound size={15} />
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
      <div className="toolbar">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search name, email or enrollment…"
        />

        <FilterPanel
          value={filters}
          onChange={setFilters}
          onReset={() => setFilters({ academicYearId: "", semesterId: "", isActive: "" })}
          filters={[
            {
              key: "academicYearId",
              label: "Academic Year",
              options: years.map((y) => ({ value: y.id, label: y.label })),
            },
            {
              key: "semesterId",
              label: "Semester",
              options: semesters
                .filter((s) => !filters.academicYearId || s.academicYearId === filters.academicYearId)
                .map((s) => ({ value: s.id, label: `Semester ${s.number}` })),
            },
            {
              key: "isActive",
              label: "Status",
              options: [
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ],
            },
          ]}
        />

        <div className="toolbar-spacer" />

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => exportRoster("xlsx")}
          disabled={exporting}
        >
          <Download size={15} />
          Export Excel
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => exportRoster("csv")}
          disabled={exporting}
        >
          <Download size={15} />
          CSV
        </button>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          Add Student
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={students}
        loading={loading}
        emptyIcon={GraduationCap}
        emptyTitle="No students found"
        emptyMessage={
          search || Object.values(filters).some(Boolean)
            ? "No students match your search and filters."
            : "Import a cohort from Excel, or add students one at a time."
        }
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} />
            Add Student
          </button>
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

      {/* Create / edit */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit Student" : "Add Student"}
        subtitle={
          editing?.id
            ? undefined
            : "No password here — the student receives a single-use activation link."
        }
        width={620}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="student-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing?.id ? "Save Changes" : "Create Student"}
            </button>
          </>
        }
      >
        <form id="student-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                required
                placeholder="Bhargav Limbani"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Enrollment Number</label>
              <input
                className="form-input"
                required
                disabled={Boolean(editing?.id)}
                placeholder="92301733029"
                value={form.enrollmentNumber}
                onChange={(e) => setForm((f) => ({ ...f, enrollmentNumber: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                required
                placeholder="bhargav.limbani121771@marwadiuniversity.ac.in"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mobile</label>
              <input
                className="form-input"
                required
                placeholder="6355990290"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">GR Number (optional)</label>
              <input
                className="form-input"
                placeholder="121771"
                value={form.grNumber}
                onChange={(e) => setForm((f) => ({ ...f, grNumber: e.target.value }))}
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
                disabled={!form.academicYearId}
              >
                <option value="">Select…</option>
                {semestersForYear.map((s) => (
                  <option key={s.id} value={s.id}>
                    Semester {s.number}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* Reset password */}
      <Modal
        open={Boolean(resetting)}
        onClose={() => {
          setResetting(null);
          setNewPassword("");
        }}
        title="Reset Password"
        subtitle={resetting ? `for ${resetting.name} (${resetting.enrollmentNumber})` : undefined}
        width={430}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setResetting(null);
                setNewPassword("");
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="student-reset-form"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Resetting…" : "Reset Password"}
            </button>
          </>
        }
      >
        <form id="student-reset-form" onSubmit={submitReset}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              className="form-input"
              type="text"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <span style={{ fontSize: "0.72rem", color: "var(--slate-500)" }}>
              This also marks the account as activated.
            </span>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleting?.name}?`}
        message="This permanently removes the student and their project memberships. If they have submitted work, deactivate the account instead."
        confirmLabel="Delete Student"
        confirmPhrase={deleting?.enrollmentNumber}
      />
    </>
  );
}
