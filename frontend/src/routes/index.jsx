import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import DashboardLayout from "../layouts/DashboardLayout.jsx";
import { ROLE_HOME } from "../utils/constants.js";
import Login from "../pages/Login.jsx";

/**
 * Route table. Everything past the login screen is code-split so the initial
 * bundle stays small — the 3D login is what loads first.
 */

// ── Shared ────────────────────────────────────────────────────────────────
const Activate = lazy(() => import("../pages/Activate.jsx"));
const ProjectsList = lazy(() => import("../pages/shared/ProjectsList.jsx"));
const ProjectDetails = lazy(() => import("../pages/shared/ProjectDetails.jsx"));
const Presentations = lazy(() => import("../pages/shared/Presentations.jsx"));
const Notifications = lazy(() => import("../pages/shared/Notifications.jsx"));
const Settings = lazy(() => import("../pages/shared/Settings.jsx"));
const Chat = lazy(() => import("../pages/shared/Chat.jsx"));
const WeeklyReviews = lazy(() => import("../pages/shared/WeeklyReviews.jsx"));
const DocumentReviews = lazy(() => import("../pages/shared/DocumentReviews.jsx"));

// ── Admin ─────────────────────────────────────────────────────────────────
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard.jsx"));
const AcademicYears = lazy(() => import("../pages/admin/AcademicYears.jsx"));
const Semesters = lazy(() => import("../pages/admin/Semesters.jsx"));
const Subjects = lazy(() => import("../pages/admin/Subjects.jsx"));
const Faculty = lazy(() => import("../pages/admin/Faculty.jsx"));
const Domains = lazy(() => import("../pages/admin/Domains.jsx"));
const Mentors = lazy(() => import("../pages/admin/Mentors.jsx"));
const Students = lazy(() => import("../pages/admin/Students.jsx"));
const MilestoneTemplates = lazy(() => import("../pages/admin/MilestoneTemplates.jsx"));
const Reports = lazy(() => import("../pages/admin/Reports.jsx"));
const Analytics = lazy(() => import("../pages/admin/Analytics.jsx"));

// ── Faculty ───────────────────────────────────────────────────────────────
const FacultyDashboard = lazy(() => import("../pages/faculty/FacultyDashboard.jsx"));
const IdeaReviews = lazy(() => import("../pages/faculty/IdeaReviews.jsx"));
const Evaluations = lazy(() => import("../pages/faculty/Evaluations.jsx"));

// ── Mentor ────────────────────────────────────────────────────────────────
const MentorDashboard = lazy(() => import("../pages/mentor/MentorDashboard.jsx"));
const Meetings = lazy(() => import("../pages/mentor/Meetings.jsx"));

// ── Student ───────────────────────────────────────────────────────────────
const StudentDashboard = lazy(() => import("../pages/student/StudentDashboard.jsx"));
const MyProjects = lazy(() => import("../pages/student/MyProjects.jsx"));
const StudentProgress = lazy(() => import("../pages/student/Progress.jsx"));

/* ────────────────────────────────────────────────────────────────────────── */

function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 320,
        gap: 14,
      }}
    >
      <div className="spinner" style={{ width: 30, height: 30 }} />
      <span style={{ color: "var(--slate-500)", fontSize: "0.8125rem" }}>Loading…</span>
    </div>
  );
}

/** Gate a route on authentication and (optionally) role. */
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || "/"} replace />;
  }
  return children;
}

/** Signed-in users go to their dashboard; everyone else sees the login page. */
function RootRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--navy-950)",
        }}
      >
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (user) return <Navigate to={ROLE_HOME[user.role] || "/admin"} replace />;
  return <Login />;
}

function NotFound() {
  const { user } = useAuth();
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "3.5rem" }}>🔍</div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Page not found</h1>
      <p style={{ color: "var(--slate-400)", fontSize: "0.9rem" }}>
        The page you're looking for doesn't exist or has moved.
      </p>
      <a href={user ? ROLE_HOME[user.role] : "/"} className="btn btn-primary">
        {user ? "Back to dashboard" : "Go to sign in"}
      </a>
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/activate/:token" element={<Activate />} />

        {/* ── Admin ───────────────────────────────────────────────────── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="academic-years" element={<AcademicYears />} />
          <Route path="semesters" element={<Semesters />} />
          <Route path="subjects" element={<Subjects />} />
          <Route path="faculty" element={<Faculty />} />
          <Route path="domains" element={<Domains />} />
          <Route path="mentors" element={<Mentors />} />
          <Route path="students" element={<Students />} />
          <Route path="projects" element={<ProjectsList />} />
          <Route path="projects/:id" element={<ProjectDetails />} />
          <Route path="milestones" element={<MilestoneTemplates />} />
          <Route path="presentations" element={<Presentations />} />
          <Route path="reports" element={<Reports />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="chat" element={<Chat />} />
          <Route path="profile" element={<Settings />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* ── Faculty ─────────────────────────────────────────────────── */}
        <Route
          path="/faculty"
          element={
            <ProtectedRoute allowedRoles={["FACULTY"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<FacultyDashboard />} />
          <Route path="projects" element={<ProjectsList />} />
          <Route path="projects/:id" element={<ProjectDetails />} />
          <Route path="idea-reviews" element={<IdeaReviews />} />
          <Route path="weekly-reviews" element={<WeeklyReviews />} />
          <Route path="documents" element={<DocumentReviews />} />
          <Route path="presentations" element={<Presentations />} />
          <Route path="evaluations" element={<Evaluations />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="chat" element={<Chat />} />
          <Route path="profile" element={<Settings />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* ── Mentor ──────────────────────────────────────────────────── */}
        <Route
          path="/mentor"
          element={
            <ProtectedRoute allowedRoles={["MENTOR"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<MentorDashboard />} />
          <Route path="projects" element={<ProjectsList />} />
          <Route path="projects/:id" element={<ProjectDetails />} />
          <Route path="weekly-reviews" element={<WeeklyReviews />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="documents" element={<DocumentReviews />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="chat" element={<Chat />} />
          <Route path="profile" element={<Settings />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* ── Student ─────────────────────────────────────────────────── */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<StudentDashboard />} />
          <Route path="projects" element={<MyProjects />} />
          <Route path="projects/:id" element={<ProjectDetails />} />
          <Route path="progress" element={<StudentProgress />} />
          <Route path="documents" element={<MyProjects />} />
          <Route path="presentations" element={<Presentations />} />
          <Route path="chat" element={<Chat />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Settings />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}



