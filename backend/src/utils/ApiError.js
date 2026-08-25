/**
 * Error carrying an HTTP status code. Thrown from controllers/services and
 * turned into a JSON response by the centralised error handler.
 */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  static badRequest(message = "Bad request.", details) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Unauthenticated.") {
    return new ApiError(401, message);
  }
  static forbidden(message = "Forbidden: insufficient permissions.") {
    return new ApiError(403, message);
  }
  static notFound(message = "Record not found.") {
    return new ApiError(404, message);
  }
  static conflict(message = "This value already exists.") {
    return new ApiError(409, message);
  }
}

module.exports = ApiError;
