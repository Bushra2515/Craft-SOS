// Backend/routes/profileRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Maps every /api/profile/* URL to the right controller function.
//   All routes are JWT-protected via the protect middleware.
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const {
  getProfile,
  updateProfile,
  getProfilePosts,
  getActivity,
  getFriends,
  updateHobbies,
} = require("../controllers/profileController");

const protect = require("../Middleware/authMiddleware");

const router = express.Router();
router.use(protect); // every route below requires a valid JWT

// GET   /api/profile           → full profile (hero, stats, points, badges, friends, details)
// PATCH /api/profile           → update editable fields (bio, location, website…)
// GET   /api/profile/posts     → user's posts — ?filter=all|distress|resolved
// GET   /api/profile/activity  → recent activity timeline
// GET   /api/profile/friends   → full friends list (for "See all")
// PATCH /api/profile/hobbies   → replace hobbies array
router.get("/", getProfile);
router.patch("/", updateProfile);
router.get("/posts", getProfilePosts);
router.get("/activity", getActivity);
router.get("/friends", getFriends);
router.patch("/hobbies", updateHobbies);

module.exports = router;
