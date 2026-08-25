import { useState } from "react";
import toast from "react-hot-toast";
import { Layers, Plus, Pencil, Trash2, Power, UserCheck, FolderKanban } from "lucide-react";
import { useForm } from "react-hook-form";
import { domainApi } from "../../services/index.js";
import { useApi } from "../../hooks/useApi.js";
import { apiErrorMessage } from "../../utils/format.js";
import {
  PageHeader, DataTable, Modal, ConfirmationDialog, SearchBar, StatusBadge,
} from "../../components/ui/index.js";

export default function Domains() {
  const { data: domains, loading, refetch } = useApi(() => domainApi.list(), [], {
    initialData: [],
  });

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = new
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const openCreate = () => {
    reset({ name: "", description: "" });
    setEditing({});
  };

  const openEdit = (domain) => {
    reset({ name: domain.name, description: domain.description || "" });
    setEditing(domain);
  };

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      if (editing.id) {
        await domainApi.update(editing.id, values);
        toast.success("Domain updated.");
      } else {
        await domainApi.create(values);
        toast.success("Domain created.");
      }
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (domain) => {
    try {
      await domainApi.update(domain.id, { isActive: !domain.isActive });
      toast.success(domain.isActive ? "Domain deactivated." : "Domain activated.");
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    try {
      await domainApi.delete(deleting.id);
      toast.success("Domain deleted.");
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const columns = [
    {
      key: "name",
      label: "Domain",
      render: (d) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--white)" }}>{d.name}</div>
          {d.description && (
            <div style={{ fontSize: "0.75rem", color: "var(--slate-500)", marginTop: 2 }}>
              {d.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "_count.mentors",
      label: "Mentors",
      align: "center",
      width: 110,
      render: (d) => (
        <span className="flex items-center gap-1" style={{ justifyContent: "center" }}>
          <UserCheck size={13} color="var(--slate-500)" />
          {d._count?.mentors ?? 0}
        </span>
      ),
    },
    {
      key: "_count.projects",
      label: "Projects",
      align: "center",
      width: 110,
      render: (d) => (
        <span className="flex items-center gap-1" style={{ justifyContent: "center" }}>
          <FolderKanban size={13} color="var(--slate-500)" />
          {d._count?.projects ?? 0}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      width: 110,
      render: (d) => (
        <StatusBadge
          tone={d.isActive ? "green" : "gray"}
          label={d.isActive ? "Active" : "Inactive"}
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
      render: (d) => (
        <div className="flex gap-2" style={{ justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn-icon-sm"
            title={d.isActive ? "Deactivate" : "Activate"}
            onClick={() => toggleActive(d)}
            style={{ color: d.isActive ? "var(--yellow-400)" : "var(--green-400)" }}
          >
            <Power size={15} />
          </button>
          <button
            type="button"
            className="btn-icon-sm"
            title="Edit"
            onClick={() => openEdit(d)}
            style={{ color: "var(--slate-300)" }}
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className="btn-icon-sm"
            title="Delete"
            onClick={() => setDeleting(d)}
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
        icon={Layers}
        title="Domains"
        subtitle="Technology areas used to match projects with the right mentor."
        crumbs={[{ label: "Admin", to: "/admin" }, { label: "Domains" }]}
        actions={
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Add Domain
          </button>
        }
      />

      <div className="toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder="Search domains…" />
      </div>

      <DataTable
        columns={columns}
        rows={domains || []}
        loading={loading}
        searchTerm={search}
        searchKeys={["name", "description"]}
        emptyIcon={Layers}
        emptyTitle="No domains yet"
        emptyMessage="Add domains like Artificial Intelligence, Web Development or Flutter so mentors can be matched to projects."
        emptyAction={
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} />
            Add the first domain
          </button>
        }
      />

      {/* Create / edit */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit Domain" : "Add Domain"}
        subtitle="Domains drive automatic mentor recommendation."
        width={480}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              type="submit"
              form="domain-form"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : editing?.id ? "Save Changes" : "Create Domain"}
            </button>
          </>
        }
      >
        <form id="domain-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group mb-4">
            <label className="form-label">Domain Name</label>
            <input
              className="form-input"
              placeholder="e.g. Artificial Intelligence"
              {...register("name", { required: "Domain name is required." })}
            />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="What kinds of projects belong to this domain?"
              {...register("description")}
            />
          </div>
        </form>
      </Modal>

      <ConfirmationDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete "${deleting?.name}"?`}
        message={
          deleting?._count?.projects > 0
            ? `${deleting._count.projects} project(s) reference this domain. Deleting it will fail while those projects exist — deactivate it instead.`
            : "This cannot be undone. Mentors assigned to this domain will lose the association."
        }
        confirmLabel="Delete Domain"
      />
    </>
  );
}
