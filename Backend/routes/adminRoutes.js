// Single file mounts all admin sub-routers under /api/admin
// Add to server.js:  app.use("/api/admin", require("./routes/adminRoutes"));
const { Router } = require("express");
const { adminAuth, requireRole } = require("../Middleware/adminAuth");

const router = Router();

// Apply JWT guard to ALL admin routes
router.use(adminAuth);

// ── Dashboard ─────────────────────────────────────────────
// const dash = require("./admin/dashboardRouter");
// router.use("/dashboard", dash);
const dc = require("../controllers/admin/dashboardController");
router.get("/dashboard/stats", dc.getStats);
router.get("/dashboard/recent", dc.getRecent);

// ── Users ─────────────────────────────────────────────────
const uc = require("../controllers/admin/userController");
router.get("/users", uc.getUsers);
router.get("/users/verification-queue", uc.getVerificationQueue); // before /:id
router.get("/users/top-helpers", uc.getTopHelpers);
router.get("/users/:id", uc.getUserById);
router.patch("/users/:id/verify", uc.verifyUser);
router.patch("/users/:id/suspend", uc.suspendUser);
router.patch("/users/:id/ban", requireRole("admin"), uc.banUser);
router.patch("/users/:id/reinstate", uc.reinstateUser);
router.patch("/users/:id/promote", requireRole("admin"), uc.promoteUser);
router.patch("/users/:id/reject-verification", uc.rejectVerification);

// ── Posts ─────────────────────────────────────────────────
const pc = require("../controllers/admin/postController");
router.get("/posts/stats", pc.getPostStats); // before /:id
router.get("/posts", pc.getPosts);
router.patch("/posts/:id/close", pc.closePost);
router.patch("/posts/:id/resolve", pc.resolvePost);
router.patch("/posts/:id/reopen", pc.reopenPost);
router.delete("/posts/:id", pc.deletePost);
router.delete("/posts/:postId/replies/:replyId", pc.deleteReply);

// ── Reports ───────────────────────────────────────────────
const rc = require("../controllers/admin/reportController");
router.get("/reports", rc.getReports);
router.patch("/reports/dismiss-all", rc.dismissAll); // before /:id
router.patch("/reports/:id/resolve", rc.resolveReport);

// ── Badges ────────────────────────────────────────────────
const bc = require("../controllers/admin/badgeController");
router.get("/badges", bc.getBadges);
router.get("/badges/recent-awards", bc.getRecentAwards); // before /:id
router.post("/badges", requireRole("admin"), bc.createBadge);
router.post("/badges/:id/assign", bc.assignBadge);

// ── Challenges ────────────────────────────────────────────
const cc = require("../controllers/admin/challengeController");
router.get("/challenges/stats", cc.getChallengeStats); // before /:id
router.get("/challenges", cc.getChallenges);
router.post("/challenges", cc.createChallenge);
router.patch("/challenges/:id/end", cc.endChallenge);

// ── Announcements ─────────────────────────────────────────
const ac = require("../controllers/admin/announcementController");
router.get("/announcements", ac.getAnnouncements);
router.post("/announcements/send-now", requireRole("admin"), ac.sendNow);

// ── Logs ──────────────────────────────────────────────────
const lc = require("../controllers/admin/logController");
router.get("/logs/summary", lc.getLogSummary); // before /
router.get("/logs", lc.getLogs);

module.exports = router;
