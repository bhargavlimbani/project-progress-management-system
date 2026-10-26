const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const {
  getAttendance,
  recordAttendance,
  getAttendanceSummary,
  getSubjectStudents,
} = require("../controllers/attendance.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", getAttendance);
router.post("/", authorize("ADMIN", "FACULTY"), recordAttendance);
router.get("/summary/:subjectId", authorize("ADMIN", "FACULTY"), getAttendanceSummary);
router.get("/students/:subjectId", authorize("ADMIN", "FACULTY"), getSubjectStudents);

module.exports = router;
