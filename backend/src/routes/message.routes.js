const express = require("express");
const { authenticate } = require("../middleware/auth.middleware");
const { validate } = require("../middleware/validate.middleware");
const { uploadSingle } = require("../middleware/fileUpload.middleware");
const schemas = require("../validators");
const {
  getConversations,
  getContacts,
  openDirectConversation,
  getMessages,
  openProjectConversation,
  sendMessage,
  markConversationRead,
  getUnreadCount,
} = require("../controllers/message.controller");

const router = express.Router();
router.use(authenticate);

router.get("/conversations", getConversations);
// Who the caller may start a direct thread with, and how to open one.
router.get("/contacts", getContacts);
router.post("/conversations/direct", openDirectConversation);
router.get("/unread-count", getUnreadCount);
router.post("/conversations/project/:projectId", openProjectConversation);
router.get("/conversations/:conversationId", getMessages);
router.post(
  "/conversations/:conversationId",
  uploadSingle("file"),
  validate(schemas.message),
  sendMessage
);
router.post("/conversations/:conversationId/read", markConversationRead);

module.exports = router;
