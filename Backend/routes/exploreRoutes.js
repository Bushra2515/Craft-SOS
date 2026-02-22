// Backend/routes/exploreRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Maps every GET /api/explore/* route to the right controller function.
//   All routes require a valid JWT — the protect middleware handles that.
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const {
  getExplorePosts,
  getFeaturedCrafters,
  getTrendingTopics,
  getActiveRequests,
  getLeaderboard,
} = require("../controllers/exploreController");

const protect = require("../Middleware/authMiddleware");

const router = express.Router();

// All explore routes require authentication
router.use(protect);

// GET /api/explore/posts        → feed with filter/sort/search/pagination
// GET /api/explore/crafters     → featured crafters (top 6 by points)
// GET /api/explore/trends       → trending tags from last 30 days
// GET /api/explore/active       → 4 most recent open SOS requests
// GET /api/explore/leaderboard  → top 5 helpers by helpedCount
router.get("/posts", getExplorePosts);
router.get("/crafters", getFeaturedCrafters);
router.get("/trends", getTrendingTopics);
router.get("/active", getActiveRequests);
router.get("/leaderboard", getLeaderboard);

module.exports = router;
