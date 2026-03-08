// // // Aggregates stat-card data for the Dashboard section.
// // // REAL FIELD MAP:
// // //   User → isActive(bool), isEmailVerified(bool), role, createdAt, skills[]
// // //   Post → status("active"|"resolved"|"closed"), type("sos"|"tut"|"com"|"res"), replyCount
// // const User = require("../../models/User");
// // const Post = require("../../models/Post");
// // const AdminLog = require("../../models/AdminLog");

// // const getStats = async (req, res, next) => {
// //   try {
// //     const todayStart = new Date();
// //     todayStart.setHours(0, 0, 0, 0);

// //     const [
// //       totalUsers,
// //       newSignupsToday,
// //       pendingVerification,
// //       activePosts,
// //       resolvedPosts,
// //       closedPosts,
// //       zeroReplyPosts,
// //       commentsAgg,
// //       tutorialsShared,
// //     ] = await Promise.all([
// //       User.countDocuments({ isActive: true }),
// //       User.countDocuments({ createdAt: { $gte: todayStart } }),
// //       User.countDocuments({ isEmailVerified: false, isActive: true }),
// //       Post.countDocuments({ status: "active" }),
// //       Post.countDocuments({ status: "resolved" }),
// //       Post.countDocuments({ status: "closed" }),
// //       Post.countDocuments({ status: "active", replyCount: 0 }),
// //       Post.aggregate([
// //         { $group: { _id: null, total: { $sum: "$replyCount" } } },
// //       ]),
// //       Post.countDocuments({ type: "tut" }),
// //     ]);

// //     // 7-day SOS chart
// //     const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
// //     const sevenDayChart = await Post.aggregate([
// //       { $match: { type: "sos", createdAt: { $gte: weekAgo } } },
// //       {
// //         $group: {
// //           _id: { $dateToString: { format: "%a", date: "$createdAt" } },
// //           count: { $sum: 1 },
// //         },
// //       },
// //       { $sort: { _id: 1 } },
// //     ]);

// //     // Skill breakdown for donut chart
// //     const skillBreakdown = await User.aggregate([
// //       { $unwind: { path: "$skills", preserveNullAndEmpty: false } },
// //       { $group: { _id: "$skills", count: { $sum: 1 } } },
// //       { $sort: { count: -1 } },
// //       { $limit: 6 },
// //     ]);

// //     res.json({
// //       success: true,
// //       stats: {
// //         totalUsers,
// //         newSignupsToday,
// //         pendingVerification,
// //         activePosts,
// //         resolvedPosts,
// //         closedPosts,
// //         zeroReplyPosts,
// //         totalComments: commentsAgg[0]?.total ?? 0,
// //         tutorialsShared,
// //       },
// //       sevenDayChart,
// //       skillBreakdown,
// //     });
// //   } catch (err) {
// //     next(err);
// //   }
// // };

// // const getRecent = async (req, res, next) => {
// //   try {
// //     const recentUsers = await User.find({ isActive: true })
// //       .sort({ createdAt: -1 })
// //       .limit(5)
// //       .select(
// //         "handle firstName lastName avatar skills isEmailVerified createdAt",
// //       );

// //     const recentPosts = await Post.find({ status: "active" })
// //       .sort({ createdAt: -1 })
// //       .limit(5)
// //       .populate("author", "handle avatar")
// //       .select("title type status replyCount views createdAt");

// //     res.json({ success: true, recentUsers, recentPosts });
// //   } catch (err) {
// //     next(err);
// //   }
// // };

// // module.exports = { getStats, getRecent };
// // Backend/controllers/admin/dashboardController.js
// const User = require("../../models/User");
// const Post = require("../../models/Post");
// const AdminLog = require("../../models/AdminLog");

// // Day-name lookup — replaces the unsupported MongoDB %a format character
// const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// /* ─────────────────────────────────────────────────────────
//    GET /api/admin/dashboard/stats
// ───────────────────────────────────────────────────────── */
// const getStats = async (req, res, next) => {
//   try {
//     const todayStart = new Date();
//     todayStart.setHours(0, 0, 0, 0);

//     const [
//       totalUsers,
//       newSignupsToday,
//       pendingVerification,
//       activePosts,
//       resolvedPosts,
//       closedPosts,
//       zeroReplyPosts,
//       commentsAgg,
//       tutorialsShared,
//     ] = await Promise.all([
//       User.countDocuments({ isActive: true }),
//       User.countDocuments({ createdAt: { $gte: todayStart } }),
//       User.countDocuments({ isEmailVerified: false, isActive: true }),
//       Post.countDocuments({ status: "active" }),
//       Post.countDocuments({ status: "resolved" }),
//       Post.countDocuments({ status: "closed" }),
//       Post.countDocuments({ status: "active", replyCount: 0 }),
//       Post.aggregate([
//         { $group: { _id: null, total: { $sum: "$replyCount" } } },
//       ]),
//       Post.countDocuments({ type: "tut" }),
//     ]);

//     // ── 7-day SOS chart ──────────────────────────────────
//     // FIX: use %Y-%m-%d (all supported) instead of %a (unsupported)
//     const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

//     const rawChart = await Post.aggregate([
//       { $match: { type: "sos", createdAt: { $gte: weekAgo } } },
//       {
//         $group: {
//           _id: {
//             $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }, // ✅ safe
//           },
//           count: { $sum: 1 },
//         },
//       },
//       { $sort: { _id: 1 } },
//     ]);

//     // Convert "2024-05-13" → "Mon", "Tue" etc. in JS (not MongoDB)
//     const sevenDayChart = rawChart.map((d) => ({
//       day: DAY_NAMES[new Date(d._id).getDay()],
//       date: d._id,
//       count: d.count,
//     }));

