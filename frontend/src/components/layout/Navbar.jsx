import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu, PanelLeftClose, PanelLeft, LogOut, User, Settings, KeyRound, MessageSquare,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { chatApi } from "../../services/index.js";
import { initials } from "../../utils/format.js";
import { ROLE_HOME } from "../../utils/constants.js";
import GlobalSearch from "../ui/GlobalSearch.jsx";
import NotificationDropdown from "../ui/NotificationDropdown.jsx";

export default function Navbar({ onToggleSidebar, onMobileMenuOpen, collapsed }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const menuRef = useRef(null);

  const home = ROLE_HOME[user?.role] || "/";

  useEffect(() => {
    let active = true;
    const load = () =>
      chatApi
        .unreadCount()
        .then(({ data }) => active && setUnreadChats(data.count || 0))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const chatPath = user?.role === "STUDENT" ? "/student/chat" : `${home}/chat`;

  return (
    <header className="navbar">
      {/* Sidebar toggles — hamburger on mobile, collapse on desktop */}
      <button
        type="button"
        onClick={onMobileMenuOpen}
        className="btn-icon show-mobile-only"
        aria-label="Open navigation menu"
        style={{ color: "var(--slate-300)" }}
      >
        <Menu size={20} />
      </button>

      <button
        type="button"
        onClick={onToggleSidebar}
        className="btn-icon hide-mobile-only"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{ color: "var(--slate-400)" }}
      >
        {collapsed ? <PanelLeft size={19} /> : <PanelLeftClose size={19} />}
      </button>

      <GlobalSearch />

      <div className="toolbar-spacer" />

      {/* Chat */}
      <Link
        to={chatPath}
        className="btn-icon"
        aria-label={`Messages${unreadChats ? `, ${unreadChats} unread` : ""}`}
        style={{ color: "var(--slate-300)", position: "relative", display: "flex" }}
      >
        <MessageSquare size={19} />
        {unreadChats > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 99,
              background: "var(--purple-500)",
              color: "#fff",
              fontSize: "0.6rem",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 2px var(--navy-900)",
            }}
          >
            {unreadChats > 9 ? "9+" : unreadChats}
          </span>
        )}
      </Link>

      <NotificationDropdown />

      {/* Profile menu */}
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "5px 10px 5px 5px",
            borderRadius: 99,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {user?.profilePhoto ? (
            <img src={user.profilePhoto} alt="" className="avatar" width={30} height={30} />
          ) : (
            <span
              className="avatar-placeholder"
              style={{ width: 30, height: 30, fontSize: "0.7rem" }}
            >
              {initials(user?.name)}
            </span>
          )}
          <span className="hide-mobile-only" style={{ textAlign: "left", lineHeight: 1.25 }}>
            <span
              style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "var(--white)" }}
            >
              {user?.name}
            </span>
            <span style={{ display: "block", fontSize: "0.66rem", color: "var(--slate-500)" }}>
              {user?.role}
            </span>
          </span>
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              role="menu"
              className="dropdown"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14 }}
              style={{ minWidth: 230 }}
            >
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "0.8125rem", fontWeight: 700 }}>{user?.name}</div>
                <div
                  className="truncate"
                  style={{ fontSize: "0.72rem", color: "var(--slate-500)", marginTop: 2 }}
                >
                  {user?.email}
                </div>
                {user?.enrollmentNumber && (
                  <div style={{ fontSize: "0.68rem", color: "var(--purple-400)", marginTop: 3 }}>
                    {user.enrollmentNumber}
                  </div>
                )}
              </div>

              <div style={{ padding: 6 }}>
                <Link
                  to={`${home}/profile`}
                  role="menuitem"
                  className="nav-item"
                  onClick={() => setMenuOpen(false)}
                >
                  <User size={16} className="nav-icon" />
                  My Profile
                </Link>
                <Link
                  to={`${home}/settings`}
                  role="menuitem"
                  className="nav-item"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings size={16} className="nav-icon" />
                  Settings
                </Link>
                <Link
                  to={`${home}/settings?tab=password`}
                  role="menuitem"
                  className="nav-item"
                  onClick={() => setMenuOpen(false)}
                >
                  <KeyRound size={16} className="nav-icon" />
                  Change Password
                </Link>
              </div>

              <div style={{ padding: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="nav-item"
                  style={{ width: "100%", color: "var(--red-400)" }}
                >
                  <LogOut size={16} className="nav-icon" />
                  Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
