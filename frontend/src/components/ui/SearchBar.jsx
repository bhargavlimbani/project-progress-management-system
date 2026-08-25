import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

/**
 * Debounced search input. Keeps its own immediate value so typing feels
 * instant while the parent only sees a settled query.
 */
export default function SearchBar({
  value = "",
  onChange,
  placeholder = "Search…",
  delay = 300,
  width,
  autoFocus = false,
}) {
  const [local, setLocal] = useState(value);

  // Re-sync when the parent resets the query (e.g. clearing filters).
  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (local === value) return undefined;
    const timer = setTimeout(() => onChange?.(local), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, delay]);

  return (
    <div style={{ position: "relative", width: width || "100%", maxWidth: width || 340 }}>
      <Search
        size={16}
        style={{
          position: "absolute",
          left: 13,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--slate-500)",
          pointerEvents: "none",
        }}
      />
      <input
        className="form-input"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{ paddingLeft: 38, paddingRight: local ? 36 : 16 }}
        aria-label={placeholder}
      />
      {local && (
        <button
          type="button"
          onClick={() => {
            setLocal("");
            onChange?.("");
          }}
          aria-label="Clear search"
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--slate-500)",
            display: "flex",
          }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
