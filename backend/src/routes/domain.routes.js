const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { getDomains, createDomain, updateDomain, deleteDomain } = require("../controllers/domain.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", getDomains);
router.post("/", authorize("ADMIN"), createDomain);
router.put("/:id", authorize("ADMIN"), updateDomain);
router.delete("/:id", authorize("ADMIN"), deleteDomain);

module.exports = router;
