import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  KeyRound, Eye, EyeOff, CheckCircle2, Loader2, ShieldCheck, ArrowRight,
} from "lucide-react";
import { authApi } from "../services/index.js";
import { apiErrorMessage } from "../utils/format.js";

/**
 * Account activation for imported students (spec §26). The single-use token
 * arrives by email; passwords are never imported from the spreadsheet.
 */
export default function Activate() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const strength = passwordStrength(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords don't match.");
      return;
    }

    setSaving(true);
    try {
      await authApi.activate(token, { password });
      setDone(true);
      toast.success("Account activated — you can sign in now.");
      setTimeout(() => navigate("/"), 2200);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--navy-950)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow, matching the login page */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(124,58,237,0.18) 0%, transparent 60%), radial-gradient(ellipse at 75% 80%, rgba(59,130,246,0.12) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div
        className="glass-card"
        style={{ padding: 40, width: "100%", maxWidth: 460, position: "relative", zIndex: 1 }}
      >
        {done ? (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 68,
                height: 68,
                margin: "0 auto 18px",
                borderRadius: "50%",
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CheckCircle2 size={30} color="var(--green-400)" />
            </div>

            <h1 style={{ fontSize: "1.35rem", fontWeight: 800, marginBottom: 8 }}>
              Account activated
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--slate-400)", marginBottom: 24 }}>
              You can now sign in to SAPMS with your email and the password you just chose.
            </p>

            <Link to="/" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              Go to sign in
              <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div
                style={{
                  width: 60,
                  height: 60,
                  margin: "0 auto 16px",
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 26px rgba(124,58,237,0.45)",
                }}
              >
                <ShieldCheck size={26} color="#fff" />
              </div>

              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 6 }}>
                Activate your account
              </h1>
              <p style={{ fontSize: "0.875rem", color: "var(--slate-400)" }}>
                Choose a password to finish setting up your SAPMS account.
              </p>
            </div>

            <form onSubmit={submit}>
              <div className="form-group" style={{ marginBottom: 18 }}>
                <label className="form-label">New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    className="form-input"
                    type={show ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    style={{ paddingRight: 44 }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--slate-400)",
                      display: "flex",
                    }}
                  >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                {password && (
                  <div style={{ marginTop: 8 }}>
                    <div className="progress-bar-track" style={{ height: 4 }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${strength.score * 25}%`,
                          background: strength.color,
                          boxShadow: "none",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "0.7rem", color: strength.color, fontWeight: 600 }}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Confirm Password</label>
                <input
                  className="form-input"
                  type={show ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Type it again"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
                {mismatch && <span className="form-error">Passwords don't match.</span>}
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                style={{ width: "100%", justifyContent: "center" }}
                disabled={saving || mismatch || password.length < 8}
              >
                {saving ? <Loader2 size={18} className="spin" /> : <KeyRound size={17} />}
                {saving ? "Activating…" : "Activate Account"}
              </button>
            </form>

            <p
              style={{
                textAlign: "center",
                marginTop: 20,
                fontSize: "0.75rem",
                color: "var(--slate-500)",
              }}
            >
              Activation links are single-use.{" "}
              <Link to="/" style={{ color: "var(--purple-400)", fontWeight: 600 }}>
                Already activated? Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function passwordStrength(password) {
  if (!password) return { score: 0, label: "", color: "var(--slate-500)" };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  const levels = [
    { label: "Too short", color: "var(--red-400)" },
    { label: "Weak", color: "var(--red-400)" },
    { label: "Fair", color: "var(--yellow-400)" },
    { label: "Good", color: "var(--blue-400)" },
    { label: "Strong", color: "var(--green-400)" },
  ];

  return { score, ...levels[score] };
}
