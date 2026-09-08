const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const schemas = require("../validators");
const { getFaculty, getFacultyById, createFaculty, updateFaculty, deleteFaculty, resetFacultyPassword } = require("../controllers/faculty.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", getFaculty);
router.get("/:id", getFacultyById);
router.post("/", authorize("ADMIN"), validate(schemas.faculty), createFaculty);
router.put("/:id", authorize("ADMIN"), updateFaculty);
router.delete("/:id", authorize("ADMIN"), deleteFaculty);
router.post("/:id/reset-password", authorize("ADMIN"), resetFacultyPassword);

module.exports = router;
