// const express = require("express");
// const protect = require("../Middleware/authMiddleware");
// const {
//   createPost,
//   getFeed,
//   addReply,
// } = require("../controllers/postController");

// const router = express.Router();

// router.post("/", protect, createPost);
// router.get("/", protect, getFeed);
// router.post("/:postId/reply", protect, addReply);

// module.exports = router;

// Backend/routes/postRoutes.js
const express = require("express");
const {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  resolvePost,
  toggleSave,
  addReply,
  getCurrentUser,
} = require("../controllers/postController");

const protect = require("../Middleware/authMiddleware");
// ↑ Adjust the filename to match yours — common names:
//   ../Middleware/authMiddleware
//   ../Middleware/auth
//   ../Middleware/protect

const router = express.Router();

/* ─────────────────────────────────────────────────────────────
   All routes require authentication (protect middleware)
─────────────────────────────────────────────────────────────
   GET    /api/posts                 → feed (filterable)
   POST   /api/posts                 → create new post
   GET    /api/posts/:id             → single post + view++
   PUT    /api/posts/:id             → edit post (owner only)
   DELETE /api/posts/:id             → delete post (owner only)
   PATCH  /api/posts/:id/resolve     → mark resolved (owner only)
   PATCH  /api/posts/:id/save        → bookmark toggle
   POST   /api/posts/:id/replies     → add reply
───────────────────────────────────────────────────────────── */

router.get("/", protect, getPosts);
router.post("/", protect, createPost);

router.get("/:id", protect, getPostById);
router.put("/:id", protect, updatePost);
router.delete("/:id", protect, deletePost);
router.patch("/:id/resolve", protect, resolvePost);
router.patch("/:id/save", protect, toggleSave);
router.post("/:id/replies", protect, addReply);
router.get("/myself", protect, getCurrentUser);
module.exports = router;
