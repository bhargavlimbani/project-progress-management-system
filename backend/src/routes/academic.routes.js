const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const schemas = require("../validators");
const {
  getAcademicYears, createAcademicYear, updateAcademicYear, activateAcademicYear, deleteAcademicYear,
  getSemesters, createSemester, deleteSemester,
} = require("../controllers/academic.controller");

const router = express.Router();
router.use(authenticate);

// Academic Years
router.get("/academic-years", getAcademicYears);
router.post("/academic-years", authorize("ADMIN"), validate(schemas.academicYear), createAcademicYear);
router.put("/academic-years/:id", authorize("ADMIN"), validate(schemas.academicYear), updateAcademicYear);
router.patch("/academic-years/:id/activate", authorize("ADMIN"), activateAcademicYear);
router.delete("/academic-years/:id", authorize("ADMIN"), deleteAcademicYear);

// Semesters
router.get("/semesters", getSemesters);
router.post("/semesters", authorize("ADMIN"), validate(schemas.semester), createSemester);
router.delete("/semesters/:id", authorize("ADMIN"), deleteSemester);

module.exports = router;
