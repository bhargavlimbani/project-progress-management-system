const https = require("https");
const prisma = require("../config/prisma");
const { env } = require("../config/env");
const { sendMail } = require("./email.service");
const { notifyUser, notifyStudent } = require("./notification.service");

/**
 * Clean phone number to digits only (with country code, e.g. 919876543210).
 */
function normalizePhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) {
    digits = "91" + digits; // Default India if 10 digits
  }
  return digits;
}

/**
 * Generate manual WhatsApp Web/App share link as guaranteed fallback.
 */
function getManualWhatsAppShareUrl({ phone, message }) {
  const clean = normalizePhone(phone);
  const text = encodeURIComponent(message || "");
  return clean ? `https://wa.me/${clean}?text=${text}` : `https://wa.me/?text=${text}`;
}

/**
 * Send official WhatsApp message via Meta Cloud API.
 */
function sendWhatsAppApi({ to, message }) {
  return new Promise((resolve, reject) => {
    if (!env.whatsapp.enabled) {
      return resolve({ skipped: true, reason: "WhatsApp provider not configured" });
    }

    const recipient = normalizePhone(to);
    if (!recipient) {
      return resolve({ skipped: true, reason: "Invalid phone number" });
    }

    const payload = JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "text",
      text: { preview_url: true, body: message },
    });

    const options = {
      hostname: "graph.facebook.com",
      path: `/v20.0/${env.whatsapp.phoneNumberId}/messages`,
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.whatsapp.accessToken}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(body);
            resolve({ success: true, data });
          } catch {
            resolve({ success: true, body });
          }
        } else {
          resolve({ failed: true, status: res.statusCode, error: body });
        }
      });
    });

    req.on("error", (err) => resolve({ failed: true, error: err.message }));
    req.write(payload);
    req.end();
  });
}

/**
 * Send SMS message via Twilio REST API.
 */
function sendSmsApi({ to, message }) {
  return new Promise((resolve) => {
    if (!env.sms.enabled) {
      return resolve({ skipped: true, reason: "SMS provider not configured" });
    }

    const recipient = normalizePhone(to);
    if (!recipient) {
      return resolve({ skipped: true, reason: "Invalid recipient phone number" });
    }

    const data = new URLSearchParams({
      To: recipient.startsWith("+") ? recipient : `+${recipient}`,
      From: env.sms.fromNumber,
      Body: message,
    }).toString();

    const auth = Buffer.from(`${env.sms.accountSid}:${env.sms.authToken}`).toString("base64");
    const options = {
      hostname: "api.twilio.com",
      path: `/2010-04-01/Accounts/${env.sms.accountSid}/Messages.json`,
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, body });
        } else {
          resolve({ failed: true, status: res.statusCode, error: body });
        }
      });
    });

    req.on("error", (err) => resolve({ failed: true, error: err.message }));
    req.write(data);
    req.end();
  });
}

/**
 * Dispatch notification through multiple channels with deduplication tracking.
 *
 * @param {Object} options
 * @param {string} options.dedupKey - Unique key to prevent duplicates (e.g. `event-reminder-123-24h`)
 * @param {Array<'IN_APP'|'EMAIL'|'WHATSAPP'|'SMS'>} options.channels
 * @param {Object} options.recipient - { id, email, mobile, name, isStudent, userId }
 * @param {string} options.title - Short title / subject
 * @param {string} options.body - Full message content
 * @param {string} [options.link] - Deep link URL
 * @param {Object} [options.metadata] - Extra structured metadata
 */
