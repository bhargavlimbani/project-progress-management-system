const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const schemas = require("../validators");
const { getMentors, getMentorById, createMentor, updateMentor, deleteMentor, resetMentorPassword } = require("../controllers/mentor.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", getMentors);
router.get("/:id", getMentorById);
router.post("/", authorize("ADMIN"), validate(schemas.mentor), createMentor);
router.put("/:id", authorize("ADMIN"), updateMentor);
router.delete("/:id", authorize("ADMIN"), deleteMentor);
router.post("/:id/reset-password", authorize("ADMIN"), resetMentorPassword);

module.exports = router;
