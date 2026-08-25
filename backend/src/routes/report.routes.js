const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { listReports, previewReport, downloadReport } = require("../controllers/report.controller");

const router = express.Router();
router.use(authenticate);

// Students don't get the reporting suite — their own progress lives on their dashboard.
router.use(authorize("ADMIN", "FACULTY", "MENTOR"));

router.get("/", listReports);
router.get("/:key/preview", previewReport);
router.get("/:key/download", downloadReport);

module.exports = router;
