const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const schemas = require("../validators");
const {
  getPresentations,
  getPresentationById,
  createPresentation,
  updatePresentation,
  deletePresentation,
} = require("../controllers/presentation.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", getPresentations);
router.get("/:id", getPresentationById);
router.post("/", authorize("ADMIN", "FACULTY"), validate(schemas.presentation), createPresentation);
router.put("/:id", authorize("ADMIN", "FACULTY"), updatePresentation);
router.delete("/:id", authorize("ADMIN", "FACULTY"), deletePresentation);

module.exports = router;
