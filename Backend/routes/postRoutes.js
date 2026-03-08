// Backend/routes/postRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Maps every /api/posts/* request to the correct handler.
//
//   Route table:
//     GET    /api/posts                             → getPosts
//     POST   /api/posts                             → createPost
//     GET    /api/posts/:id                         → getPostById
//     GET    /api/posts/:id/edit                    → getPostForEdit  ← edit page
//     PUT    /api/posts/:id                         → updatePost      (author)
//     DELETE /api/posts/:id                         → deletePost      (author)
//     PATCH  /api/posts/:id/resolve                 → resolvePost     (author)
//     PATCH  /api/posts/:id/save                    → toggleSave
//     PATCH  /api/posts/:id/views                   → incrementViews
//     GET    /api/posts/:id/replies                 → getReplies
//     POST   /api/posts/:id/replies                 → addReply
//     PATCH  /api/posts/:id/replies/:replyId/helpful → toggleReplyHelpful
//     POST   /api/posts/:id/reactions               → toggleReaction
//     GET    /api/posts/:id/related                 → getRelatedPosts
//
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const router = express.Router();

// ── postController: all CRUD + social actions ─────────────────────────────
const {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  resolvePost,
  toggleSave,
  incrementViews,
  addReply,
  getReplies,
  toggleReplyHelpful,
  toggleReaction,
  getRelatedPosts,
} = require("../controllers/postController");

// ── postEditController: ONLY the edit-page loader ─────────────────────────
// updatePost / deletePost / incrementViews are NOT imported here —
// they already come from postController above.
const { getPostForEdit } = require("../controllers/postEditController");

// ── Auth middleware ────────────────────────────────────────────────────────
// Uses the same path as the rest of your codebase (capital M, no {})
const protect = require("../Middleware/authMiddleware");

// All routes require a valid JWT
router.use(protect);

/* ──────────────────────────────────────
   COLLECTION
────────────────────────────────────── */
router.get("/", getPosts);
router.post("/", createPost);

/* ──────────────────────────────────────
   SINGLE POST — CRUD
   IMPORTANT: specific sub-paths like /:id/edit MUST be registered
   BEFORE the bare /:id route, otherwise Express matches /:id first
   and treats "edit" as a post ID.
────────────────────────────────────── */
router.get("/:id/edit", getPostForEdit); // ← edit-post.html loader
router.get("/:id", getPostById);
router.put("/:id", updatePost);
router.delete("/:id", deletePost);

/* ──────────────────────────────────────
   SINGLE POST — ACTIONS
────────────────────────────────────── */
router.patch("/:id/resolve", resolvePost);
router.patch("/:id/save", toggleSave);
router.patch("/:id/views", incrementViews);

/* ──────────────────────────────────────
   REPLIES
────────────────────────────────────── */
router.get("/:id/replies", getReplies);
router.post("/:id/replies", addReply);
router.patch("/:id/replies/:replyId/helpful", toggleReplyHelpful);

/* ──────────────────────────────────────
   REACTIONS
────────────────────────────────────── */
router.post("/:id/reactions", toggleReaction);

/* ──────────────────────────────────────
   RELATED
────────────────────────────────────── */
router.get("/:id/related", getRelatedPosts);

module.exports = router;
