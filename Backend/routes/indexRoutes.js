// Backend/routes/indexRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Maps every /api/index/* request to the right function in indexController.
//   All routes are JWT-protected via the protect middleware.
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const {
  getWelcome,
  getFeed,
  getNeedsHelp,
  getActivity,
  getTopHelpers,
  getSuggestions,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
} = require("../controllers/indexController");

const protect = require("../Middleware/authMiddleware");

const router = express.Router();
router.use(protect); // all index routes require login

// ── Read endpoints ────────────────────────────────────────
// GET /api/index/welcome              → personalised banner data
// GET /api/index/feed?type=&tag=&page=  → filtered paginated feed
// GET /api/index/needs-help           → 0-reply SOS matched to viewer's craft
// GET /api/index/activity             → community activity feed
// GET /api/index/top-helpers          → top helpers leaderboard
// GET /api/index/suggestions          → follow suggestions
// GET /api/index/friend-requests      → viewer's incoming requests
router.get("/welcome", getWelcome);
router.get("/feed", getFeed);
router.get("/needs-help", getNeedsHelp);
router.get("/activity", getActivity);
router.get("/top-helpers", getTopHelpers);
router.get("/suggestions", getSuggestions);
router.get("/friend-requests", getFriendRequests);

// ── Friend request mutations ──────────────────────────────
// POST  /api/index/friend-requests/:userId          → send request
// PATCH /api/index/friend-requests/:userId/accept   → accept
// PATCH /api/index/friend-requests/:userId/decline  → decline
router.post("/friend-requests/:userId", sendFriendRequest);
router.patch("/friend-requests/:userId/accept", acceptFriendRequest);
router.patch("/friend-requests/:userId/decline", declineFriendRequest);

module.exports = router;
