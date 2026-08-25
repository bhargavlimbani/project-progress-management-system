import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Bell, CheckCheck, Filter } from "lucide-react";
import { notificationApi } from "../../services/index.js";
import { useApi } from "../../hooks/useApi.js";
import { NOTIFICATION_TONE, STATUS_TONE_HEX } from "../../utils/constants.js";
import { timeAgo, formatDateTime, humanize, apiErrorMessage } from "../../utils/format.js";
import { PageHeader, EmptyState, SkeletonTable, Tabs } from "../../components/ui/index.js";

export default function Notifications() {
  const navigate = useNavigate();
  const { data, loading, setData, refetch } = useApi(() => notificationApi.list(), [], {
    initialData: [],
  });

  const [tab, setTab] = useState("all");
  const [marking, setMarking] = useState(false);

  const items = useMemo(() => {
    const list = Array.isArray(data) ? data : data?.notifications || [];
    return tab === "unread" ? list.filter((n) => !n.isRead) : list;
  }, [data, tab]);

  const allItems = Array.isArray(data) ? data : data?.notifications || [];
  const unreadCount = allItems.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    const ids = allItems.filter((n) => !n.isRead).map((n) => n.id);
    if (!ids.length) return;

    setMarking(true);
    // Optimistic — the list is long and the round-trip is noticeable.
    setData((prev) => {
      const list = Array.isArray(prev) ? prev : prev?.notifications || [];
      const updated = list.map((n) => ({ ...n, isRead: true }));
      return Array.isArray(prev) ? updated : { ...prev, notifications: updated };
    });

    try {
      await notificationApi.markRead(ids);
      toast.success("All notifications marked as read.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
      refetch();
    } finally {
      setMarking(false);
    }
  };

  const open = (notification) => {
    if (!notification.isRead) {
      setData((prev) => {
        const list = Array.isArray(prev) ? prev : prev?.notifications || [];
        const updated = list.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n));
        return Array.isArray(prev) ? updated : { ...prev, notifications: updated };
      });
      notificationApi.markRead([notification.id]).catch(() => {});
    }
    if (notification.link) navigate(notification.link);
  };

  return (
    <>
      <PageHeader
        icon={Bell}
        title="Notifications"
        subtitle="Approvals, reviews, reminders and risk alerts across your projects."
        crumbs={[{ label: "Notifications" }]}
        actions={
          unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={markAllRead}
              disabled={marking}
            >
              <CheckCheck size={15} />
              Mark all read
            </button>
          )
        }
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "all", label: "All", icon: Bell, badge: allItems.length },
          { key: "unread", label: "Unread", icon: Filter, badge: unreadCount },
        ]}
      />

      {loading ? (
        <SkeletonTable rows={6} cols={2} />
      ) : !items.length ? (
        <div className="glass-card">
          <EmptyState
            icon={Bell}
            title={tab === "unread" ? "Nothing unread" : "No notifications yet"}
            message="You'll be told here when an idea is reviewed, a submission needs attention, or a project starts falling behind."
          />
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: "hidden" }}>
          {items.map((notification) => {
            const tone = NOTIFICATION_TONE[notification.type] || "gray";
            const color = STATUS_TONE_HEX[tone];

            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => open(notification)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  gap: 14,
                  padding: "16px 20px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  background: notification.isRead ? "transparent" : "rgba(124,58,237,0.05)",
                  transition: "background 150ms",
                  cursor: notification.link ? "pointer" : "default",
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    flexShrink: 0,
                    background: `${color}1f`,
                    border: `1px solid ${color}33`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Bell size={16} color={color} />
                </span>

                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 3,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: notification.isRead ? 500 : 700,
                        color: "var(--white)",
                      }}
                    >
                      {notification.title}
                    </span>
                    <span className={`badge badge-${tone}`} style={{ fontSize: "0.58rem", padding: "2px 7px" }}>
                      {humanize(notification.type)}
                    </span>
                    {!notification.isRead && <span className="notif-dot" />}
                  </span>

                  <span
                    style={{
                      display: "block",
                      fontSize: "0.8125rem",
                      color: "var(--slate-400)",
                      lineHeight: 1.55,
                    }}
                  >
                    {notification.body}
                  </span>

                  <span
                    style={{
                      display: "block",
                      fontSize: "0.7rem",
                      color: "var(--slate-500)",
                      marginTop: 5,
                    }}
                    title={formatDateTime(notification.createdAt)}
                  >
                    {timeAgo(notification.createdAt)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
