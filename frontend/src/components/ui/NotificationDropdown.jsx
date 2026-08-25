import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck } from "lucide-react";
import { notificationApi } from "../../services/index.js";
import { NOTIFICATION_TONE, STATUS_TONE_HEX } from "../../utils/constants.js";
import { timeAgo } from "../../utils/format.js";
import EmptyState from "./EmptyState.jsx";
import { useSocket } from "../../hooks/useSocket.js";

/**
 * Bell + dropdown notification centre (spec §45). Polls on open and also
 * listens for live pushes on the user's socket channel.
 */
export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const socket = useSocket();

  const loadCount = async () => {
    try {
      const { data } = await notificationApi.unreadCount();
      setUnread(data.count ?? 0);
    } catch {
      /* the badge is non-critical — stay quiet on failure */
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data } = await notificationApi.list();
      setItems(Array.isArray(data) ? data : data.notifications || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCount();
    const timer = setInterval(loadCount, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Live pushes from the server.
  useEffect(() => {
    if (!socket) return undefined;
    const onNotification = (payload) => {
      setUnread((n) => n + 1);
      setItems((prev) => [payload, ...prev]);
    };
    socket.on("notification", onNotification);
    return () => socket.off("notification", onNotification);
  }, [socket]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadItems();
  };

  const markAllRead = async () => {
    const unreadIds = items.filter((n) => !n.isRead).map((n) => n.id);
    if (!unreadIds.length) return;
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    try {
      await notificationApi.markRead(unreadIds);
    } catch {
      loadCount();
    }
  };

  const openNotification = async (notification) => {
    if (!notification.isRead) {
      setItems((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnread((n) => Math.max(0, n - 1));
      notificationApi.markRead([notification.id]).catch(() => {});
    }
    setOpen(false);
    if (notification.link) navigate(notification.link);
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={toggle}
        className="btn-icon"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        style={{ color: "var(--slate-300)", position: "relative", display: "flex" }}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 99,
              background: "var(--red-500)",
              color: "#fff",
              fontSize: "0.6rem",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px var(--navy-900)",
            }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{ width: 360, maxWidth: "calc(100vw - 32px)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ fontSize: "0.875rem", fontWeight: 700 }}>
                Notifications
                {unread > 0 && (
                  <span style={{ color: "var(--purple-400)", marginLeft: 6, fontSize: "0.75rem" }}>
                    {unread} new
                  </span>
                )}
              </div>
              {items.some((n) => !n.isRead) && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="flex items-center gap-1"
                  style={{ fontSize: "0.7rem", color: "var(--purple-400)", fontWeight: 600 }}
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
            </div>

            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: 24, textAlign: "center" }}>
                  <div className="spinner" style={{ margin: "0 auto" }} />
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  compact
                  icon={Bell}
                  title="You're all caught up"
                  message="New approvals, reviews and reminders will appear here."
                />
              ) : (
                items.map((notification) => {
                  const tone = NOTIFICATION_TONE[notification.type] || "gray";
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => openNotification(notification)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        display: "flex",
                        gap: 11,
                        padding: "13px 16px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: notification.isRead ? "transparent" : "rgba(124,58,237,0.06)",
                        transition: "background 150ms",
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          marginTop: 5,
                          flexShrink: 0,
                          background: STATUS_TONE_HEX[tone],
                          boxShadow: `0 0 8px ${STATUS_TONE_HEX[tone]}80`,
                          opacity: notification.isRead ? 0.35 : 1,
                        }}
                      />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.8125rem",
                            fontWeight: notification.isRead ? 500 : 700,
                            color: "var(--white)",
                            marginBottom: 2,
                          }}
                        >
                          {notification.title}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.75rem",
                            color: "var(--slate-400)",
                            lineHeight: 1.5,
                          }}
                        >
                          {notification.body}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.68rem",
                            color: "var(--slate-500)",
                            marginTop: 4,
                          }}
                        >
                          {timeAgo(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
