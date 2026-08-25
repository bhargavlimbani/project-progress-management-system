import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

/**
 * Row of dropdown filters with an active-count chip and a reset control.
 *
 * filters: [{ key, label, options: [{value,label}], type?: "select"|"range" }]
 * value:   { [key]: selectedValue }
 */
export default function FilterPanel({ filters = [], value = {}, onChange, onReset, children }) {
  const [open, setOpen] = useState(false);

  const activeCount = Object.entries(value).filter(
    ([, v]) => v !== "" && v !== undefined && v !== null
  ).length;

  const set = (key, next) => onChange?.({ ...value, [key]: next });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeCount > 0 && (
            <span
              style={{
                background: "var(--purple-500)",
                color: "#fff",
                borderRadius: 99,
                fontSize: "0.65rem",
                fontWeight: 800,
                padding: "1px 6px",
                marginLeft: 2,
              }}
            >
              {activeCount}
            </span>
          )}
        </button>

        {children}

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="btn btn-sm"
            style={{ color: "var(--slate-400)", fontSize: "0.8125rem" }}
          >
            <X size={13} />
            Clear all
          </button>
        )}
      </div>

      {open && (
        <div
          className="glass-card"
          style={{
            padding: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
          }}
        >
          {filters.map((filter) => (
            <div key={filter.key} className="form-group">
              <label className="form-label">{filter.label}</label>

              {filter.type === "range" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="range"
                    min={filter.min ?? 0}
                    max={filter.max ?? 100}
                    value={value[filter.key] ?? filter.min ?? 0}
                    onChange={(e) => set(filter.key, Number(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--purple-500)" }}
                  />
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 700,
                      color: "var(--purple-400)",
                      minWidth: 38,
                      textAlign: "right",
                    }}
                  >
                    {value[filter.key] ?? filter.min ?? 0}
                    {filter.suffix || ""}
                  </span>
                </div>
              ) : (
                <select
                  className="form-input"
                  value={value[filter.key] ?? ""}
                  onChange={(e) => set(filter.key, e.target.value)}
                >
                  <option value="">All {filter.label.toLowerCase()}</option>
                  {filter.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
