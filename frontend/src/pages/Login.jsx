import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import {
  Eye, EyeOff, Loader2, Zap, AlertCircle, CheckCircle2, ArrowRight,
  TrendingUp, ShieldCheck, CalendarCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { authApi } from "../services/index.js";
import { apiErrorMessage } from "../utils/format.js";
import { ROLE_HOME } from "../utils/constants.js";
import Scene3D from "../features/login/Scene3D.jsx";

/**
 * Login (spec §60–§63). The 3D environment lives on the left; the right side
 * is a glassmorphism card. This is the only screen with heavy 3D — dashboards
 * stay 2D so they stay fast.
 */
export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { remember: true } });

  const onSubmit = async ({ email, password, remember }) => {
    setServerError("");
    setSubmitting(true);

    try {
      const { data } = await authApi.login({ email: email.trim(), password });

      // Without "remember me" we keep only the short-lived access token, so the
      // session ends when it expires instead of silently refreshing for a week.
      login(data.user, data.accessToken, remember ? data.refreshToken : null);

      setSuccess(true);
      setTimeout(() => navigate(ROLE_HOME[data.user.role] || "/", { replace: true }), 550);
    } catch (err) {
      setServerError(apiErrorMessage(err, "Sign in failed. Check your credentials and try again."));
      setSubmitting(false);
    }
  };

  return (
    <div className="login-root">
      {/* ── Left: the 3D environment ─────────────────────────────────── */}
      <section className="login-stage">
        <Scene3D />

        <motion.header
          className="login-brand"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="login-brand-mark">
            <Zap size={22} color="#fff" />
          </span>
          <span>
            <span className="login-brand-name">SAPMS</span>
            <span className="login-brand-full">Smart Academic Project Management System</span>
          </span>
        </motion.header>

        <motion.div
          className="login-copy"
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
        >
          <h1 className="login-headline">
            Track Every Project.
            <br />
            Every Week. Every Milestone.
          </h1>

          <p className="login-body">
            Manage academic projects, monitor weekly progress, collaborate with mentors, review
            documentation, and complete projects on time — all from one centralized platform.
          </p>

          <div className="login-pills">
            {[
              { icon: TrendingUp, text: "Expected vs actual progress" },
              { icon: ShieldCheck, text: "Evidence-based reviews" },
              { icon: CalendarCheck, text: "Weekly, not the last 15 days" },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="login-pill">
                <Icon size={13} />
                {text}
              </span>
            ))}
          </div>

          <p className="login-dept">ICT Department · Start Early. Track Weekly. Complete On Time.</p>
        </motion.div>
      </section>

      {/* ── Right: the sign-in card ──────────────────────────────────── */}
      <section className="login-panel">
        <motion.div
          className={`login-card ${success ? "is-success" : ""}`}
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Mobile-only brand — the 3D stage is hidden on small screens */}
          <div className="login-card-brand">
            <span className="login-brand-mark">
              <Zap size={22} color="#fff" />
            </span>
            <span className="login-brand-name">SAPMS</span>
          </div>

          <div style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: 6 }}>Welcome back</h2>
            <p style={{ color: "var(--slate-400)", fontSize: "0.875rem" }}>
              Sign in to continue to your dashboard.
            </p>
          </div>

          {serverError && (
            <motion.div
              className="login-alert login-alert-error"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              role="alert"
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {serverError}
            </motion.div>
          )}

          {success && (
            <motion.div
              className="login-alert login-alert-success"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              role="status"
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              Signed in — taking you to your dashboard…
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" htmlFor="login-email">
                Email / Enrollment Number
              </label>
              <input
                id="login-email"
                className="form-input"
                type="text"
                autoComplete="username"
                placeholder="you@college.edu or 22ICT001"
                aria-invalid={Boolean(errors.email)}
                disabled={submitting || success}
                {...register("email", { required: "Enter your email or enrollment number." })}
              />
              {errors.email && <span className="form-error">{errors.email.message}</span>}
            </div>

            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  className="form-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  style={{ paddingRight: 46 }}
                  aria-invalid={Boolean(errors.password)}
                  disabled={submitting || success}
                  {...register("password", { required: "Enter your password." })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 13,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--slate-400)",
                    display: "flex",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="form-error">{errors.password.message}</span>}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  {...register("remember")}
                  style={{ accentColor: "var(--purple-500)", width: 16, height: 16 }}
                />
                <span style={{ fontSize: "0.875rem", color: "var(--slate-400)" }}>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() =>
                  setServerError(
                    "Password resets are handled by your administrator — please contact the ICT department office."
                  )
                }
                style={{ fontSize: "0.875rem", color: "var(--purple-400)", fontWeight: 600 }}
              >
                Forgot password?
              </button>
            </div>

            <motion.button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: "100%", justifyContent: "center" }}
              disabled={submitting || success}
              whileHover={submitting || success ? undefined : { scale: 1.015 }}
              whileTap={submitting || success ? undefined : { scale: 0.985 }}
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="spin" />
                  Signing in…
                </>
              ) : success ? (
                <>
                  <CheckCircle2 size={18} />
                  Redirecting…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={17} />
                </>
              )}
            </motion.button>
          </form>

          <p
            style={{
              marginTop: 22,
              fontSize: "0.75rem",
              color: "var(--slate-500)",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            Students: use the activation link emailed to you to set your password before your first
            sign-in.
          </p>
        </motion.div>

        <p className="login-footer">© {new Date().getFullYear()} SAPMS · ICT Department</p>
      </section>

      <LoginStyles />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function LoginStyles() {
  return (
    <style>{`
      .login-root {
        min-height: 100vh;
        display: flex;
        background: var(--navy-950);
        position: relative;
        overflow: hidden;
      }

      /* ── Left stage ───────────────────────────────────────────────── */
      .login-stage {
        flex: 1;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 40px 44px;
        overflow: hidden;
        min-width: 0;
      }

      .login-stage::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          radial-gradient(ellipse at 25% 25%, rgba(124,58,237,0.16) 0%, transparent 58%),
          radial-gradient(ellipse at 75% 78%, rgba(59,130,246,0.12) 0%, transparent 58%);
        pointer-events: none;
      }

      .login-brand {
        display: flex;
        align-items: center;
        gap: 14px;
        position: relative;
        z-index: 10;
      }

      .login-brand-mark {
        width: 46px; height: 46px;
        border-radius: 13px;
        background: linear-gradient(135deg, #7c3aed, #3b82f6);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 8px 26px rgba(124,58,237,0.5);
        flex-shrink: 0;
      }

      .login-brand-name {
        display: block;
        font-size: 1.3rem;
        font-weight: 800;
        color: #fff;
        letter-spacing: 0.06em;
        line-height: 1.1;
      }

      .login-brand-full {
        display: block;
        font-size: 0.7rem;
        color: rgba(148,163,184,0.72);
        font-weight: 500;
      }

      .login-copy {
        position: relative;
        z-index: 10;
        max-width: 560px;
      }

      .login-headline {
        font-size: clamp(1.8rem, 3.1vw, 2.6rem);
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -0.02em;
        margin-bottom: 14px;
        background: linear-gradient(120deg, #ffffff 35%, #a78bfa 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .login-body {
        font-size: 0.9375rem;
        color: rgba(148,163,184,0.88);
        line-height: 1.7;
        margin-bottom: 20px;
      }

      .login-pills { display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 20px; }

      .login-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 7px 14px;
        border-radius: 99px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.09);
        backdrop-filter: blur(10px);
        font-size: 0.78rem;
        font-weight: 600;
        color: rgba(203,213,225,0.92);
      }

      .login-dept {
        font-size: 0.7rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(148,163,184,0.45);
        font-weight: 600;
      }

      /* ── Right panel ──────────────────────────────────────────────── */
      .login-panel {
        width: 470px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 40px 46px;
        background: rgba(10,22,40,0.62);
        border-left: 1px solid rgba(255,255,255,0.07);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        position: relative;
        z-index: 20;
      }

      .login-card {
        background: rgba(15,32,64,0.66);
        border: 1px solid rgba(255,255,255,0.11);
        border-radius: 24px;
        padding: 36px;
        box-shadow: 0 34px 68px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
        transition: box-shadow 0.35s ease;
      }
      .login-card.is-success {
        box-shadow: 0 34px 68px rgba(0,0,0,0.5), 0 0 46px rgba(34,197,94,0.22);
      }

      /* Shown only when the 3D stage is hidden */
      .login-card-brand {
        display: none;
        align-items: center;
        gap: 12px;
        margin-bottom: 26px;
        padding-bottom: 22px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }

      .login-alert {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 12px 15px;
        border-radius: 11px;
        font-size: 0.8125rem;
        line-height: 1.5;
        margin-bottom: 20px;
        overflow: hidden;
      }
      .login-alert-error {
        background: rgba(239,68,68,0.1);
        border: 1px solid rgba(239,68,68,0.28);
        color: #f87171;
      }
      .login-alert-success {
        background: rgba(34,197,94,0.1);
        border: 1px solid rgba(34,197,94,0.28);
        color: #4ade80;
      }

      .login-footer {
        text-align: center;
        margin-top: 22px;
        font-size: 0.72rem;
        color: var(--slate-600);
      }

      /* ── Responsive ───────────────────────────────────────────────── */
      @media (max-width: 1180px) {
        .login-panel { width: 420px; padding: 40px 34px; }
      }

      @media (max-width: 980px) {
        .login-stage { display: none; }
        .login-panel {
          width: 100%;
          border-left: none;
          background: transparent;
          padding: 32px 20px;
        }
        .login-card-brand { display: flex; }
        .login-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 20% 15%, rgba(124,58,237,0.2) 0%, transparent 55%),
            radial-gradient(ellipse at 82% 85%, rgba(59,130,246,0.16) 0%, transparent 55%);
          pointer-events: none;
        }
      }

      @media (max-width: 480px) {
        .login-card { padding: 26px 22px; border-radius: 20px; }
      }
    `}</style>
  );
}
