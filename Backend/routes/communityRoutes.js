// Backend/routes/communityRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Public-facing community routes — no admin auth needed.
// Mount in server.js with:
//   app.use("/api/community", require("./routes/communityRoutes"));
//
// For the join endpoint, we reuse your existing user auth middleware.
// If you don't have one yet, the route still works — it just won't know
// which user is joining (joined = false for everyone).
// ─────────────────────────────────────────────────────────────────────────────
const { Router } = require("express");
const ctrl = require("../controllers/publicController");

const router = Router();

// ── Try to load existing user auth middleware (optional for public routes) ──
// Wrap in try/catch so the routes still mount even if the path is different.
let optionalAuth = (req, res, next) => next(); // no-op default
let requireAuth = (req, res, next) => {
  return res
    .status(401)
    .json({ success: false, message: "Login required to join challenges" });
};

try {
  // Adjust this path to match wherever your user JWT middleware lives.
  // Common locations:  ../middleware/auth.js   or  ../middleware/userAuth.js
  const { protect } = require("../Middleware/authMiddleware");
  if (typeof protect === "function") {
    optionalAuth = (req, res, next) => {
      // Run protect but don't block on failure — just continue without req.user
      protect(req, res, (err) => {
        next();
      });
    };
    requireAuth = protect;
  }
} catch (_) {
  // middleware not found — join will return 401 until auth is wired
  console.warn(
    "[communityRoutes] Could not load user auth middleware — /join will require auth setup",
  );
}

// ── Public (no auth) ─────────────────────────────────────────────────────────
router.get("/challenges", ctrl.getChallenges);
router.get("/announcements", ctrl.getAnnouncements);
router.get("/badges", ctrl.getFeaturedBadges);

// ── Join challenge (requires logged-in user) ─────────────────────────────────
router.post("/challenges/:id/join", requireAuth, ctrl.joinChallenge);

module.exports = router;
