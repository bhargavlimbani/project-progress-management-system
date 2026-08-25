const ApiError = require("../utils/ApiError");

/**
 * Runs a validator against the request and rejects with a 400 carrying
 * per-field messages when anything fails.
 *
 * A validator is `(data) => ({ field: "message", ... })` — an empty object
 * means the payload is valid.
 *
 * Usage: router.post("/", validate(createSubject), controller.create)
 */
function validate(validator, source = "body") {
  return (req, res, next) => {
    const data = req[source] || {};
    const errors = validator(data) || {};
    if (Object.keys(errors).length > 0) {
      return next(ApiError.badRequest("Validation failed.", errors));
    }
    next();
  };
}

module.exports = { validate };
