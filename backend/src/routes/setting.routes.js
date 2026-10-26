const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { getSettings, updateSettings } = require("../controllers/setting.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", getSettings);
router.put("/", authorize("ADMIN"), updateSettings);

module.exports = router;
