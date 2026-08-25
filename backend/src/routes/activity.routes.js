const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const {
  getActivityLog,
  getProjectActivity,
  getMyActivity,
} = require("../controllers/activity.controller");

const router = express.Router();
router.use(authenticate);

router.get("/me", getMyActivity);
router.get("/project/:projectId", getProjectActivity);
router.get("/", authorize("ADMIN"), getActivityLog);

module.exports = router;
