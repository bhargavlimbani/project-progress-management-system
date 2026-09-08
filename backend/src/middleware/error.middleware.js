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
      // P2003 fires in BOTH directions: a child still referencing this row,
      // and this row pointing at a parent that does not exist. The old message
      // only described the first and read as the opposite of what happened
      // when creating a record with a bad foreign key.
      return res.status(409).json({
        message:
          "A related record is missing or still in use. Check that any linked " +
          "records exist, and that nothing else still depends on this one.",
      });
    case "P1001":
      return res.status(503).json({
        message: "Cannot reach the database. Is PostgreSQL running?",
      });
    default:
      break;
  }

  /**
   * A malformed value (e.g. `NaN` from parseInt on a non-numeric field, or a
   * wrong type) fails Prisma's own argument validation. That is bad input, not
   * a server fault — answer 400 rather than leaking a query stack in a 500.
   */
  if (err.name === "PrismaClientValidationError") {
    return res.status(400).json({
      message: "One or more fields have an invalid value or type.",
      ...(env.nodeEnv !== "production" && { details: { prisma: err.message.split("\n").pop() } }),
    });
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
