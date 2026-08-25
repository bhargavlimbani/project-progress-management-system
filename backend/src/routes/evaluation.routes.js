const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const schemas = require("../validators");
const {
  getEvaluations,
  getProjectEvaluation,
  submitEvaluation,
  getCriteria,
  upsertCriteria,
} = require("../controllers/evaluation.controller");

const router = express.Router();
router.use(authenticate);

// Configurable criteria per subject (spec §50)
router.get("/criteria/:subjectId", getCriteria);
router.put("/criteria/:subjectId", authorize("ADMIN"), validate(schemas.evaluationCriteria), upsertCriteria);

// Mark sheets
router.get("/", getEvaluations);
router.get("/project/:projectId", getProjectEvaluation);
router.post(
  "/project/:projectId",
  authorize("ADMIN", "FACULTY"),
  validate(schemas.evaluationMarks),
  submitEvaluation
);

module.exports = router;
