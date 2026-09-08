const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const schemas = require("../validators");
const { getDomains, createDomain, updateDomain, deleteDomain } = require("../controllers/domain.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", getDomains);
router.post("/", authorize("ADMIN"), validate(schemas.domain), createDomain);
router.put("/:id", authorize("ADMIN"), updateDomain);
router.delete("/:id", authorize("ADMIN"), deleteDomain);

module.exports = router;