async function dispatchMultiChannel({
  dedupKey,
  channels = ["IN_APP"],
  recipient,
  title,
  body,
  link,
  metadata = {},
}) {
  const results = {};

  for (const channel of channels) {
    const channelDedupKey = `${dedupKey}:${channel}`;

    // 1. Deduplication check
    const existing = await prisma.notificationDelivery.findUnique({
      where: { dedupKey: channelDedupKey },
    });

    if (existing && existing.status === "SENT") {
      results[channel] = { skipped: true, reason: "Already delivered (dedup)" };
      continue;
    }

    let status = "PENDING";
    let error = null;

    try {
      if (channel === "IN_APP") {
        if (recipient.isStudent || recipient.studentId) {
          await notifyStudent({
            studentId: recipient.studentId || recipient.id,
            type: metadata.notificationType || "GENERAL",
            title,
            body,
            link,
          });
        } else if (recipient.userId || recipient.id) {
          await notifyUser({
            userId: recipient.userId || recipient.id,
            type: metadata.notificationType || "GENERAL",
            title,
            body,
            link,
          });
        }
        status = "SENT";
      } else if (channel === "EMAIL") {
        if (!recipient.email) {
          status = "SKIPPED";
          error = "No recipient email address";
        } else {
          const res = await sendMail({
            to: recipient.email,
            subject: title,
            heading: title,
            body: `<p>${body}</p>`,
            ctaLabel: "View in SAPMS",
            ctaUrl: link ? (link.startsWith("http") ? link : `${env.appBaseUrl}${link}`) : env.appBaseUrl,
          });
          if (res?.failed) {
            status = "FAILED";
            error = "Email provider delivery failed";
          } else if (res?.skipped) {
            status = "SKIPPED";
            error = "SMTP not configured (logged to console)";
          } else {
            status = "SENT";
          }
        }
      } else if (channel === "WHATSAPP") {
        if (!recipient.mobile) {
          status = "SKIPPED";
          error = "No recipient mobile number";
        } else {
          const res = await sendWhatsAppApi({
            to: recipient.mobile,
            message: `*${title}*\n\n${body}${link ? `\n\nLink: ${link.startsWith("http") ? link : `${env.appBaseUrl}${link}`}` : ""}`,
          });
          if (res.success) {
            status = "SENT";
          } else if (res.skipped) {
            status = "SKIPPED";
            error = res.reason;
          } else {
            status = "FAILED";
            error = res.error || "WhatsApp API failed";
          }
        }
      } else if (channel === "SMS") {
        if (!recipient.mobile) {
          status = "SKIPPED";
          error = "No recipient mobile number";
        } else {
          const res = await sendSmsApi({
            to: recipient.mobile,
            message: `${title}: ${body}`,
          });
          if (res.success) {
            status = "SENT";
          } else if (res.skipped) {
            status = "SKIPPED";
            error = res.reason;
          } else {
            status = "FAILED";
            error = res.error || "SMS API failed";
          }
        }
      }

      // Record / upsert delivery log
      await prisma.notificationDelivery.upsert({
        where: { dedupKey: channelDedupKey },
        create: {
          dedupKey: channelDedupKey,
          channel,
          recipient: recipient.email || recipient.mobile || recipient.id || "unknown",
          status,
          title,
          body,
          error,
          metadata,
          sentAt: status === "SENT" ? new Date() : null,
        },
        update: {
          status,
          error,
          sentAt: status === "SENT" ? new Date() : null,
        },
      });

      results[channel] = { status, error };
    } catch (err) {
      console.error(`Multi-channel dispatch error on ${channel}:`, err.message);
      results[channel] = { status: "FAILED", error: err.message };

      await prisma.notificationDelivery.upsert({
        where: { dedupKey: channelDedupKey },
        create: {
          dedupKey: channelDedupKey,
          channel,
          recipient: recipient.email || recipient.mobile || recipient.id || "unknown",
          status: "FAILED",
          title,
          body,
          error: err.message,
          metadata,
        },
        update: { status: "FAILED", error: err.message },
      }).catch(() => {});
    }
  }

  return results;
}

module.exports = {
  dispatchMultiChannel,
  getManualWhatsAppShareUrl,
  sendWhatsAppApi,
  sendSmsApi,
  normalizePhone,
};
