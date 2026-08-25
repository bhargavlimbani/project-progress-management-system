import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar.jsx";
import Navbar from "../components/layout/Navbar.jsx";

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever navigation happens.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="layout">
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(5,12,26,0.7)",
            backdropFilter: "blur(4px)",
            zIndex: 35,
          }}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className={`main-content ${collapsed ? "sidebar-collapsed" : ""}`}>
        <Navbar
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onMobileMenuOpen={() => setMobileOpen(true)}
        />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