//     // ── Skill breakdown for donut chart ──────────────────
//     const skillBreakdown = await User.aggregate([
//       { $unwind: { path: "$skills", preserveNullAndEmpty: false } },
//       { $group: { _id: "$skills", count: { $sum: 1 } } },
//       { $sort: { count: -1 } },
//       { $limit: 6 },
//     ]);

//     return res.json({
//       success: true,
//       stats: {
//         totalUsers,
//         newSignupsToday,
//         pendingVerification,
//         activePosts,
//         resolvedPosts,
//         closedPosts,
//         zeroReplyPosts,
//         totalComments: commentsAgg[0]?.total ?? 0,
//         tutorialsShared,
//         pendingReports: 0, // wire up when Report model is ready
//         dailyActiveUsers: 0, // wire up when session tracking is ready
//       },
//       sevenDayChart,
//       skillBreakdown,
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/admin/dashboard/recent
// ───────────────────────────────────────────────────────── */
// const getRecent = async (req, res, next) => {
//   try {
//     const [recentUsers, recentPosts] = await Promise.all([
//       User.find({ isActive: true })
//         .sort({ createdAt: -1 })
//         .limit(5)
//         .select(
//           "handle firstName lastName avatar skills isEmailVerified createdAt",
//         ),

//       Post.find({ status: "active" })
//         .sort({ createdAt: -1 })
//         .limit(5)
//         .populate("author", "handle avatar")
//         .select("title type status replyCount views createdAt"),
//     ]);

//     return res.json({ success: true, recentUsers, recentPosts });
//   } catch (err) {
//     next(err);
//   }
// };

// module.exports = { getStats, getRecent };
// Backend/controllers/admin/dashboardController.js
// ─────────────────────────────────────────────────────────────────────────────
// Dashboard stat cards + recent-data feed for the admin panel.
//
// Safe against:
//  - Missing isActive / isEmailVerified fields on old documents
//  - Empty Post / User collections
//  - Invalid $unwind options (fixed: preserveNullAndEmptyArrays)
//  - Aggregation pipeline failures (each wrapped individually)
// ─────────────────────────────────────────────────────────────────────────────
const User = require("../../models/User");
const Post = require("../../models/Post");
// NOTE: AdminLog is NOT required here — avoids path issues when running from
//       the main server.  Log summary lives in logController instead.

/* ── helpers ─────────────────────────────────────────────── */

// Migration-safe active count:
// Old docs may lack isActive field — treat missing as "active" (true).
const activeUserFilter = {
  $or: [{ isActive: true }, { isActive: { $exists: false } }],
};

async function safeCount(Model, filter) {
  try {
    return await Model.countDocuments(filter);
  } catch {
    return 0;
  }
}

async function safeAggregate(Model, pipeline) {
  try {
    return await Model.aggregate(pipeline);
  } catch (err) {
    console.error("[Admin/dashboard] aggregate error:", err.message);
    return [];
  }
}

/* ── GET /api/admin/dashboard/stats ─────────────────────── */
const getStats = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // ── Basic counts (all migration-safe) ───────────────────
    const [
      totalUsers,
      newSignupsToday,
      pendingVerification,
      activePosts,
      resolvedPosts,
      closedPosts,
      zeroReplyPosts,
      tutorialsShared,
    ] = await Promise.all([
      safeCount(User, activeUserFilter),
      safeCount(User, { createdAt: { $gte: todayStart } }),
      // Pending  = active account but not yet email-verified
      safeCount(User, {
        $and: [activeUserFilter, { isEmailVerified: { $ne: true } }],
      }),
      safeCount(Post, { status: "active" }),
      safeCount(Post, { status: "resolved" }),
      safeCount(Post, { status: "closed" }),
      safeCount(Post, { status: "active", replyCount: 0 }),
      safeCount(Post, { type: "tut" }),
    ]);

    // ── Total comments (sum of replyCount across all posts) ──
    const commentsAgg = await safeAggregate(Post, [
      { $group: { _id: null, total: { $sum: "$replyCount" } } },
    ]);
    const totalComments = commentsAgg[0]?.total ?? 0;

    // ── 7-day SOS bar chart ──────────────────────────────────
    const sevenDayChart = await safeAggregate(Post, [
      { $match: { type: "sos", createdAt: { $gte: weekAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%a", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ── Top skills breakdown (donut chart) ──────────────────
    // FIX: preserveNullAndEmptyArrays (not preserveNullAndEmpty)
    const skillBreakdown = await safeAggregate(User, [
      {
        $unwind: {
          path: "$skills",
          preserveNullAndEmptyArrays: false, // ← correct option name
        },
      },
      { $group: { _id: "$skills", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        newSignupsToday,
        pendingVerification,
        activePosts,
        resolvedPosts,
        closedPosts,
        zeroReplyPosts,
        totalComments,
        tutorialsShared,
      },
      sevenDayChart,
      skillBreakdown,
    });
  } catch (err) {
    console.error("[Admin/dashboard/stats]", err);
    next(err);
  }
};

/* ── GET /api/admin/dashboard/recent ───────────────────────
   5 newest sign-ups + 5 newest active posts                */
const getRecent = async (req, res, next) => {
  try {
    const recentUsers = await User.find(activeUserFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        "handle firstName lastName avatar skills isEmailVerified isActive createdAt",
      );

    const recentPosts = await Post.find({ status: "active" })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("author", "handle avatar")
      .select("title type status replyCount views createdAt");

    res.json({ success: true, recentUsers, recentPosts });
  } catch (err) {
    console.error("[Admin/dashboard/recent]", err);
    next(err);
  }
};

module.exports = { getStats, getRecent };
