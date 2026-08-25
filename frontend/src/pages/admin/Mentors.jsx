import { useState } from "react";
import toast from "react-hot-toast";
import {
  UserCheck, Plus, Pencil, Trash2, KeyRound, FolderKanban, Mail, Phone, Layers, X,
} from "lucide-react";
import { mentorApi, domainApi, userApi } from "../../services/index.js";
import { useApiAll } from "../../hooks/useApi.js";
import { apiErrorMessage, initials } from "../../utils/format.js";
import {
  PageHeader, DataTable, Modal, ConfirmationDialog, SearchBar, StatusBadge, ProgressBar,
} from "../../components/ui/index.js";

const emptyForm = {
  name: "",
  email: "",
  mentorId: "",
  mobile: "",
  expertise: "",
  password: "",
  domainIds: [],
};

/** Rough capacity used to visualise workload — mentors above this are stretched. */
const COMFORTABLE_LOAD = 8;

export default function Mentors() {
  const { data, loading, refetch } = useApiAll(
    {
      mentors: () => mentorApi.list(),
      domains: () => domainApi.list(),
    },
    []
  );

  const mentors = data.mentors || [];
  const domains = data.domains || [];

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing({});
  };

  const openEdit = (mentor) => {
    setForm({
      name: mentor.user.name,
      email: mentor.user.email,
      mentorId: mentor.mentorId,
      mobile: mentor.mobile || "",
      expertise: mentor.expertise || "",
      password: "",
      domainIds: mentor.domains?.map((d) => d.domainId) || [],
    });
    setEditing(mentor);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing.id) {
        const { password, email, ...rest } = form;
        await mentorApi.update(editing.id, rest);
        toast.success("Mentor updated.");
      } else {
        await mentorApi.create(form);
        toast.success("Mentor account created.");
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
      await mentorApi.delete(deleting.id);
      toast.success("Mentor deleted.");
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
      await mentorApi.resetPassword(resetting.id, { password: newPassword });
      toast.success(`Password reset for ${resetting.user.name}.`);
      setResetting(null);
      setNewPassword("");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (mentor) => {
    try {
      await userApi.setActive(mentor.user.id, !mentor.user.isActive);
      toast.success(mentor.user.isActive ? "Account deactivated." : "Account activated.");
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const toggleDomain = (domainId) =>
    setForm((f) => ({
      ...f,
      domainIds: f.domainIds.includes(domainId)
        ? f.domainIds.filter((id) => id !== domainId)
        : [...f.domainIds, domainId],
    }));

  const columns = [
    {
      key: "user.name",
      label: "Mentor",
      render: (m) => (
        <div className="flex items-center gap-3">
          {m.user.profilePhoto ? (
            <img src={m.user.profilePhoto} alt="" className="avatar" width={34} height={34} />
          ) : (
            <span className="avatar-placeholder" style={{ width: 34, height: 34, fontSize: "0.72rem" }}>
              {initials(m.user.name)}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "var(--white)" }}>{m.user.name}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--purple-400)" }}>{m.mentorId}</div>
          </div>
        </div>
      ),
    },
    {
      key: "expertise",
      label: "Expertise",
      hideOnMobile: true,
      render: (m) => (
        <span style={{ fontSize: "0.8rem", color: "var(--slate-300)" }}>{m.expertise || "—"}</span>
      ),
    },
    {
      key: "domains",
      label: "Domains",
      sortable: false,
      render: (m) =>
        m.domains?.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {m.domains.slice(0, 3).map((d) => (
              <span
                key={d.id}
                className="badge badge-purple"
                style={{ fontSize: "0.6rem", padding: "2px 7px" }}
              >
                {d.domain.name}
              </span>
            ))}
            {m.domains.length > 3 && (
              <span style={{ fontSize: "0.68rem", color: "var(--slate-500)", alignSelf: "center" }}>
                +{m.domains.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: "var(--yellow-400)", fontSize: "0.75rem" }}>No domains</span>
        ),
    },
    {
      key: "user.email",
      label: "Contact",
      sortable: false,
      hideOnMobile: true,
      render: (m) => (
        <div style={{ fontSize: "0.78rem" }}>
          <div className="flex items-center gap-1 truncate" style={{ color: "var(--slate-300)" }}>
            <Mail size={12} color="var(--slate-500)" />
            {m.user.email}
          </div>
          {m.mobile && (
            <div className="flex items-center gap-1" style={{ color: "var(--slate-500)", marginTop: 2 }}>
              <Phone size={12} />
              {m.mobile}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "_count.projects",
      label: "Workload",
      width: 150,
      sortValue: (m) => m._count?.projects ?? 0,
      render: (m) => {
        const count = m._count?.projects ?? 0;
        const load = Math.min(100, (count / COMFORTABLE_LOAD) * 100);
        return (
          <div>
            <div
              className="flex items-center justify-between"
              style={{ fontSize: "0.72rem", marginBottom: 4 }}
            >
              <span className="flex items-center gap-1" style={{ color: "var(--slate-400)" }}>
                <FolderKanban size={12} />
                {count} project{count === 1 ? "" : "s"}
              </span>
            </div>
            <ProgressBar
              value={load}
              height={5}
              variant={count > COMFORTABLE_LOAD ? "delayed" : count === COMFORTABLE_LOAD ? "at-risk" : undefined}
            />
          </div>
        );
      },
    },
    {
      key: "user.isActive",
      label: "Status",
      width: 100,
      render: (m) => (
        <button type="button" onClick={() => toggleActive(m)} title="Toggle account status">
          <StatusBadge
            tone={m.user.isActive ? "green" : "gray"}
            label={m.user.isActive ? "Active" : "Inactive"}
            size="sm"
          />
        </button>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      width: 150,
      sortable: false,
      render: (m) => (
        <div className="flex gap-2" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn-icon-sm"
            title="Reset password"
            onClick={() => setResetting(m)}
            style={{ color: "var(--yellow-400)" }}
          >
            <KeyRound size={15} />
          </button>
          <button
            type="button"
            className="btn-icon-sm"
            title="Edit"
            onClick={() => openEdit(m)}
            style={{ color: "var(--slate-300)" }}
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className="btn-icon-sm"
            title="Delete"
            onClick={() => setDeleting(m)}
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
        icon={UserCheck}
        title="Mentors"
        subtitle="Domain mentors and their current workload — the basis for automatic recommendation."
        crumbs={[{ label: "Admin", to: "/admin" }, { label: "Mentors" }]}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Add Mentor
          </button>
        }
      />

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by name, ID or expertise…" />
      </div>

      <DataTable
        columns={columns}
        rows={mentors}
        loading={loading}
        searchTerm={search}
        searchKeys={["user.name", "user.email", "mentorId", "expertise"]}
        emptyIcon={UserCheck}
        emptyTitle="No mentors yet"
        emptyMessage="Add mentors and link them to domains. When faculty approve a project, the system recommends the least-loaded mentor in that domain."
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} />
            Add Mentor
          </button>
        }
      />

      {/* Create / edit */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit Mentor" : "Add Mentor"}
        subtitle="A mentor can cover multiple domains."
        width={620}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="mentor-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing?.id ? "Save Changes" : "Create Account"}
            </button>
          </>
        }
      >
        <form id="mentor-form" onSubmit={submit}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                required
                placeholder="Mr. Arjun Nair"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mentor ID</label>
              <input
                className="form-input"
                required
                placeholder="MEN001"
                value={form.mentorId}
                onChange={(e) => setForm((f) => ({ ...f, mentorId: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                required
                disabled={Boolean(editing?.id)}
                placeholder="arjun.nair@college.edu"
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

            <div className="form-group form-grid-full">
              <label className="form-label">Expertise</label>
              <input
                className="form-input"
                placeholder="Artificial Intelligence, Machine Learning, Python"
                value={form.expertise}
                onChange={(e) => setForm((f) => ({ ...f, expertise: e.target.value }))}
              />
            </div>

            {!editing?.id && (
              <div className="form-group form-grid-full">
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
              </div>
            )}

            <div className="form-group form-grid-full">
              <label className="form-label">
                Domains
                <span style={{ color: "var(--slate-500)", fontWeight: 400, marginLeft: 6 }}>
                  — drives which projects this mentor can be recommended for
                </span>
              </label>

              {!domains.length ? (
                <div style={{ fontSize: "0.8125rem", color: "var(--yellow-400)" }}>
                  No domains exist yet. Create domains first.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {domains.map((d) => {
                    const selected = form.domainIds.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDomain(d.id)}
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
                        {selected ? <X size={12} /> : <Layers size={12} />}
                        {d.name}
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
            <button type="submit" form="mentor-reset-form" className="btn btn-primary" disabled={saving}>
              {saving ? "Resetting…" : "Reset Password"}
            </button>
          </>
        }
      >
        <form id="mentor-reset-form" onSubmit={submitReset}>
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
            ? `This mentor is assigned to ${deleting._count.projects} project(s). Deleting will fail while those assignments exist — deactivate the account instead.`
            : "This permanently removes the mentor account and its domain links."
        }
        confirmLabel="Delete Mentor"
        confirmPhrase={deleting?.mentorId}
      />
    </>
  );
}
