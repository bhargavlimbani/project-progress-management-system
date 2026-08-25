const express = require("express");
const { login, refreshToken, getMe, changePassword } = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const schemas = require("../validators");

const router = express.Router();

router.post("/login", validate(schemas.login), login);
router.post("/refresh", refreshToken);
router.get("/me", authenticate, getMe);
router.post(
  "/change-password",
  authenticate,
  validate(schemas.changePassword),
  changePassword
);

module.exports = router;
