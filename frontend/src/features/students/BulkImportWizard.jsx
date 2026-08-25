import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Download, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, ArrowRight,
  ArrowLeft, Loader2, RotateCcw, Mail, Users, Upload, PartyPopper,
} from "lucide-react";
import { academicApi, importApi } from "../../services/index.js";
import { apiErrorMessage } from "../../utils/format.js";
import { FileUploader, EmptyState, Tabs } from "../../components/ui/index.js";

const STEPS = [
  { key: "scope", label: "Scope" },
  { key: "upload", label: "Upload" },
  { key: "review", label: "Review" },
  { key: "done", label: "Import" },
];

/**
 * Bulk student import (spec §22–26).
 *
 * Scope → Upload → server-side validation → preview → confirm.
 * Nothing is written until the admin confirms, and the actual insert runs in
 * a single Postgres transaction on the server.
 */
export default function BulkImportWizard({ onImported }) {
  const [step, setStep] = useState(0);

  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [sendEmails, setSendEmails] = useState(true);

  const [file, setFile] = useState(null);
  const [batch, setBatch] = useState(null);
  const [result, setResult] = useState(null);
  const [reviewTab, setReviewTab] = useState("valid");

  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Load academic years, defaulting to the active one.
  useEffect(() => {
    academicApi
      .getYears()
      .then(({ data }) => {
        setYears(data);
        const active = data.find((y) => y.isActive) || data[0];
        if (active) setAcademicYearId(active.id);
      })
      .catch((err) => toast.error(apiErrorMessage(err)));
  }, []);

  useEffect(() => {
    if (!academicYearId) {
      setSemesters([]);
      return;
    }
    academicApi
      .getSemesters({ academicYearId })
      .then(({ data }) => {
        setSemesters(data);
        setSemesterId((prev) => (data.some((s) => s.id === prev) ? prev : ""));
      })
      .catch(() => setSemesters([]));
  }, [academicYearId]);

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      await importApi.downloadTemplate();
      toast.success("Template downloaded.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  const validate = async () => {
    if (!file) return;
    setValidating(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("academicYearId", academicYearId);
      form.append("semesterId", semesterId);
      form.append("sendActivationEmails", String(sendEmails));

      const { data } = await importApi.validate(form);
      setBatch(data);
      setReviewTab(data.validRows > 0 ? "valid" : data.duplicateRows > 0 ? "duplicates" : "errors");
      setStep(2);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setValidating(false);
    }
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      const { data } = await importApi.confirm(batch.batchId);
      setResult(data);
      setStep(3);
      toast.success(data.message);
      onImported?.();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const downloadErrors = async () => {
    try {
      await importApi.downloadErrorReport(batch.batchId);
      toast.success("Error report downloaded.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const restart = () => {
    setStep(0);
    setFile(null);
    setBatch(null);
    setResult(null);
  };

  const selectedYear = years.find((y) => y.id === academicYearId);
  const selectedSemester = semesters.find((s) => s.id === semesterId);

  return (
    <div>
      <StepRail current={step} />

      {/* ── Step 1: Scope ──────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="glass-card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>
            Which cohort are you importing?
          </h3>
          <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)", marginBottom: 20 }}>
            Every student in the file will be created under this academic year and semester.
          </p>

          <div className="form-grid" style={{ marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">Academic Year</label>
              <select
                className="form-input"
                value={academicYearId}
                onChange={(e) => setAcademicYearId(e.target.value)}
              >
                <option value="">Select a year…</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                    {y.isActive ? "  (active)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Semester</label>
              <select
                className="form-input"
                value={semesterId}
                onChange={(e) => setSemesterId(e.target.value)}
                disabled={!academicYearId}
              >
                <option value="">Select a semester…</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    Semester {s.number}
                  </option>
                ))}
              </select>
              {academicYearId && !semesters.length && (
                <span className="form-error">
                  This year has no semesters yet — create one under Semesters first.
                </span>
              )}
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 11,
              padding: "13px 15px",
              borderRadius: 12,
              background: "rgba(124,58,237,0.07)",
              border: "1px solid rgba(124,58,237,0.18)",
              cursor: "pointer",
              marginBottom: 22,
            }}
          >
            <input
              type="checkbox"
              checked={sendEmails}
              onChange={(e) => setSendEmails(e.target.checked)}
              style={{ accentColor: "var(--purple-500)", width: 16, height: 16, marginTop: 2 }}
            />
            <span>
              <span
                className="flex items-center gap-2"
                style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--white)" }}
              >
                <Mail size={14} color="var(--purple-400)" />
                Email activation links
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  color: "var(--slate-400)",
                  marginTop: 3,
                }}
              >
                Passwords are never read from the spreadsheet. Each student gets a single-use link
                to set their own. If SMTP isn't configured the links are printed to the server log.
              </span>
            </span>
          </label>

          <div className="flex items-center justify-between" style={{ gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={downloadTemplate}
              disabled={downloading}
            >
              {downloading ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
              Download Excel Template
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep(1)}
              disabled={!academicYearId || !semesterId}
            >
              Continue
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Upload ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="glass-card" style={{ padding: 24 }}>
          <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 8 }}>
            <div>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>
                Upload the filled-in file
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)" }}>
                Importing into{" "}
                <strong style={{ color: "var(--purple-400)" }}>
                  {selectedYear?.label} · Semester {selectedSemester?.number}
                </strong>
              </p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
              <Download size={14} />
              Template
            </button>
          </div>

          <FileUploader
            accept=".xlsx,.csv"
            maxSizeMb={5}
            label="Drop your .xlsx or .csv here, or click to browse"
            hint="Required columns: Enrollment Number, Student Name, Email, Mobile"
            value={file ? [file] : []}
            onFilesSelected={(files) => setFile(files[0])}
            onRemove={() => setFile(null)}
          />

          <div
            className="flex items-center justify-between"
            style={{ marginTop: 22, gap: 12, flexWrap: "wrap" }}
          >
            <button type="button" className="btn btn-secondary" onClick={() => setStep(0)}>
              <ArrowLeft size={15} />
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={validate}
              disabled={!file || validating}
            >
              {validating ? <Loader2 size={15} className="spin" /> : <CheckCircle2 size={15} />}
              {validating ? "Validating…" : "Validate File"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review ─────────────────────────────────────────────── */}
      {step === 2 && batch && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 18 }}>
            <SummaryTile label="Total Rows" value={batch.totalRows} tone="purple" icon={FileSpreadsheet} />
            <SummaryTile label="Valid" value={batch.validRows} tone="green" icon={CheckCircle2} />
            <SummaryTile label="Duplicates" value={batch.duplicateRows} tone="yellow" icon={AlertTriangle} />
            <SummaryTile label="Errors" value={batch.invalidRows} tone="red" icon={XCircle} />
          </div>

          <div className="glass-card" style={{ padding: 20 }}>
            <Tabs
              active={reviewTab}
              onChange={setReviewTab}
              tabs={[
                { key: "valid", label: "Valid", icon: CheckCircle2, badge: batch.validRows },
                { key: "duplicates", label: "Duplicates", icon: AlertTriangle, badge: batch.duplicateRows },
                { key: "errors", label: "Errors", icon: XCircle, badge: batch.invalidRows },
              ]}
            />

            <ReviewTable tab={reviewTab} batch={batch} />

            <div
              className="flex items-center justify-between"
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                <button type="button" className="btn btn-secondary" onClick={restart}>
                  <RotateCcw size={15} />
                  Start over
                </button>
                {batch.invalidRows > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={downloadErrors}>
                    <Download size={15} />
                    Download error report
                  </button>
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmImport}
                disabled={batch.validRows === 0 || importing}
                title={batch.validRows === 0 ? "There are no valid rows to import" : undefined}
              >
                {importing ? <Loader2 size={15} className="spin" /> : <Users size={15} />}
                {importing ? "Importing…" : `Import ${batch.validRows} Student${batch.validRows === 1 ? "" : "s"}`}
              </button>
            </div>

            {batch.validRows > 0 && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--slate-500)",
                  marginTop: 12,
                  textAlign: "right",
                }}
              >
                Only valid rows are imported, inside a single database transaction.
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Step 4: Done ───────────────────────────────────────────────── */}
      {step === 3 && result && (
        <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
          <div
            style={{
              width: 72,
              height: 72,
              margin: "0 auto 18px",
              borderRadius: "50%",
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PartyPopper size={30} color="var(--green-400)" />
          </div>

          <h3 style={{ fontSize: "1.25rem", fontWeight: 800, marginBottom: 6 }}>
            {result.imported} student{result.imported === 1 ? "" : "s"} imported
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--slate-400)", maxWidth: 420, margin: "0 auto 24px" }}>
            {sendEmails
              ? "Activation links are on their way. Students set their own password before their first sign-in."
              : "Activation tokens were generated. Share the links or reset passwords from the roster."}
          </p>

          <button type="button" className="btn btn-primary" onClick={restart}>
            <Upload size={15} />
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function StepRail({ current }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.68rem",
                fontWeight: 800,
                background: active
                  ? "var(--gradient-glow)"
                  : done
                  ? "rgba(124,58,237,0.2)"
                  : "rgba(255,255,255,0.05)",
                color: active ? "#fff" : done ? "var(--purple-300)" : "var(--slate-500)",
                border: `1px solid ${active ? "transparent" : done ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {done ? <CheckCircle2 size={13} /> : i + 1}
            </div>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: active ? "var(--white)" : done ? "var(--slate-300)" : "var(--slate-500)",
              }}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  width: 26,
                  height: 1,
                  background: done ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.08)",
                  margin: "0 4px",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryTile({ label, value, tone, icon: Icon }) {
  const colors = {
    purple: "#7c3aed",
    green: "#22c55e",
    yellow: "#eab308",
    red: "#ef4444",
  };
  const color = colors[tone];

  return (
    <div className="glass-card" style={{ padding: 18 }}>
      <div className="flex items-center gap-3">
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            background: `${color}1f`,
            border: `1px solid ${color}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={17} color={color} />
        </div>
        <div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1, color }}>{value}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--slate-400)", marginTop: 3 }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function ReviewTable({ tab, batch }) {
  const config = useMemo(() => {
    if (tab === "valid") {
      return {
        rows: batch.valid || [],
        empty: "No valid rows in this file.",
        columns: [
          { key: "rowNumber", label: "Row", width: 60 },
          { key: "enrollmentNumber", label: "Enrollment" },
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "mobile", label: "Mobile" },
        ],
      };
    }
    if (tab === "duplicates") {
      return {
        rows: batch.duplicates || [],
        empty: "No duplicates — nothing in this file already exists.",
        columns: [
          { key: "rowNumber", label: "Row", width: 60 },
          { key: "enrollmentNumber", label: "Enrollment" },
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "reason", label: "Why it's a duplicate" },
        ],
      };
    }
    return {
      rows: batch.invalid || [],
      empty: "No errors — every row passed validation.",
      columns: [
        { key: "rowNumber", label: "Row", width: 60 },
        { key: "enrollmentNumber", label: "Enrollment" },
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "reason", label: "Error" },
      ],
    };
  }, [tab, batch]);

  if (!config.rows.length) {
    return (
      <EmptyState
        compact
        icon={tab === "valid" ? XCircle : CheckCircle2}
        title={config.empty}
      />
    );
  }

  const tone = tab === "valid" ? "var(--green-400)" : tab === "duplicates" ? "var(--yellow-400)" : "var(--red-400)";

  return (
    <div style={{ maxHeight: 380, overflow: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            {config.columns.map((c) => (
              <th key={c.key} style={{ width: c.width }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {config.rows.map((row, i) => (
            <tr key={`${row.rowNumber}-${i}`}>
              {config.columns.map((c) => (
                <td
                  key={c.key}
                  style={c.key === "reason" ? { color: tone, fontSize: "0.8rem" } : undefined}
                >
                  {row[c.key] ?? row.rawData?.[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {config.rows.length >= 200 && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--slate-500)",
            padding: "10px 4px 0",
            textAlign: "center",
          }}
        >
          Showing the first 200 rows. Download the error report to see everything.
        </p>
      )}
    </div>
  );
}
