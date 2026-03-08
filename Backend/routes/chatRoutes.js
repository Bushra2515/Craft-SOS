// Backend/routes/chatRoutes.js
const express = require("express");
const protect = require("../Middleware/authMiddleware");
const {
  getConversations,
  getHistory,
  getUnreadTotal,
} = require("../controllers/chatController");

const router = express.Router();
router.use(protect);

router.get("/conversations", getConversations); // list recent chats
router.get("/unread-total", getUnreadTotal); // badge count
router.get("/:friendId", getHistory); // paginated history (friend-gated)

module.exports = router;
