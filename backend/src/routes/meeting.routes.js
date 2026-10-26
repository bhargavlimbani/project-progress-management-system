const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const schemas = require("../validators");
const {
  getMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  cancelMeeting,
  completeMeeting,
  deleteMeeting,
  sendUpcomingMeetingReminders,
} = require("../controllers/meeting.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", getMeetings);
router.get("/:id", getMeetingById);
router.post("/", authorize("ADMIN", "FACULTY", "MENTOR"), validate(schemas.meeting), createMeeting);
router.put("/:id", authorize("ADMIN", "FACULTY", "MENTOR"), updateMeeting);
router.post("/:id/cancel", authorize("ADMIN", "FACULTY", "MENTOR"), cancelMeeting);
router.post("/:id/complete", authorize("ADMIN", "FACULTY", "MENTOR"), completeMeeting);
router.delete("/:id", authorize("ADMIN", "FACULTY", "MENTOR"), deleteMeeting);

// Automated or manual reminder trigger
router.post("/reminders/trigger", authorize("ADMIN", "FACULTY", "MENTOR"), async (req, res, next) => {
  try {
    const result = await sendUpcomingMeetingReminders();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
