/**
 * Shared validation predicates and builders used by every validator module.
 * Each validator is `(data) => ({ field: "message" })`; an empty object is valid.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

const isBlank = (v) => v === undefined || v === null || String(v).trim() === "";
const isEmail = (v) => EMAIL_RE.test(String(v).trim());
const isMobile = (v) => INDIAN_MOBILE_RE.test(String(v).replace(/[\s-]/g, ""));
const isUrl = (v) => URL_RE.test(String(v).trim());
const isUuid = (v) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));

/** Collects field errors so validators read as a flat list of rules. */
function checker() {
  const errors = {};
  const api = {
    required(field, value, label) {
      if (isBlank(value)) errors[field] = `${label || field} is required.`;
      return api;
    },
    email(field, value, label) {
      if (!isBlank(value) && !isEmail(value)) {
        errors[field] = `${label || field} must be a valid email address.`;
      }
      return api;
    },
    mobile(field, value, label) {
      if (!isBlank(value) && !isMobile(value)) {
        errors[field] = `${label || field} must be a valid 10-digit mobile number.`;
      }
      return api;
    },
    url(field, value, label) {
      if (!isBlank(value) && !isUrl(value)) {
        errors[field] = `${label || field} must start with http:// or https://`;
      }
      return api;
    },
    uuid(field, value, label) {
      if (!isBlank(value) && !isUuid(value)) {
        errors[field] = `${label || field} is not a valid identifier.`;
      }
      return api;
    },
    minLength(field, value, min, label) {
      if (!isBlank(value) && String(value).trim().length < min) {
        errors[field] = `${label || field} must be at least ${min} characters.`;
      }
      return api;
    },
    maxLength(field, value, max, label) {
      if (!isBlank(value) && String(value).length > max) {
        errors[field] = `${label || field} must be at most ${max} characters.`;
      }
      return api;
    },
    intRange(field, value, min, max, label) {
      if (isBlank(value)) return api;
      const n = Number(value);
      if (!Number.isInteger(n) || n < min || n > max) {
        errors[field] = `${label || field} must be a whole number between ${min} and ${max}.`;
      }
      return api;
    },
    numberRange(field, value, min, max, label) {
      if (isBlank(value)) return api;
      const n = Number(value);
      if (Number.isNaN(n) || n < min || n > max) {
        errors[field] = `${label || field} must be between ${min} and ${max}.`;
      }
      return api;
    },
    oneOf(field, value, allowed, label) {
      if (!isBlank(value) && !allowed.includes(value)) {
        errors[field] = `${label || field} must be one of: ${allowed.join(", ")}.`;
      }
      return api;
    },
    isoDate(field, value, label) {
      if (!isBlank(value) && Number.isNaN(Date.parse(value))) {
        errors[field] = `${label || field} must be a valid date.`;
      }
      return api;
    },
    custom(field, condition, message) {
      if (condition) errors[field] = message;
      return api;
    },
    result() {
      return errors;
    },
  };
  return api;
}

module.exports = {
  checker,
  isBlank,
  isEmail,
  isMobile,
  isUrl,
  isUuid,
  EMAIL_RE,
  INDIAN_MOBILE_RE,
};
