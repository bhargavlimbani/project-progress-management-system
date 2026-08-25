const nodemailer = require("nodemailer");
const { env } = require("../config/env");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtp.enabled) return null; // email disabled in local/demo mode
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  return transporter;
}

/** Shared shell so every SAPMS email looks like it came from the same product. */
function layout({ heading, body, ctaLabel, ctaUrl }) {
  return `
  <div style="background:#f1f5f9;padding:32px 0;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);">
      <div style="background:linear-gradient(135deg,#0a1628 0%,#7c3aed 100%);padding:28px 32px;">
        <div style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:0.05em;">SAPMS</div>
        <div style="color:rgba(255,255,255,0.75);font-size:12px;margin-top:2px;">
          Smart Academic Project Management System
        </div>
      </div>
      <div style="padding:32px;">
        <h1 style="margin:0 0 16px;font-size:19px;color:#0f172a;">${heading}</h1>
        <div style="font-size:14px;line-height:1.65;color:#475569;">${body}</div>
        ${
          ctaUrl
            ? `<div style="margin-top:28px;">
                 <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#3b82f6);color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
                   ${ctaLabel || "Open SAPMS"}
                 </a>
               </div>`
            : ""
        }
      </div>
      <div style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
        Track Every Project. Every Week. Every Milestone. &middot; ICT Department
      </div>
    </div>
  </div>`;
}

/**
 * Fire-and-forget send. Callers are user-facing request handlers, so a mail
 * failure must never bubble up and fail the operation that triggered it.
 * With SMTP unconfigured this logs instead, keeping the app runnable locally.
 */
function sendMail({ to, subject, heading, body, ctaLabel, ctaUrl }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email disabled] To: ${to} | ${subject}${ctaUrl ? ` | ${ctaUrl}` : ""}`);
    return Promise.resolve({ skipped: true });
  }
  return t
    .sendMail({
      from: env.smtp.from,
      to,
      subject,
      html: layout({ heading, body, ctaLabel, ctaUrl }),
    })
    .catch((err) => {
      console.error(`Failed to send email to ${to}:`, err.message);
      return { failed: true };
    });
}

// ── Templates (spec §46) ──────────────────────────────────────────────────

const templates = {
  activation: ({ name, activationLink }) => ({
    subject: "Your SAPMS student account is ready",
    heading: `Welcome, ${name}`,
    body: `<p>An account has been created for you on the Smart Academic Project Management System.</p>
           <p>Set your own password to activate it. This link is single-use and expires in 7 days.</p>`,
    ctaLabel: "Activate my account",
    ctaUrl: activationLink,
  }),

  weeklyReminder: ({ name, weekNumber, projectTitle, dueLabel, link }) => ({
    subject: `Week ${weekNumber} progress is due ${dueLabel}`,
    heading: `Your Week ${weekNumber} submission is due ${dueLabel}`,
    body: `<p>Hi ${name},</p>
           <p>Your weekly progress for <strong>${projectTitle}</strong> has not been submitted yet.
           Remember to attach evidence — a screenshot, GitHub link or demo URL.</p>`,
    ctaLabel: "Submit progress",
    ctaUrl: link,
  }),

  pendingReviews: ({ name, count, link }) => ({
    subject: `${count} weekly submission${count === 1 ? "" : "s"} awaiting your review`,
    heading: `${count} submission${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} your review`,
    body: `<p>Hi ${name},</p>
           <p>Students are waiting on your feedback before they can move forward.</p>`,
    ctaLabel: "Review submissions",
    ctaUrl: link,
  }),

  atRiskDigest: ({ name, count, link }) => ({
    subject: `${count} project${count === 1 ? " is" : "s are"} currently at risk`,
    heading: `${count} project${count === 1 ? " is" : "s are"} falling behind`,
    body: `<p>Hi ${name},</p>
           <p>Actual progress has dropped meaningfully below the expected pace for these projects.
           Early intervention is usually enough to bring them back on track.</p>`,
    ctaLabel: "View at-risk projects",
    ctaUrl: link,
  }),

  statusChange: ({ name, title, message, link }) => ({
    subject: title,
    heading: title,
    body: `<p>Hi ${name},</p><p>${message}</p>`,
    ctaLabel: "Open in SAPMS",
    ctaUrl: link,
  }),
};

/** Send one of the named templates above. */
function sendTemplate(templateName, to, data) {
  const build = templates[templateName];
  if (!build) throw new Error(`Unknown email template: ${templateName}`);
  return sendMail({ to, ...build(data) });
}

module.exports = { sendMail, sendTemplate, templates };
