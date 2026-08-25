import { useRef, useState } from "react";
import { UploadCloud, File as FileIcon, X, AlertCircle, Image as ImageIcon } from "lucide-react";
import { formatBytes } from "../../utils/format.js";

/**
 * Drag-and-drop file picker with client-side type and size checks.
 *
 * The same rules are enforced again on the server (spec §57) — this pass
 * exists to give immediate feedback, not as the security boundary.
 */
export default function FileUploader({
  onFilesSelected,
  accept = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.zip",
  multiple = false,
  maxSizeMb = 50,
  label = "Drop a file here, or click to browse",
  hint,
  value = [],
  onRemove,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const allowedExtensions = accept
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  const validate = (files) => {
    for (const file of files) {
      const ext = `.${file.name.split(".").pop().toLowerCase()}`;
      if (allowedExtensions.length && !allowedExtensions.includes(ext)) {
        return `${file.name}: ${ext} files aren't accepted here.`;
      }
      if (file.size > maxSizeMb * 1024 * 1024) {
        return `${file.name} is ${formatBytes(file.size)} — the limit is ${maxSizeMb}MB.`;
      }
    }
    return "";
  };

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const problem = validate(files);
    if (problem) {
      setError(problem);
      return;
    }

    setError("");
    onFilesSelected?.(multiple ? files : [files[0]]);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${dragging ? "var(--purple-500)" : "rgba(255,255,255,0.12)"}`,
          borderRadius: "var(--radius-lg)",
          padding: "32px 20px",
          textAlign: "center",
          background: dragging ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.02)",
          transition: "all 200ms",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = ""; // allow re-picking the same file
          }}
          style={{ display: "none" }}
        />

        <div
          style={{
            width: 48,
            height: 48,
            margin: "0 auto 12px",
            borderRadius: 14,
            background: dragging ? "var(--gradient-glow)" : "rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 200ms",
          }}
        >
          <UploadCloud size={22} color={dragging ? "#fff" : "var(--slate-400)"} />
        </div>

        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--slate-200)" }}>
          {label}
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--slate-500)", marginTop: 4 }}>
          {hint || `${allowedExtensions.join(", ")} · up to ${maxSizeMb}MB`}
        </div>
      </div>

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            fontSize: "0.8125rem",
            color: "var(--red-400)",
          }}
        >
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {value.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {value.map((file, i) => {
            const isImage = file.type?.startsWith("image/");
            return (
              <div
                key={`${file.name}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    background: "rgba(124,58,237,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isImage ? (
                    <ImageIcon size={15} color="var(--purple-400)" />
                  ) : (
                    <FileIcon size={15} color="var(--purple-400)" />
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="truncate"
                    style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--white)" }}
                  >
                    {file.name}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>
                    {formatBytes(file.size)}
                  </div>
                </div>

                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    aria-label={`Remove ${file.name}`}
                    style={{ color: "var(--slate-400)", display: "flex" }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
