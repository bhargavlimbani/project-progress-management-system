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

router.get("/", getStudents);
// Must precede /:id so "export" isn't parsed as a student id.
router.get("/export", authorize("ADMIN"), exportStudents);
router.get("/:id", getStudentById);
router.post("/", authorize("ADMIN"), validate(schemas.student), createStudent);
router.put("/:id", authorize("ADMIN"), updateStudent);
router.delete("/:id", authorize("ADMIN"), deleteStudent);
router.post("/:id/reset-password", authorize("ADMIN"), resetStudentPassword);

module.exports = router;
