const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { handleUpload } = require("../middleware/upload.middleware");
const controller = require("../controllers/studentImport.controller");

const router = express.Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/template", controller.downloadTemplate);
router.post("/validate", handleUpload, controller.validateImport);
router.post("/confirm", controller.confirmImport);
router.get("/:batchId/errors", controller.downloadErrorReport);

module.exports = router;
