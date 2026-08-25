const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { globalSearch } = require("../controllers/search.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", globalSearch);

module.exports = router;
