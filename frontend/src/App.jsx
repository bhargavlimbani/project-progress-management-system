import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext.jsx";
import AppRoutes from "./routes/index.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />

        {/* One toaster for the whole app — the dashboard layout doesn't mount its own. */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "var(--navy-800)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: "12px",
              fontSize: "0.875rem",
              boxShadow: "var(--shadow-xl)",
              maxWidth: 420,
            },
            success: { iconTheme: { primary: "#22c55e", secondary: "#0f2040" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#0f2040" } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
