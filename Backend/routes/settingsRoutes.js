// Backend/routes/settingsRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Registers all settings endpoints under /api/settings.
//   Every route is JWT-protected via the protect middleware.
//
//   GET    /api/settings                 → load form data
//   PATCH  /api/settings                 → save profile fields
//   PATCH  /api/settings/password        → change password
//   GET    /api/settings/handle-check    → handle availability
//   PATCH  /api/settings/deactivate      → soft-delete account
//   DELETE /api/settings/account         → permanent delete
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const protect = require("../Middleware/authMiddleware");
const {
  getSettings,
  updateSettings,
  changePassword,
  checkHandle,
  deactivateAccount,
  deleteAccount,
} = require("../controllers/settingsController");

const router = express.Router();

// All routes require a valid JWT
router.use(protect);

router.get("/", getSettings);
router.patch("/", updateSettings);
router.patch("/password", changePassword);
router.get("/handle-check", checkHandle);
router.patch("/deactivate", deactivateAccount);
router.delete("/account", deleteAccount);

module.exports = router;
