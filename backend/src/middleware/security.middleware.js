const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { ipKeyGenerator } = require("express-rate-limit");
const cors = require("cors");
const { env } = require("../config/env");

/**
 * Secure HTTP headers. `crossOriginResourcePolicy` is relaxed so the
 * separate Vite origin can still load files served from /uploads.
 */
const secureHeaders = helmet({
  contentSecurityPolicy: false, // the API serves JSON + static uploads, not HTML
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

/**
 * CORS restricted to configured client origins. Requests without an Origin
 * header (curl, server-to-server, health checks) are allowed through.
 */
const corsMiddleware = cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (env.clientOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  credentials: true,
});

/** Broad limiter applied to the whole API surface. */
const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMinutes * 60 * 1000,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down and try again shortly." },
});

/**
 * Tight limiter for credential endpoints — keyed by IP plus the submitted
 * email so one attacker cannot lock out every account from a shared address.
 */
const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMinutes * 60 * 1000,
  max: env.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  // ipKeyGenerator normalises IPv6 to its /64 prefix — using req.ip raw would
  // let an IPv6 client rotate addresses within its own subnet to evade the limit.
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${(req.body?.email || "").toLowerCase()}`,
  message: { message: "Too many login attempts. Please try again in a few minutes." },
});

module.exports = { secureHeaders, corsMiddleware, apiLimiter, authLimiter };
