// // Backend/routes/crafterProfileRoutes.js
// // ─────────────────────────────────────────────────────────────────────────────
// // What this file does:
// //   All five public crafter profile routes, all JWT-protected.
// //   Mounted at /api/crafter in server.js.
// //
// //   GET  /api/crafter/:userId            → full profile data
// //   GET  /api/crafter/:userId/posts      → their posts (tab filter)
// //   GET  /api/crafter/:userId/friends    → their friends + mutual flag
// //   GET  /api/crafter/:userId/activity   → recent activity feed
// //   POST /api/crafter/:userId/follow     → follow / unfollow toggle
// // ─────────────────────────────────────────────────────────────────────────────
// const express = require("express");
// const protect = require("../Middleware/authMiddleware");
// const {
//   getCrafterProfile,
//   getCrafterPosts,
//   getCrafterFriends,
//   getCrafterActivity,
//   toggleFollow,
// } = require("../controllers/crafterProfileController");

// const router = express.Router();
// router.use(protect);

// router.get("/:userId", getCrafterProfile);
// router.get("/:userId/posts", getCrafterPosts);
// router.get("/:userId/friends", getCrafterFriends);
// router.get("/:userId/activity", getCrafterActivity);
// router.post("/:userId/follow", toggleFollow);

// module.exports = router;
// Backend/routes/crafterProfileRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// All crafter profile routes. Mounted at /api/crafter in server.js.
//
//   GET  /api/crafter/:userId                → full profile data
//   GET  /api/crafter/:userId/posts          → their posts (tab filter)
//   GET  /api/crafter/:userId/friends        → their friends + mutual flag
//   GET  /api/crafter/:userId/activity       → recent activity feed
//   GET  /api/crafter/:userId/friend-status  → quick status check (for chat page)
//   POST /api/crafter/:userId/follow         → send / cancel / unfriend
//   POST /api/crafter/:userId/accept         → accept their incoming request
//   POST /api/crafter/:userId/decline        → decline their incoming request
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const protect = require("../Middleware/authMiddleware");
const {
  getCrafterProfile,
  getCrafterPosts,
  getCrafterFriends,
  getCrafterActivity,
  toggleFollow,
  acceptFriendRequest,
  declineFriendRequest,
  getFriendStatus,
} = require("../controllers/crafterProfileController");

const router = express.Router();
router.use(protect);

router.get("/:userId", getCrafterProfile);
router.get("/:userId/posts", getCrafterPosts);
router.get("/:userId/friends", getCrafterFriends);
router.get("/:userId/activity", getCrafterActivity);
router.get("/:userId/friend-status", getFriendStatus);
router.post("/:userId/follow", toggleFollow);
router.post("/:userId/accept", acceptFriendRequest);
router.post("/:userId/decline", declineFriendRequest);

module.exports = router;
