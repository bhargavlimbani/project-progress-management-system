import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

/**
 * Accessible dialog: closes on Escape and backdrop click, traps focus inside
 * while open, and restores focus to whatever opened it on close.
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 560,
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  /**
   * Callers pass `onClose` as an inline arrow, so its identity changes on every
   * render. Holding it in a ref keeps the effects below depending only on
   * `open` — otherwise every keystroke in a controlled field would re-run them
   * and yank the caret back to the first input.
   */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // ── Open/close transition: lock scroll, autofocus once, restore on close ──
  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    document.body.style.overflow = "hidden";

    // Focus the first field once the entry animation has settled. This runs
    // only when the dialog opens, never on subsequent re-renders.
    const timer = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;

      // Never steal focus if the user is already typing somewhere inside.
      if (panel.contains(document.activeElement)) return;

      const target =
        panel.querySelector("[data-autofocus]") ||
        panel.querySelector(
          "input:not([disabled]):not([type=hidden]), textarea:not([disabled]), select:not([disabled])"
        );
      target?.focus();
    }, 60);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // ── Escape to close + Tab focus trap ─────────────────────────────────────
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusables = Array.from(
        panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);

      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={(e) => {
            if (closeOnBackdrop && e.target === e.currentTarget) onClose?.();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="modal-content"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {(title || onClose) && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  padding: "22px 24px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div>
                  {title && (
                    <h2 style={{ fontSize: "1.0625rem", fontWeight: 700 }}>{title}</h2>
                  )}
                  {subtitle && (
                    <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)", marginTop: 4 }}>
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  data-close
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="btn-icon-sm"
                  style={{ color: "var(--slate-400)", flexShrink: 0 }}
                >
                  <X size={18} />
                </button>
              </div>
            )}

            <div style={{ padding: "20px 24px" }}>{children}</div>

            {footer && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  padding: "16px 24px 22px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
