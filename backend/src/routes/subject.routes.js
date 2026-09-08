const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const schemas = require("../validators");
const {
  getSubjects, getSubjectById, createSubject, updateSubject, deleteSubject,
  getEvaluationCriteria, upsertEvaluationCriteria,
  getMilestoneTemplates, upsertMilestoneTemplates,
} = require("../controllers/subject.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", getSubjects);
router.get("/:id", getSubjectById);
router.post("/", authorize("ADMIN"), validate(schemas.subject), createSubject);
router.put("/:id", authorize("ADMIN", "FACULTY"), updateSubject);
router.delete("/:id", authorize("ADMIN"), deleteSubject);

// Evaluation criteria
router.get("/:subjectId/evaluation-criteria", getEvaluationCriteria);
router.put(
  "/:subjectId/evaluation-criteria",
  authorize("ADMIN", "FACULTY"),
  validate(schemas.evaluationCriteria),
  upsertEvaluationCriteria
);

// Milestone templates
router.get("/:subjectId/milestone-templates", getMilestoneTemplates);
router.put("/:subjectId/milestone-templates", authorize("ADMIN", "FACULTY"), upsertMilestoneTemplates);

module.exports = router;
