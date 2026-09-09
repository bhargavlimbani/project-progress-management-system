import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Plus, Edit2, Trash2, Check, Calendar, X } from "lucide-react";
import { academicApi } from "../../services/index.js";
import toast from "react-hot-toast";

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div style={{ padding: "24px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} className="btn-icon btn-secondary"><X size={18} /></button>
        </div>
        <div style={{ padding: "0 24px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

export default function AcademicYears() {
  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editYear, setEditYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  const load = () => {
    Promise.all([academicApi.getYears(), academicApi.getSemesters()])
      .then(([y, s]) => { setYears(y.data); setSemesters(s.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditYear(null); reset(); setShowModal(true); };
  const openEdit = (year) => {
    setEditYear(year);
    setValue("label", year.label);
    setValue("startDate", year.startDate?.slice(0, 10));
    setValue("endDate", year.endDate?.slice(0, 10));
    setShowModal(true);
  };

  const onSubmit = async (data) => {
    try {
      if (editYear) {
        await academicApi.updateYear(editYear.id, data);
        toast.success("Academic year updated.");
      } else {
        await academicApi.createYear(data);
        toast.success("Academic year created.");
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Error saving.");
    }
  };

  const activate = async (id) => {
    try {
      await academicApi.activateYear(id);
      toast.success("Academic year activated.");
      load();
    } catch (err) {
      toast.error("Error activating.");
    }
  };

  const deleteYear = async (id) => {
    if (!confirm("Delete this academic year? This cannot be undone.")) return;
    try {
      await academicApi.deleteYear(id);
      toast.success("Deleted.");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Cannot delete — may have linked data.");
    }
  };

  const createSemester = async (academicYearId, number) => {
    try {
      await academicApi.createSemester({ academicYearId, number });
      toast.success(`Semester ${number} added.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Semester already exists.");
    }
  };

  const yearSemesters = (yearId) => semesters.filter((s) => s.academicYearId === yearId).sort((a, b) => a.number - b.number);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Academic Years & Semesters</h1>
          <p style={{ color: "var(--slate-400)", marginTop: "4px" }}>Manage academic calendar</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} id="add-academic-year-btn">
          <Plus size={16} /> Add Academic Year
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[1, 2].map((i) => <div key={i} className="glass-card skeleton" style={{ height: "120px" }} />)}
        </div>
      ) : years.length === 0 ? (
        <div className="glass-card">
          <div className="empty-state">
            <Calendar size={48} style={{ opacity: 0.2 }} />
            <h3>No academic years yet</h3>
            <button className="btn btn-primary" onClick={openCreate}>Add first academic year</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {years.map((year) => {
            const sems = yearSemesters(year.id);
            return (
              <div key={year.id} className="glass-card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: 700 }}>{year.label}</h3>
                    {year.isActive && <span className="badge badge-green">Active</span>}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {!year.isActive && (
                      <button className="btn btn-secondary btn-sm" onClick={() => activate(year.id)} id={`activate-year-${year.id}`}>
                        <Check size={14} /> Activate
                      </button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(year)} id={`edit-year-${year.id}`}>
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteYear(year.id)} id={`delete-year-${year.id}`}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Semesters */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--slate-400)", fontWeight: 600, marginRight: "4px" }}>Semesters:</span>
                  {sems.map((s) => (
                    <span key={s.id} className="badge badge-blue">
                      Sem {s.number}
                      <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>
                        {s._count?.students ? ` · ${s._count.students}S` : ""}
                      </span>
                    </span>
                  ))}
                  {/* Add missing semesters 1-8 */}
                  {[1, 2, 3, 4, 5, 6, 7, 8].filter((n) => !sems.find((s) => s.number === n)).map((n) => (
                    <button
                      key={n}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: "3px 10px", fontSize: "0.7rem" }}
                      onClick={() => createSemester(year.id, n)}
                      id={`add-sem-${year.id}-${n}`}
                    >
                      + Sem {n}
                    </button>
                  ))}
                </div>

                {year.startDate && (
                  <div style={{ fontSize: "0.75rem", color: "var(--slate-500)", marginTop: "10px" }}>
                    {new Date(year.startDate).toLocaleDateString()} — {year.endDate ? new Date(year.endDate).toLocaleDateString() : "—"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editYear ? "Edit Academic Year" : "Add Academic Year"}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="form-group">
            <label className="form-label">Year Label *</label>
            <input className="form-input" placeholder="e.g. 2025-2026" {...register("label", { required: "Label required" })} id="year-label-input" />
            {errors.label && <span className="form-error">{errors.label.message}</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" {...register("startDate")} id="year-start-date" />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input className="form-input" type="date" {...register("endDate")} id="year-end-date" />
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" id="save-academic-year-btn">
              {editYear ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}