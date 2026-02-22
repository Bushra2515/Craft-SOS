// Backend/routes/dashboardRoutes.js
const express = require("express");
const {
  getDashboard,
  getNotifications,
  markAllRead,
  getSavedPosts,
  getProgress,
  toggleChallenge,
  toggleFollow,
} = require("../controllers/dashboardController");

const protect = require("../Middleware/authMiddleware");

const router = express.Router();

// All dashboard routes require a valid JWT
router.use(protect);

/* ──────────────────────────────────────
   HOME  — single aggregated response
────────────────────────────────────── */
router.get("/", getDashboard);

/* ──────────────────────────────────────
   NOTIFICATIONS
────────────────────────────────────── */
router.get("/notifications", getNotifications);
router.patch("/notifications/read-all", markAllRead);

/* ──────────────────────────────────────
   SAVED POSTS
────────────────────────────────────── */
router.get("/saved", getSavedPosts);

/* ──────────────────────────────────────
   PROGRESS
────────────────────────────────────── */
router.get("/progress", getProgress);

/* ──────────────────────────────────────
   CHALLENGES
────────────────────────────────────── */
router.post("/challenges/:id/join", toggleChallenge);

/* ──────────────────────────────────────
   SOCIAL
────────────────────────────────────── */
router.post("/follow/:userId", toggleFollow);

module.exports = router;
