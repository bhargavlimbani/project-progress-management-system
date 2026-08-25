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

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusables = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
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
    // Focus the first field once the entry animation has settled.
    const timer = setTimeout(() => {
      const target = panelRef.current?.querySelector(
        'input, textarea, select, button:not([data-close])'
      );
      target?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

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
