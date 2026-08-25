import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { initials } from "../../utils/format.js";
import {
  LayoutDashboard, Users, BookOpen, Layers3, UserCheck, GraduationCap,
  FolderKanban, CalendarRange, Bell, BarChart3, Settings, LogOut, Zap,
  ClipboardCheck, FileText, Presentation, Trophy, MessageSquare,
  Layers, TrendingUp, CalendarClock, User,
} from "lucide-react";

/** Sidebar navigation per role (spec §13). */
const navConfigs = {
  ADMIN: [
    { section: "Overview" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/admin" },
    { label: "Analytics", icon: BarChart3, to: "/admin/analytics" },

    { section: "Academic Setup" },
    { label: "Academic Years", icon: CalendarRange, to: "/admin/academic-years" },
    { label: "Semesters", icon: Layers3, to: "/admin/semesters" },
    { label: "Subjects", icon: BookOpen, to: "/admin/subjects" },
    { label: "Domains", icon: Layers, to: "/admin/domains" },
    { label: "Timeline / Milestones", icon: ClipboardCheck, to: "/admin/milestones" },

    { section: "People" },
    { label: "Faculty", icon: Users, to: "/admin/faculty" },
    { label: "Mentors", icon: UserCheck, to: "/admin/mentors" },
    { label: "Students", icon: GraduationCap, to: "/admin/students" },

    { section: "Delivery" },
    { label: "Projects", icon: FolderKanban, to: "/admin/projects" },
    { label: "Presentations", icon: Presentation, to: "/admin/presentations" },
    { label: "Reports", icon: FileText, to: "/admin/reports" },

    { section: "Account" },
    { label: "Notifications", icon: Bell, to: "/admin/notifications" },
    { label: "Settings", icon: Settings, to: "/admin/settings" },
  ],

  FACULTY: [
    { section: "Overview" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/faculty" },
    { label: "My Projects", icon: FolderKanban, to: "/faculty/projects" },

    { section: "Reviews" },
    { label: "Idea Reviews", icon: ClipboardCheck, to: "/faculty/idea-reviews" },
    { label: "Weekly Verification", icon: TrendingUp, to: "/faculty/weekly-reviews" },
    { label: "Documents", icon: FileText, to: "/faculty/documents" },
    { label: "Evaluations", icon: Trophy, to: "/faculty/evaluations" },

    { section: "Schedule" },
    { label: "Presentations", icon: Presentation, to: "/faculty/presentations" },
    { label: "Chat", icon: MessageSquare, to: "/faculty/chat" },

    { section: "Account" },
    { label: "Notifications", icon: Bell, to: "/faculty/notifications" },
    { label: "Settings", icon: Settings, to: "/faculty/settings" },
  ],

  MENTOR: [
    { section: "Overview" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/mentor" },
    { label: "My Projects", icon: FolderKanban, to: "/mentor/projects" },

    { section: "Reviews" },
    { label: "Weekly Reviews", icon: TrendingUp, to: "/mentor/weekly-reviews" },
    { label: "Documents", icon: FileText, to: "/mentor/documents" },

    { section: "Schedule" },
    { label: "Meetings", icon: CalendarClock, to: "/mentor/meetings" },
    { label: "Chat", icon: MessageSquare, to: "/mentor/chat" },

    { section: "Account" },
    { label: "Notifications", icon: Bell, to: "/mentor/notifications" },
    { label: "Settings", icon: Settings, to: "/mentor/settings" },
  ],

  STUDENT: [
    { section: "Overview" },
    { label: "Dashboard", icon: LayoutDashboard, to: "/student" },
    { label: "My Projects", icon: FolderKanban, to: "/student/projects" },

    { section: "My Work" },
    { label: "Weekly Progress", icon: TrendingUp, to: "/student/progress" },
    { label: "Presentations", icon: Presentation, to: "/student/presentations" },
    { label: "Chat", icon: MessageSquare, to: "/student/chat" },

    { section: "Account" },
    { label: "Notifications", icon: Bell, to: "/student/notifications" },
    { label: "Profile", icon: User, to: "/student/profile" },
  ],
};

function NavItem({ item, collapsed }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      // Only the role root should match exactly; nested routes match by prefix.
      end={item.to.split("/").filter(Boolean).length <= 1}
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="nav-icon" size={18} />
      {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
    </NavLink>
  );
}

export default function Sidebar({ collapsed, mobileOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items = navConfigs[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      {/* Brand */}
      <div
        style={{
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          minHeight: 72,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            flexShrink: 0,
            borderRadius: 10,
            background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 15px rgba(124,58,237,0.4)",
          }}
        >
          <Zap size={18} color="white" />
        </div>

        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: "white",
                letterSpacing: "0.04em",
              }}
            >
              SAPMS
            </div>
            <div
              style={{
                fontSize: "0.64rem",
                color: "rgba(148,163,184,0.65)",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              ICT Department
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto", overflowX: "hidden" }}>
        {items.map((item, i) =>
          item.section ? (
            collapsed ? (
              <div
                key={`sep-${i}`}
                style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "10px 6px" }}
              />
            ) : (
              <div
                key={`sec-${i}`}
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  color: "var(--slate-600)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "14px 10px 5px",
                }}
              >
                {item.section}
              </div>
            )
          ) : (
            <NavItem key={item.to} item={item} collapsed={collapsed} />
          )
        )}
      </nav>

      {/* User */}
      <div
        style={{
          padding: collapsed ? "12px 10px" : 12,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 10,
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            overflow: "hidden",
          }}
        >
          {user?.profilePhoto ? (
            <img src={user.profilePhoto} alt="" className="avatar" width={34} height={34} />
          ) : (
            <div
              className="avatar-placeholder"
              style={{ width: 34, height: 34, fontSize: "0.72rem", flexShrink: 0 }}
            >
              {initials(user?.name)}
            </div>
          )}

          {!collapsed && (
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div
                className="truncate"
                style={{ fontSize: "0.8125rem", fontWeight: 600, color: "white" }}
              >
                {user?.name}
              </div>
              <div style={{ fontSize: "0.68rem", color: "rgba(148,163,184,0.6)" }}>
                {user?.role}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="nav-item"
          style={{ width: "100%", marginTop: 6, color: "var(--red-400)" }}
        >
          <LogOut size={18} className="nav-icon" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
