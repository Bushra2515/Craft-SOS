// Backend/routes/postDetailRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Maps every /api/post-detail/* request to the right controller function.
//   All routes are JWT-protected.
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const {
  getPostDetail,
  incrementViews,
  toggleReaction,
  getReplies,
  toggleReplyHelpful,
  getRelated,
} = require("../controllers/postDetailController");

const protect = require("../Middleware/authMiddleware");

const router = express.Router();
router.use(protect);

// GET   /api/post-detail/:id             → full post for the detail page
// PATCH /api/post-detail/:id/views       → increment view counter on page load
// POST  /api/post-detail/:id/reactions   → toggle a reaction emoji
// GET   /api/post-detail/:id/replies     → paginated + sorted replies
// PATCH /api/post-detail/:id/replies/:replyId/helpful → toggle helpful vote
// GET   /api/post-detail/:id/related     → 3 related posts for sidebar
router.get("/:id", getPostDetail);
router.patch("/:id/views", incrementViews);
router.post("/:id/reactions", toggleReaction);
router.get("/:id/replies", getReplies);
router.patch("/:id/replies/:replyId/helpful", toggleReplyHelpful);
router.get("/:id/related", getRelated);

module.exports = router;
