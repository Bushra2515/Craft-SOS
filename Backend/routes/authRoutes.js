// const express = require("express");
// const { registerUser, loginUser } = require("../controllers/authController");

// const router = express.Router();

// const protect = require("../Middleware/authMiddleware");

// // TEST PROTECTED ROUTE
// router.get("/me", protect, (req, res) => {
//   res.json({
//     message: "Access granted",
//     userId: req.userId,
//   });
// });

// // REGISTER ROUTE
// router.post("/register", registerUser);

// // LOGIN
// router.post("/login", loginUser);

// module.exports = router;
// Backend/routes/authRoutes.js
// const express = require("express");
// const {
//   registerUser,
//   loginUser,
//   forgotPassword,
//   getMe,
//   getUsers,
// } = require("../controllers/authController");

// const protect = require("../Middleware/authMiddleware");

// const router = express.Router();

// /* ──────────────────────────────────────────
//    Public routes (no token required)
// ────────────────────────────────────────── */
// router.post("/register", registerUser);
// router.post("/login", loginUser);
// router.post("/forgot-password", forgotPassword);

// // router.post("/register", authController.registerUser);
// router.get("/users", getUsers);
// /* ──────────────────────────────────────────
//    Protected routes (token required)
// ────────────────────────────────────────── */
// router.get("/me", protect, getMe);

// module.exports = router;
// Backend/routes/authRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Maps every /api/auth/* HTTP request to the right authController function.
//   Public routes need no token. Protected routes require the JWT via protect middleware.
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const {
  registerUser,
  loginUser,
  forgotPassword,
  getMe,
  checkUsername,
} = require("../controllers/authController");

const protect = require("../Middleware/authMiddleware");

const router = express.Router();

/* ──────────────────────────────────────────
   PUBLIC — no token required
────────────────────────────────────────── */
// POST /api/auth/register       → create account (all 3 steps combined)
// POST /api/auth/login          → sign in, returns JWT
// POST /api/auth/forgot-password→ trigger reset email
// GET  /api/auth/check-username → live availability check from Step 1
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.get("/check-username", checkUsername);

/* ──────────────────────────────────────────
   PROTECTED — valid JWT required
────────────────────────────────────────── */
// GET /api/auth/me → restore session (used by index.js / dashboard.js on load)
router.get("/me", protect, getMe);

module.exports = router;
