const crypto = require("crypto");

function generateActivationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function buildActivationLink(baseUrl, token) {
  return `${baseUrl.replace(/\/$/, "")}/activate/${token}`;
}

module.exports = { generateActivationToken, buildActivationLink };
