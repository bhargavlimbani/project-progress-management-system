require("dotenv").config();

/**
 * Centralised environment access. Every module reads config from here
 * rather than touching process.env directly, so defaults and parsing
 * live in exactly one place.
 */
const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),

  databaseUrl: process.env.DATABASE_URL,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpires: process.env.JWT_ACCESS_EXPIRES || "8h",
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || "7d",
  },

  // Comma-separated list of allowed browser origins
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  appBaseUrl: process.env.APP_BASE_URL || "http://localhost:5173",

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || "SAPMS <no-reply@sapms.edu>",
    get enabled() {
      return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
    },
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    get enabled() {
      return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET
      );
    },
  },

  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB || 50),

  rateLimit: {
    windowMinutes: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15),
    max: Number(process.env.RATE_LIMIT_MAX || 500),
    authMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  },
};

/** Fail fast on missing critical config rather than 500-ing at request time. */
function assertRequiredEnv() {
  const missing = [];
  if (!env.databaseUrl) missing.push("DATABASE_URL");
  if (!env.jwt.accessSecret) missing.push("JWT_ACCESS_SECRET");
  if (!env.jwt.refreshSecret) missing.push("JWT_REFRESH_SECRET");

  if (missing.length) {
    console.error(
      `\n Missing required environment variables: ${missing.join(", ")}\n` +
        `   Copy backend/.env.example to backend/.env and fill them in.\n`
    );
    process.exit(1);
  }
}

module.exports = { env, assertRequiredEnv };
