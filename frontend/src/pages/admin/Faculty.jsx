import { useState } from "react";
import toast from "react-hot-toast";
import {
  Users, Plus, Pencil, Trash2, KeyRound, FolderKanban, Mail, Phone, BookOpen, X,
  UserCheck, Briefcase,
} from "lucide-react";
import { facultyApi, subjectApi, userApi } from "../../services/index.js";
import { useApiAll } from "../../hooks/useApi.js";
import { apiErrorMessage, initials } from "../../utils/format.js";
import {
  PageHeader, DataTable, Modal, ConfirmationDialog, SearchBar, StatusBadge,
} from "../../components/ui/index.js";

const emptyForm = {
  name: "",
  email: "",
  facultyId: "",
  designation: "",
  mobile: "",
  password: "",
  subjectIds: [],
};

export default function Faculty() {
  const { data, loading, refetch } = useApiAll(
    {
      faculty: () => facultyApi.list(),
      subjects: () => subjectApi.list(),
    },
    []
  );

  const faculty = data.faculty || [];
  const subjects = data.subjects || [];

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [promoting, setPromoting] = useState(null); // faculty being promoted to mentor
  const [promoteForm, setPromoteForm] = useState({ mentorId: "", expertise: "" });
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing({});
  };

  const openEdit = (member) => {
    setForm({
      name: member.user.name,
      email: member.user.email,
      facultyId: member.facultyId,
      designation: member.designation,
      mobile: member.mobile || "",
      password: "",
      subjectIds: member.subjects?.map((s) => s.subjectId) || [],
    });
    setEditing(member);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) {
        // Password is only set here on creation; changing it uses Reset Password.
        const { password, email, ...rest } = form;
        await facultyApi.update(editing.id, rest);
        toast.success("Faculty updated.");
      } else {
        await facultyApi.create(form);
        toast.success("Faculty account created.");
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
      await facultyApi.delete(deleting.id);
      toast.success("Faculty deleted.");
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
      await facultyApi.resetPassword(resetting.id, { password: newPassword });
      toast.success(`Password reset for ${resetting.user.name}.`);
      setResetting(null);
      setNewPassword("");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (member) => {
    try {
      await userApi.setActive(member.user.id, !member.user.isActive);
      toast.success(member.user.isActive ? "Account deactivated." : "Account activated.");
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const openPromote = (member) => {
    setPromoteForm({ mentorId: "", expertise: "" });
    setPromoting(member);
  };

  const submitPromote = async (e) => {
    e.preventDefault();
    if (!promoteForm.mentorId.trim()) {
      toast.error("Mentor ID is required.");
      return;
    }
    setSaving(true);
    try {
      await facultyApi.promoteToMentor(promoting.id, {
        mentorId: promoteForm.mentorId.trim(),
        expertise: promoteForm.expertise.trim() || undefined,
      });
      toast.success(`${promoting.user.name} promoted to Mentor successfully!`);
      setPromoting(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleSubject = (subjectId) =>
    setForm((f) => ({
      ...f,
      subjectIds: f.subjectIds.includes(subjectId)
        ? f.subjectIds.filter((id) => id !== subjectId)
        : [...f.subjectIds, subjectId],
    }));

  const columns = [
    {
      key: "user.name",
      label: "Faculty",
      render: (f) => (
        <div className="flex items-center gap-3">
          {f.user.profilePhoto ? (
            <img src={f.user.profilePhoto} alt="" className="avatar" width={34} height={34} />
          ) : (
            <span className="avatar-placeholder" style={{ width: 34, height: 34, fontSize: "0.72rem" }}>
              {initials(f.user.name)}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "var(--white)" }}>{f.user.name}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--purple-400)" }}>{f.facultyId}</div>
          </div>
        </div>
      ),
    },
    {
      key: "designation",
      label: "Designation",
      hideOnMobile: true,
      width: 180,
    },
    {
      key: "user.email",
      label: "Contact",
      sortable: false,
      render: (f) => (
        <div style={{ fontSize: "0.78rem" }}>
          <div className="flex items-center gap-1 truncate" style={{ color: "var(--slate-300)" }}>
            <Mail size={12} color="var(--slate-500)" />
            {f.user.email}
          </div>
          {f.mobile && (
            <div className="flex items-center gap-1" style={{ color: "var(--slate-500)", marginTop: 2 }}>
              <Phone size={12} />
              {f.mobile}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "subjects",
      label: "Subjects",
      sortable: false,
      hideOnMobile: true,
      render: (f) =>
        f.subjects?.length ? (
          <span style={{ fontSize: "0.78rem" }}>
            {f.subjects.map((s) => s.subject.code).join(", ")}
          </span>
        ) : (
          <span style={{ color: "var(--yellow-400)", fontSize: "0.75rem" }}>None assigned</span>
        ),
    },
    {
      key: "_count.projects",
      label: "Projects",
      align: "center",
      width: 95,
      render: (f) => (
        <span className="flex items-center gap-1" style={{ justifyContent: "center" }}>
          <FolderKanban size={13} color="var(--slate-500)" />
          {f._count?.projects ?? 0}
        </span>
      ),
    },
    {
      key: "user.isActive",
      label: "Status",
      width: 100,
      render: (f) => (
        <button type="button" onClick={() => toggleActive(f)} title="Toggle account status">
          <StatusBadge
            tone={f.user.isActive ? "green" : "gray"}
            label={f.user.isActive ? "Active" : "Inactive"}
            size="sm"
          />
        </button>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      width: 190,
      sortable: false,
      render: (f) => {
        const alreadyMentor = f.user?.role === "MENTOR";
        return (
          <div className="flex gap-2" style={{ justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn-icon-sm"
              title={alreadyMentor ? "Already a Mentor" : "Add as Mentor"}
              onClick={() => !alreadyMentor && openPromote(f)}
              style={{
                color: alreadyMentor ? "var(--green-400)" : "var(--blue-400)",
                cursor: alreadyMentor ? "default" : "pointer",
                opacity: alreadyMentor ? 0.7 : 1,
              }}
            >
              <UserCheck size={15} />
            </button>
            <button
              type="button"
              className="btn-icon-sm"
              title="Reset password"
              onClick={() => setResetting(f)}
              style={{ color: "var(--yellow-400)" }}
            >
              <KeyRound size={15} />
            </button>
            <button
              type="button"
              className="btn-icon-sm"
              title="Edit"
              onClick={() => openEdit(f)}
              style={{ color: "var(--slate-300)" }}
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              className="btn-icon-sm"
              title="Delete"
              onClick={() => setDeleting(f)}
              style={{ color: "var(--red-400)" }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        icon={Users}
        title="Faculty"
        subtitle="Faculty accounts and the subjects each of them supervises."
        crumbs={[{ label: "Admin", to: "/admin" }, { label: "Faculty" }]}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Add Faculty
          </button>
        }
      />

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name, ID or email…" />
      </div>

      <DataTable
        columns={columns}
        rows={faculty}
        loading={loading}
        searchTerm={search}
        searchKeys={["user.name", "user.email", "facultyId", "designation"]}
        emptyIcon={Users}
        emptyTitle="No faculty yet"
        emptyMessage="Create faculty accounts and assign them subjects — they'll then see only the projects from those subjects."
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} />
            Add Faculty
          </button>
        }
      />

      {/* Create / edit */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit Faculty" : "Add Faculty"}
        subtitle={
          editing?.id
            ? "Email can't be changed here — use Reset Password for credentials."
            : "The faculty member signs in with this email and password."
        }
        width={620}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="faculty-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing?.id ? "Save Changes" : "Create Account"}
            </button>
          </>
        }
      >
        <form id="faculty-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                required
                placeholder="Faculty name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Faculty ID</label>
              <input
                className="form-input"
                required
                placeholder="FAC001"
                value={form.facultyId}
                onChange={(e) => setForm((f) => ({ ...f, facultyId: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                required
                disabled={Boolean(editing?.id)}
                placeholder="faculty@marwadiuniversity.edu.in"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mobile</label>
              <input
                className="form-input"
                placeholder="9876543210"
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Designation</label>
              <input
                className="form-input"
                required
                placeholder="Associate Professor"
                value={form.designation}
                onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              />
            </div>

            {!editing?.id && (
              <div className="form-group">
                <label className="form-label">Temporary Password</label>
                <input
                  className="form-input"
                  type="text"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
                <span style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>
                  Share this once — they can change it after signing in.
                </span>
              </div>
            )}

            <div className="form-group form-grid-full">
              <label className="form-label">
                Assigned Subjects
                <span style={{ color: "var(--slate-500)", fontWeight: 400, marginLeft: 6 }}>
                  — scopes everything this faculty member can see
                </span>
              </label>

              {!subjects.length ? (
                <div style={{ fontSize: "0.8125rem", color: "var(--yellow-400)" }}>
                  No subjects exist yet. Create subjects first, then assign them here.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {subjects.map((s) => {
                    const selected = form.subjectIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSubject(s.id)}
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
                        }}
                      >
                        {selected ? <X size={12} /> : <BookOpen size={12} />}
                        {s.code}
                      </button>
                    );
                  })}
                </div>
              )}
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
        subtitle={resetting ? `for ${resetting.user.name}` : undefined}
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
            <button type="submit" form="reset-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Resetting…" : "Reset Password"}
            </button>
          </>
        }
      >
        <form id="reset-form" onSubmit={submitReset}>
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
              Share it over a private channel and ask them to change it after signing in.
            </span>
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleting?.user?.name}?`}
        message={
          deleting?._count?.projects > 0
            ? `This faculty member supervises ${deleting._count.projects} project(s). Deleting will fail while those projects exist — deactivate the account instead.`
            : "This permanently removes the faculty account and its subject assignments."
        }
        confirmLabel="Delete Faculty"
        confirmPhrase={deleting?.facultyId}
      />

      {/* Promote to Mentor */}
      <Modal
        open={Boolean(promoting)}
        onClose={() => setPromoting(null)}
        title="Add as Mentor"
        subtitle={
          promoting
            ? `${promoting.user.name} will be promoted from Faculty to Mentor. They'll log in with the same email and password but with mentor access.`
            : undefined
        }
        width={480}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPromoting(null)}>
              Cancel
            </button>
            <button type="submit" form="promote-form" className="btn btn-primary" disabled={saving}>
              <UserCheck size={15} />
              {saving ? "Promoting…" : "Confirm Promotion"}
            </button>
          </>
        }
      >
        {/* Info banner */}
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "12px 14px",
            marginBottom: 20,
            borderRadius: 10,
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.2)",
            fontSize: "0.8rem",
            color: "var(--blue-300)",
            lineHeight: 1.55,
          }}
        >
          <Briefcase size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            This action changes the account role to <strong>MENTOR</strong>. The faculty record stays
            intact — the person just gains mentor-level access and will appear in the Mentors list.
          </span>
        </div>

        <form id="promote-form" onSubmit={submitPromote}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Mentor ID <span style={{ color: "var(--red-400)" }}>*</span></label>
              <input
                className="form-input"
                required
                placeholder="e.g. MNT001"
                value={promoteForm.mentorId}
                onChange={(e) => setPromoteForm((f) => ({ ...f, mentorId: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expertise <span style={{ fontWeight: 400, color: "var(--slate-500)" }}>(optional)</span></label>
              <input
                className="form-input"
                placeholder="e.g. Machine Learning, Web Dev"
                value={promoteForm.expertise}
                onChange={(e) => setPromoteForm((f) => ({ ...f, expertise: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}
