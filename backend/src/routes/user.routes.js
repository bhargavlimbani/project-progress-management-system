const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const { uploadSingle } = require("../middleware/fileUpload.middleware");
const {
  listUsers,
  getUserById,
  setUserActive,
  updateOwnProfile,
  uploadAvatar,
  resetUserPassword,
} = require("../controllers/user.controller");

const router = express.Router();
router.use(authenticate);

// Self-service — available to every signed-in role, including students.
router.put("/me", updateOwnProfile);
router.post("/me/avatar", uploadSingle("photo"), uploadAvatar);

// Staff directory — admin only.
router.get("/", authorize("ADMIN"), listUsers);
router.get("/:id", authorize("ADMIN"), getUserById);
router.patch("/:id/active", authorize("ADMIN"), setUserActive);
router.post("/:id/reset-password", authorize("ADMIN"), resetUserPassword);

module.exports = router;
