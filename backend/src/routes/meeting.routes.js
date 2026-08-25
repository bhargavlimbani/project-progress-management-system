const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const schemas = require("../validators");
const {
  getMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
} = require("../controllers/meeting.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", getMeetings);
router.post("/", authorize("ADMIN", "FACULTY", "MENTOR"), validate(schemas.meeting), createMeeting);
router.put("/:id", authorize("ADMIN", "FACULTY", "MENTOR"), updateMeeting);
router.delete("/:id", authorize("ADMIN", "FACULTY", "MENTOR"), deleteMeeting);

module.exports = router;
