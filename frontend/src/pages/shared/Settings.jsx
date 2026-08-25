import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Settings as SettingsIcon, User, KeyRound, ShieldCheck, Camera, Loader2,
  Activity, Mail, RefreshCw, Eye, EyeOff,
} from "lucide-react";
import { authApi, userApi, analyticsApi } from "../../services/index.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiErrorMessage, initials } from "../../utils/format.js";
import { PageHeader, Tabs } from "../../components/ui/index.js";

export default function Settings() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "profile");

  const tabs = [
    { key: "profile", label: "Profile", icon: User },
    { key: "password", label: "Password", icon: KeyRound },
  ];
  if (user?.role === "ADMIN") {
    tabs.push({ key: "system", label: "System", icon: ShieldCheck });
  }

  const changeTab = (key) => {
    setTab(key);
    setParams(key === "profile" ? {} : { tab: key }, { replace: true });
  };

  return (
    <>
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="Your profile, your credentials, and how SAPMS behaves."
        crumbs={[{ label: "Settings" }]}
      />

      <Tabs tabs={tabs} active={tab} onChange={changeTab} />

      {tab === "profile" && <ProfileSettings />}
      {tab === "password" && <PasswordSettings />}
      {tab === "system" && user?.role === "ADMIN" && <SystemSettings />}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function ProfileSettings() {
  const { user, updateUser } = useAuth();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    name: user?.name || "",
    mobile: user?.mobile || user?.faculty?.mobile || user?.mentor?.mobile || "",
    designation: user?.faculty?.designation || "",
    expertise: user?.mentor?.expertise || "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await userApi.updateProfile(form);
      updateUser({ name: data.name ?? form.name });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Profile photo must be an image.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const { data } = await userApi.uploadAvatar(formData);
      updateUser({ profilePhoto: data.profilePhoto });
      toast.success("Photo updated.");
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: 24, maxWidth: 700 }}>
      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6" style={{ flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          {user?.profilePhoto ? (
            <img src={user.profilePhoto} alt="" className="avatar" width={78} height={78} />
          ) : (
            <span
              className="avatar-placeholder"
              style={{ width: 78, height: 78, fontSize: "1.4rem" }}
            >
              {initials(user?.name)}
            </span>
          )}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Change profile photo"
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "var(--gradient-glow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--navy-900)",
            }}
          >
            {uploading ? (
              <Loader2 size={13} color="#fff" className="spin" />
            ) : (
              <Camera size={13} color="#fff" />
            )}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={(e) => {
              uploadPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <div>
          <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>{user?.name}</div>
          <div style={{ fontSize: "0.8125rem", color: "var(--slate-400)" }}>{user?.email}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <span className="badge badge-purple">{user?.role}</span>
            {user?.enrollmentNumber && (
              <span className="badge badge-blue">{user.enrollmentNumber}</span>
            )}
            {user?.faculty?.facultyId && (
              <span className="badge badge-blue">{user.faculty.facultyId}</span>
            )}
            {user?.mentor?.mentorId && (
              <span className="badge badge-blue">{user.mentor.mentorId}</span>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={save}>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className="form-input"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" value={user?.email || ""} disabled />
            <span style={{ fontSize: "0.7rem", color: "var(--slate-500)" }}>
              Email is your sign-in identity — an admin must change it.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Mobile</label>
            <input
              className="form-input"
              placeholder="9876543210"
              value={form.mobile}
              onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
            />
          </div>

          {user?.role === "FACULTY" && (
            <div className="form-group">
              <label className="form-label">Designation</label>
              <input
                className="form-input"
                value={form.designation}
                onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              />
            </div>
          )}

          {user?.role === "MENTOR" && (
            <div className="form-group form-grid-full">
              <label className="form-label">Expertise</label>
              <input
                className="form-input"
                placeholder="React, Node.js, Full-Stack"
                value={form.expertise}
                onChange={(e) => setForm((f) => ({ ...f, expertise: e.target.value }))}
              />
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: 20 }} disabled={saving}>
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </form>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function PasswordSettings() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const strength = passwordStrength(form.newPassword);

  const submit = async (e) => {
    e.preventDefault();

    if (form.newPassword !== form.confirm) {
      toast.error("The two new passwords don't match.");
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success("Password changed.");
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: 24, maxWidth: 520 }}>
      <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 4 }}>Change Password</h3>
      <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)", marginBottom: 20 }}>
        Use at least 8 characters, mixing letters, numbers and symbols.
      </p>

      <form onSubmit={submit}>
        <div className="form-group mb-4">
          <label className="form-label">Current Password</label>
          <input
            className="form-input"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
          />
        </div>

        <div className="form-group mb-4">
          <label className="form-label">New Password</label>
          <div style={{ position: "relative" }}>
            <input
              className="form-input"
              type={show ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              style={{ paddingRight: 44 }}
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide passwords" : "Show passwords"}
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

          {form.newPassword && (
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

        <div className="form-group mb-4">
          <label className="form-label">Confirm New Password</label>
          <input
            className="form-input"
            type={show ? "text" : "password"}
            required
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          />
          {form.confirm && form.confirm !== form.newPassword && (
            <span className="form-error">Passwords don't match.</span>
          )}
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          <KeyRound size={15} />
          {saving ? "Updating…" : "Change Password"}
        </button>
      </form>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

/** Admin-only maintenance actions (spec §41, §46). */
function SystemSettings() {
  const [running, setRunning] = useState(null);
  const [lastRun, setLastRun] = useState(null);

  const runMonitor = async () => {
    setRunning("monitor");
    try {
      const { data } = await analyticsApi.runMonitor();
      setLastRun(data);
      toast.success(
        `Scanned ${data.scanned} projects — ${data.atRisk} at risk, ${data.delayed} delayed.`
      );
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setRunning(null);
    }
  };

  const sendReminders = async () => {
    setRunning("reminders");
    try {
      const { data } = await analyticsApi.sendReminders();
      toast.success(`${data.remindersSent} weekly reminder(s) sent.`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 700 }}>
      <div className="glass-card" style={{ padding: 24 }}>
        <div className="flex items-start gap-3 mb-4">
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: "rgba(249,115,22,0.14)",
              border: "1px solid rgba(249,115,22,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Activity size={18} color="var(--orange-500)" />
          </div>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 3 }}>
              Expected vs Actual Progress Sweep
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)", lineHeight: 1.6 }}>
              Recalculates every active project's progress, advances its week from the calendar,
              and flags anything that has slipped behind. Runs automatically once a day — use this
              to run it right now.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={runMonitor}
          disabled={running !== null}
        >
          {running === "monitor" ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
          {running === "monitor" ? "Scanning…" : "Run sweep now"}
        </button>

        {lastRun && (
          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="stat-row">
              <span className="stat-row-label">Projects scanned</span>
              <span className="stat-row-value">{lastRun.scanned}</span>
            </div>
            <div className="stat-row">
              <span className="stat-row-label">Weeks advanced</span>
              <span className="stat-row-value">{lastRun.weekAdvanced}</span>
            </div>
            <div className="stat-row">
              <span className="stat-row-label">On track</span>
              <span className="stat-row-value" style={{ color: "var(--green-400)" }}>
                {lastRun.onTrack}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-row-label">At risk</span>
              <span className="stat-row-value" style={{ color: "var(--orange-500)" }}>
                {lastRun.atRisk}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-row-label">Delayed</span>
              <span className="stat-row-value" style={{ color: "var(--red-400)" }}>
                {lastRun.delayed}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: 24 }}>
        <div className="flex items-start gap-3 mb-4">
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: "rgba(59,130,246,0.14)",
              border: "1px solid rgba(59,130,246,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Mail size={18} color="var(--blue-400)" />
          </div>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 3 }}>
              Weekly Progress Reminders
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--slate-400)", lineHeight: 1.6 }}>
              Notifies and emails every student who hasn't submitted for the week their project is
              currently in. Safe to run more than once — it only targets missing submissions.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={sendReminders}
          disabled={running !== null}
        >
          {running === "reminders" ? <Loader2 size={15} className="spin" /> : <Mail size={15} />}
          {running === "reminders" ? "Sending…" : "Send reminders now"}
        </button>
      </div>
    </div>
  );
}

/** Cheap client-side strength hint — the real rule is the 8-char server minimum. */
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
