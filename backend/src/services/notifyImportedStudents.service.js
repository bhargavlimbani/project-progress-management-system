const { sendTemplate } = require("./email.service");

/**
 * Fire-and-forget: import confirmation shouldn't block on email delivery.
 * If SMTP isn't configured (e.g. local dev), email.service logs the link
 * instead of throwing, so the rest of the import flow still works.
 */
function queueActivationEmail({ to, name, activationLink }) {
  sendTemplate("activation", to, { name, activationLink });
}

module.exports = { queueActivationEmail };
