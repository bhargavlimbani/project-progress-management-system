const { env } = require("../config/env");
const ApiError = require("../utils/ApiError");

/** 404 handler — mounted after every route. */
function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` });
}

/**
 * Centralised error handler. Translates Prisma error codes and ApiError
 * instances into clean JSON; anything unrecognised becomes a generic 500 so
 * internals never leak to the client in production.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  switch (err.code) {
    case "P2002": {
      const fields = err.meta?.target;
      const label = Array.isArray(fields) ? fields.join(", ") : fields;
      return res.status(409).json({
        message: label
          ? `Duplicate value — ${label} is already in use.`
          : "Duplicate record — this value already exists.",
      });
    }
    case "P2025":
      return res.status(404).json({ message: "Record not found." });
    case "P2003":
      return res.status(409).json({
        message: "This record is still referenced by other data and cannot be changed.",
      });
    case "P1001":
      return res.status(503).json({
        message: "Cannot reach the database. Is PostgreSQL running?",
      });
    default:
      break;
  }

  // Prisma couldn't reach or authenticate against the database. This is an
  // operator problem, not a client one — say so plainly instead of dumping a
  // connection stack into an API response.
  if (err.name === "PrismaClientInitializationError") {
    console.error("Database connection failed:", err.message);
    return res.status(503).json({
      message:
        "The database is unavailable. Check that PostgreSQL is running and that DATABASE_URL in backend/.env is correct.",
    });
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  if (err.message?.includes("not allowed by CORS")) {
    return res.status(403).json({ message: err.message });
  }

  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    message: env.nodeEnv === "production" ? "Something went wrong." : err.message,
    ...(env.nodeEnv !== "production" && { stack: err.stack }),
  });
}

module.exports = { notFoundHandler, errorHandler };
