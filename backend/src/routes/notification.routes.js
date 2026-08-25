const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { getNotifications, markAsRead, getUnreadCount } = require("../controllers/notification.controller");

const router = express.Router();
router.use(authenticate);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/mark-read", markAsRead);

module.exports = router;
