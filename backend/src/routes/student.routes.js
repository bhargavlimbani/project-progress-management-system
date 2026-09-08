const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const schemas = require("../validators");
const {
  getStudents, getStudentById, createStudent, updateStudent, deleteStudent,
  resetStudentPassword, activateStudentAccount, exportStudents,
} = require("../controllers/student.controller");

const router = express.Router();

// Public route for account activation
router.post("/activate/:token", activateStudentAccount);

router.use(authenticate);

// The roster carries every student's email and mobile — staff only.
router.get("/", authorize("ADMIN", "FACULTY", "MENTOR"), getStudents);
// Must precede /:id so "export" isn't parsed as a student id.
router.get("/export", authorize("ADMIN"), exportStudents);
router.get("/:id", authorize("ADMIN", "FACULTY", "MENTOR"), getStudentById);
router.post("/", authorize("ADMIN"), validate(schemas.student), createStudent);
// Same field rules as create — otherwise an update could set a malformed
// email or a 5-digit mobile that POST would have rejected.
router.put("/:id", authorize("ADMIN"), validate(schemas.studentUpdate), updateStudent);
router.delete("/:id", authorize("ADMIN"), deleteStudent);
router.post("/:id/reset-password", authorize("ADMIN"), resetStudentPassword);

module.exports = router;
