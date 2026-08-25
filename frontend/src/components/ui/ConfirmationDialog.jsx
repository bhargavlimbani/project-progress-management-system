import { useState } from "react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import Modal from "./Modal.jsx";

/**
 * Confirmation prompt for destructive or irreversible actions.
 * Pass `confirmPhrase` to require the user to type a value (e.g. the record's
 * name) before the confirm button unlocks.
 */
export default function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  confirmPhrase,
  loading = false,
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const locked = Boolean(confirmPhrase) && typed.trim() !== confirmPhrase;
  const isBusy = loading || busy;

  const handleConfirm = async () => {
    if (locked || isBusy) return;
    setBusy(true);
    try {
      await onConfirm?.();
      setTyped("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setTyped("");
        onClose?.();
      }}
      width={460}
      closeOnBackdrop={!isBusy}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setTyped("");
              onClose?.();
            }}
            disabled={isBusy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
            onClick={handleConfirm}
            disabled={locked || isBusy}
            style={locked || isBusy ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
          >
            {isBusy ? <Loader2 size={16} className="spin" /> : <Trash2 size={15} />}
            {isBusy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 16 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: tone === "danger" ? "rgba(239,68,68,0.12)" : "rgba(124,58,237,0.12)",
            border: `1px solid ${tone === "danger" ? "rgba(239,68,68,0.25)" : "rgba(124,58,237,0.25)"}`,
          }}
        >
          <AlertTriangle size={20} color={tone === "danger" ? "var(--red-400)" : "var(--purple-400)"} />
        </div>

        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 6 }}>{title}</h3>
          {message && (
            <p style={{ fontSize: "0.875rem", color: "var(--slate-400)", lineHeight: 1.6 }}>
              {message}
            </p>
          )}

          {confirmPhrase && (
            <div style={{ marginTop: 16 }}>
              <label className="form-label">
                Type <span style={{ color: "var(--red-400)" }}>{confirmPhrase}</span> to confirm
              </label>
              <input
                className="form-input"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmPhrase}
                autoComplete="off"
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
