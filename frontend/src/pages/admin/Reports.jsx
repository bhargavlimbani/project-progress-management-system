import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FileText, Download, Eye, Loader2, FileSpreadsheet, FileType, Table2,
} from "lucide-react";
import { reportApi, academicApi, subjectApi, domainApi } from "../../services/index.js";
import { useApi, useApiAll } from "../../hooks/useApi.js";
import { apiErrorMessage } from "../../utils/format.js";
import { PROJECT_STATUS } from "../../utils/constants.js";
import {
  PageHeader, EmptyState, SkeletonCard, Modal, FilterPanel,
} from "../../components/ui/index.js";

const FORMATS = [
  { key: "pdf", label: "PDF", icon: FileType },
  { key: "xlsx", label: "Excel", icon: FileSpreadsheet },
  { key: "csv", label: "CSV", icon: Table2 },
];

/**
 * Report catalogue (spec §51). Every report renders from the same dataset
 * shape, so each one supports preview plus PDF / Excel / CSV export.
 */
export default function Reports() {
  const { data: reports, loading } = useApi(() => reportApi.list(), [], { initialData: [] });

  const { data: meta } = useApiAll(
    {
      years: () => academicApi.getYears(),
      subjects: () => subjectApi.list(),
      domains: () => domainApi.list(),
    },
    []
  );

  const [filters, setFilters] = useState({
    academicYearId: "",
    subjectId: "",
    domainId: "",
    status: "",
  });

  const [previewing, setPreviewing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const activeFilters = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    [filters]
  );

  const openPreview = async (report) => {
    setPreviewing(report);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const { data } = await reportApi.preview(report.key, activeFilters);
      setPreview(data);
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setPreviewing(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const download = async (report, format) => {
    setDownloading(`${report.key}-${format}`);
    try {
      await reportApi.download(report.key, { ...activeFilters, format });
      toast.success(`${report.name} downloaded.`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <PageHeader
        icon={FileText}
        title="Reports"
        subtitle="Export the state of every project, student, mentor and evaluation."
        crumbs={[{ label: "Admin", to: "/admin" }, { label: "Reports" }]}
      />

      <div style={{ marginBottom: 20 }}>
        <FilterPanel
          value={filters}
          onChange={setFilters}
          onReset={() => setFilters({ academicYearId: "", subjectId: "", domainId: "", status: "" })}
          filters={[
            {
              key: "academicYearId",
              label: "Academic Year",
              options: (meta.years || []).map((y) => ({ value: y.id, label: y.label })),
            },
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
            {
              key: "status",
              label: "Status",
              options: Object.entries(PROJECT_STATUS).map(([value, cfg]) => ({
                value,
                label: cfg.label,
              })),
            },
          ]}
        >
          <span style={{ fontSize: "0.78rem", color: "var(--slate-500)" }}>
            Filters apply to every report that supports them.
          </span>
        </FilterPanel>
      </div>

      {loading ? (
        <div className="card-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} height={180} />
          ))}
        </div>
      ) : !reports?.length ? (
        <div className="glass-card">
          <EmptyState icon={FileText} title="No reports available for your role" />
        </div>
      ) : (
        <div className="card-grid">
          {reports.map((report) => (
            <div key={report.key} className="glass-card glass-card-hover" style={{ padding: 20 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: "rgba(124,58,237,0.14)",
                  border: "1px solid rgba(124,58,237,0.24)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <FileText size={18} color="var(--purple-400)" />
              </div>

              <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, marginBottom: 6 }}>
                {report.name}
              </h3>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--slate-400)",
                  lineHeight: 1.55,
                  marginBottom: 16,
                  minHeight: 40,
                }}
              >
                {report.description}
              </p>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}
                onClick={() => openPreview(report)}
              >
                <Eye size={14} />
                Preview
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {FORMATS.map(({ key, label, icon: Icon }) => {
                  const busy = downloading === `${report.key}-${key}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ justifyContent: "center", padding: "6px 8px" }}
                      onClick={() => download(report, key)}
                      disabled={downloading !== null}
                      title={`Download as ${label}`}
                    >
                      {busy ? <Loader2 size={12} className="spin" /> : <Icon size={12} />}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      <Modal
        open={Boolean(previewing)}
        onClose={() => {
          setPreviewing(null);
          setPreview(null);
        }}
        title={previewing?.name}
        subtitle={preview?.subtitle}
        width={1000}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setPreviewing(null);
                setPreview(null);
              }}
            >
              Close
            </button>
            {FORMATS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className="btn btn-primary"
                onClick={() => download(previewing, key)}
                disabled={downloading !== null}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </>
        }
      >
        {previewLoading ? (
          <div style={{ padding: 50, textAlign: "center" }}>
            <div className="spinner" style={{ margin: "0 auto" }} />
          </div>
        ) : !preview ? null : (
          <>
            {preview.summary?.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {preview.summary.map((s) => (
                  <div
                    key={s.label}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--purple-400)" }}>
                      {s.value}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--slate-400)", marginTop: 2 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!preview.rows?.length ? (
              <EmptyState
                compact
                icon={FileText}
                title="No records matched"
                message="Try widening or clearing the filters above."
              />
            ) : (
              <div style={{ maxHeight: 420, overflow: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {preview.columns.map((c) => (
                        <th key={c.key} style={{ whiteSpace: "nowrap" }}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 200).map((row, i) => (
                      <tr key={i}>
                        {preview.columns.map((c) => (
                          <td key={c.key}>{row[c.key] ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {preview.rows.length > 200 && (
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--slate-500)",
                      textAlign: "center",
                      padding: "12px 0 0",
                    }}
                  >
                    Previewing the first 200 of {preview.rows.length} rows — the download contains
                    all of them.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
