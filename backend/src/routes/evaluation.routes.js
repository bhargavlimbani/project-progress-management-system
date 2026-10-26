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
  getStudentEvaluationPdf,
  getProjectEvaluationPdf,
  shareStudentResult,
} = require("../controllers/evaluation.controller");

const router = express.Router();
router.use(authenticate);

// Configurable criteria per subject
router.get("/criteria/:subjectId", getCriteria);
router.put(
  "/criteria/:subjectId",
  authorize("ADMIN"),
  validate(schemas.evaluationCriteria),
  upsertCriteria
);

// Mark sheets & project evaluations
router.get("/", getEvaluations);
router.get("/project/:projectId", getProjectEvaluation);
router.post(
  "/project/:projectId",
  authorize("ADMIN", "FACULTY"),
  validate(schemas.evaluationMarks),
  submitEvaluation
);

// Official PDF Reports
router.get("/project/:projectId/pdf", getProjectEvaluationPdf);
router.get("/project/:projectId/student/:studentId/pdf", getStudentEvaluationPdf);

// Share result via email / generate WhatsApp link
router.post(
  "/project/:projectId/student/:studentId/share",
  authorize("ADMIN", "FACULTY"),
  shareStudentResult
);

module.exports = router;
