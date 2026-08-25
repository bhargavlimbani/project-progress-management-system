const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { uploadSingle, uploadMany } = require("../middleware/fileUpload.middleware");
const schemas = require("../validators");
const {
  getMilestones, createMilestone, updateMilestone, deleteMilestone, createFromTemplate,
} = require("../controllers/milestone.controller");
const {
  getWeeklyProgress, submitWeeklyProgress, reviewProgress, getPendingReviews,
} = require("../controllers/weeklyProgress.controller");
const {
  getDocuments, uploadDocument, reviewDocumentVersion,
} = require("../controllers/document.controller");
const { uploadEvidence } = require("../controllers/upload.controller");

const router = express.Router();
router.use(authenticate);

// ── Milestones ─────────────────────────────────────────────────────────────
router.get("/projects/:projectId/milestones", getMilestones);
router.post(
  "/projects/:projectId/milestones",
  authorize("ADMIN", "FACULTY"),
  validate(schemas.milestone),
  createMilestone
);
router.post(
  "/projects/:projectId/milestones/from-template",
  authorize("ADMIN", "FACULTY"),
  createFromTemplate
);
router.put("/milestones/:id", authorize("ADMIN", "FACULTY", "MENTOR"), updateMilestone);
router.delete("/milestones/:id", authorize("ADMIN", "FACULTY"), deleteMilestone);

// ── Weekly progress ────────────────────────────────────────────────────────
router.get("/projects/:projectId/progress", getWeeklyProgress);
router.post(
  "/projects/:projectId/progress",
  authorize("STUDENT"),
  validate(schemas.weeklyProgress),
  submitWeeklyProgress
);
router.post(
  "/progress/:progressId/review",
  authorize("MENTOR", "FACULTY"),
  validate(schemas.progressReview),
  reviewProgress
);
router.get("/pending-reviews", authorize("MENTOR", "FACULTY"), getPendingReviews);

// Evidence for weekly progress — uploaded first, submitted as URLs
router.post(
  "/projects/:projectId/evidence",
  authorize("STUDENT"),
  uploadMany("files", 10),
  uploadEvidence
);

// ── Documents ──────────────────────────────────────────────────────────────
router.get("/projects/:projectId/documents", getDocuments);
router.post(
  "/projects/:projectId/documents",
  authorize("STUDENT"),
  uploadSingle("file"),
  validate(schemas.documentUpload),
  uploadDocument
);
router.post(
  "/documents/versions/:versionId/review",
  authorize("FACULTY", "MENTOR"),
  validate(schemas.documentReview),
  reviewDocumentVersion
);

module.exports = router;
