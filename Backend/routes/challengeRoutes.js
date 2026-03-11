// const express = require("express");
// const protect = require("../Middleware/authMiddleware");
// const {
//   getChallenges,
//   toggleJoin,
// } = require("../controllers/challengeController");

// const router = express.Router();

// router.get("/", protect, getChallenges);
// router.patch("/:id/join", protect, toggleJoin);

// module.exports = router;
// Backend/routes/challengeRoutes.js
// Mounts at: /api/challenges
//
// Public (no auth needed — guests can browse):
//   GET  /api/challenges               → list challenges
//   GET  /api/challenges/leaderboard   → leaderboard
//   GET  /api/challenges/:id           → single challenge
//
// Protected (JWT required):
//   PATCH  /api/challenges/:id/join      → join / leave
//   PATCH  /api/challenges/:id/progress  → update own progress
//
// Admin only:
//   POST   /api/challenges               → create
//   PATCH  /api/challenges/:id/status    → change status
//   DELETE /api/challenges/:id           → soft-delete

const express = require("express");
const router = express.Router();
const protect = require("../Middleware/authMiddleware");
const ctrl = require("../controllers/challengeController");

// ── Admin role guard ─────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin" && req.user?.role !== "moderator") {
    return res.status(403).json({ success: false, message: "Admins only" });
  }
  next();
};

// ── Public ────────────────────────────────────────────────
router.get("/", ctrl.getChallenges); // list
router.get("/leaderboard", ctrl.getLeaderboard); // leaderboard
router.get("/:id", ctrl.getChallenge); // single

// ── Protected ─────────────────────────────────────────────
router.patch("/:id/join", protect, ctrl.toggleJoin);
router.patch("/:id/progress", protect, ctrl.updateProgress);

// ── Admin ─────────────────────────────────────────────────
router.post("/", protect, adminOnly, ctrl.createChallenge);
router.patch("/:id/status", protect, adminOnly, ctrl.updateStatus);
router.delete("/:id", protect, adminOnly, ctrl.deleteChallenge);

/* ════════════════════════════════════════════════════════════
   Challenge Detail routes (added below existing routes)
   All mounted at /api/challenges
════════════════════════════════════════════════════════════ */
const detail = require("../controllers/challengeDetailController");

// ── Public ────────────────────────────────────────────────
router.get("/:id/detail", detail.getDetail); // full detail page data
router.get("/:id/board", detail.getBoard); // challenge leaderboard
router.get("/:id/feed", detail.getFeed); // community feed

// ── Protected ─────────────────────────────────────────────
router.post("/:id/feed", protect, detail.postFeed);
router.patch("/:id/feed/:postId/react", protect, detail.toggleReaction);
router.delete("/:id/feed/:postId", protect, detail.deleteFeedPost);
router.patch("/:id/tasks/:taskId", protect, detail.completeTask);
router.patch("/:id/bookmark", protect, detail.toggleBookmark);
router.patch("/:id/leave", protect, detail.leaveChallenge);
module.exports = router;
