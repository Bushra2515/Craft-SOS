// // // Backend/controllers/exploreController.js
// // // ─────────────────────────────────────────────────────────────────────────────
// // // Endpoints:
// // //   GET /api/explore/posts        — paginated feed (filter/sort/search/region)
// // //   GET /api/explore/crafters     — top 6 by points, non-admin
// // //   GET /api/explore/trends       — top tags from last 30 days
// // //   GET /api/explore/active       — recent open SOS posts, non-admin
// // //   GET /api/explore/leaderboard  — top helpers, non-admin
// // //   GET /api/explore/search       — unified live search (posts+people+challenges+badges)
// // //   GET /api/explore/regions      — real user-location counts from DB
// // // ─────────────────────────────────────────────────────────────────────────────
// // const Post = require("../models/Post");
// // const User = require("../models/User");
// // const Challenge = require("../models/Challenge");

// // // Badge model may not exist in all environments — guard gracefully
// // let Badge;
// // try {
// //   Badge = require("../models/Badge");
// // } catch (_) {
// //   Badge = null;
// // }

// // /* ── Shared filter that strips admin accounts from every query ─────────── */
// // const NON_ADMIN = { role: { $ne: "admin" }, isActive: true };

// // /* ── Maps category pill values → Mongoose query objects ─────────────────── */
// // function buildCategoryFilter(filter) {
// //   switch (filter) {
// //     case "distress":
// //       return { type: "sos", status: "active" };
// //     case "tutorial":
// //       return { type: "tut" };
// //     case "community":
// //       return { type: "com" };
// //     case "resource":
// //       return { type: "res" };
// //     case "resolved":
// //       return { status: "resolved" };
// //     case "financial":
// //       return { tags: { $in: [/financial/i, /vat/i, /pricing/i, /money/i] } };
// //     case "order":
// //       return {
// //         tags: { $in: [/order/i, /courier/i, /shipping/i, /delivery/i] },
// //       };
// //     case "supplier":
// //       return { tags: { $in: [/supplier/i, /wholesale/i, /material/i] } };
// //     default:
// //       return {};
// //   }
// // }

// // /* ─────────────────────────────────────────────────────────
// //    GET /api/explore/posts
// //    Query: filter, sort, search, page, limit, region
// // ───────────────────────────────────────────────────────── */
// // exports.getExplorePosts = async (req, res) => {
// //   try {
// //     const {
// //       filter = "all",
// //       sort = "recent",
// //       search = "",
// //       page = 1,
// //       limit = 5,
// //       region = "",
// //     } = req.query;

// //     const query = buildCategoryFilter(filter);

// //     // Text search across title, body, tags
// //     if (search.trim()) {
// //       query.$or = [
// //         { title: { $regex: search.trim(), $options: "i" } },
// //         { body: { $regex: search.trim(), $options: "i" } },
// //         { tags: { $regex: search.trim(), $options: "i" } },
// //       ];
// //     }

// //     // Region: find users in that region → filter posts by those author IDs
// //     if (region && region !== "all") {
// //       const regionUsers = await User.find({
// //         location: { $regex: region, $options: "i" },
// //         ...NON_ADMIN,
// //       })
// //         .select("_id")
// //         .lean();
// //       const ids = regionUsers.map((u) => u._id);
// //       query.author = ids.length ? { $in: ids } : { $in: [] };
// //     }

// //     let sortObj = { createdAt: -1 };
// //     if (sort === "popular") sortObj = { replyCount: -1, views: -1 };

// //     const pageNum = Math.max(1, parseInt(page, 10));
// //     const limitNum = Math.max(1, Math.min(20, parseInt(limit, 10)));
// //     const skip = (pageNum - 1) * limitNum;

// //     const [posts, total] = await Promise.all([
// //       Post.find(query)
// //         .sort(sortObj)
// //         .skip(skip)
// //         .limit(limitNum)
// //         .populate(
// //           "author",
// //           "name firstName lastName handle avatar location role",
// //         )
// //         .lean(),
// //       Post.countDocuments(query),
// //     ]);

// //     const userId = req.user.userId.toString();
// //     const shaped = posts
// //       .filter((p) => p.author?.role !== "admin")
// //       .map((p) => ({
// //         id: p._id,
// //         type: p.type,
// //         status: p.status,
// //         title: p.title,
// //         body: p.body,
// //         tags: p.tags,
// //         views: p.views,
// //         replyCount: p.replyCount,
// //         saveCount: p.saves?.length ?? 0,
// //         isSaved:
// //           Array.isArray(p.saves) &&
// //           p.saves.some((id) => id?.toString() === userId),
// //         author: p.author
// //           ? {
// //               id: p.author._id,
// //               name:
// //                 p.author.name ||
// //                 `${p.author.firstName} ${p.author.lastName}`.trim(),
// //               handle: p.author.handle,
// //               avatar: p.author.avatar,
// //               location: p.author.location || "",
// //             }
// //           : null,
// //         createdAt: p.createdAt,
// //         resolvedAt: p.resolvedAt,
// //       }));

// //     return res.status(200).json({
// //       success: true,
// //       posts: shaped,
// //       total,
// //       page: pageNum,
// //       pages: Math.ceil(total / limitNum),
// //       hasMore: pageNum * limitNum < total,
// //     });
// //   } catch (err) {
// //     console.error("[getExplorePosts]", err);
// //     return res.status(500).json({ success: false, message: "Server error" });
// //   }
// // };

// // /* ─────────────────────────────────────────────────────────
// //    GET /api/explore/crafters
// //    Top 6 by points. Excludes the current user AND admins.
// // ───────────────────────────────────────────────────────── */
// // exports.getFeaturedCrafters = async (req, res) => {
// //   try {
// //     const userId = req.user.userId;

// //     const crafters = await User.find({ _id: { $ne: userId }, ...NON_ADMIN })
// //       .sort({ points: -1 })
// //       .limit(6)
// //       .select(
// //         "firstName lastName handle avatar points followers hobbies skills location",
// //       )
// //       .lean();

// //     const shaped = crafters.map((u) => ({
// //       id: u._id,
// //       name: u.name || `${u.firstName} ${u.lastName}`.trim(),
// //       handle: u.handle || `@${u.firstName?.toLowerCase()}`,
// //       avatar: u.avatar,
// //       points: u.points,
// //       location: u.location || "",
// //       tags: [...(u.skills || []), ...(u.hobbies || [])].slice(0, 3),
// //       followers: u.followers?.length ?? 0,
// //       isFollowed:
// //         Array.isArray(u.followers) &&
// //         u.followers.some((id) => id?.toString() === userId.toString()),
// //     }));

// //     return res.status(200).json({ success: true, crafters: shaped });
// //   } catch (err) {
// //     console.error("[getFeaturedCrafters]", err);
// //     return res.status(500).json({ success: false, message: "Server error" });
// //   }
// // };

// // /* ─────────────────────────────────────────────────────────
// //    GET /api/explore/trends
// // ───────────────────────────────────────────────────────── */
// // exports.getTrendingTopics = async (req, res) => {
// //   try {
// //     const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

// //     const results = await Post.aggregate([
// //       { $match: { createdAt: { $gte: since }, status: "active" } },
// //       { $unwind: "$tags" },
// //       { $group: { _id: "$tags", count: { $sum: 1 } } },
// //       { $sort: { count: -1 } },
// //       { $limit: 8 },
// //       { $project: { _id: 0, name: "$_id", count: 1 } },
// //     ]);

// //     const emojiMap = {
// //       financial: "💸",
// //       vat: "💸",
// //       pricing: "💸",
// //       money: "💸",
// //       yarn: "🧶",
// //       knitting: "🧶",
// //       crochet: "🧶",
// //       wool: "🧶",
// //       dye: "🌿",
// //       fashion: "🌿",
// //       fabric: "🌿",
// //       supplier: "📦",
// //       courier: "📦",
// //       shipping: "📦",
// //       delivery: "📦",
// //       community: "🤝",
// //       network: "🤝",
// //       pattern: "📐",
// //       license: "📐",
// //       digital: "💻",
// //       paint: "🎨",
// //       resin: "🎨",
// //       colour: "🎨",
// //       color: "🎨",
// //       etsy: "🛒",
// //       sell: "🛒",
// //       market: "🛒",
// //       shop: "🛒",
// //     };

// //     const trends = results.map((t) => {
// //       const key = t.name.toLowerCase();
// //       const emoji =
// //         Object.entries(emojiMap).find(([k]) => key.includes(k))?.[1] ?? "🏷️";
// //       return {
// //         name: t.name,
// //         count: t.count,
// //         label: `${t.count} post${t.count !== 1 ? "s" : ""} this month`,
// //         emoji,
// //       };
// //     });

// //     return res.status(200).json({ success: true, trends });
// //   } catch (err) {
// //     console.error("[getTrendingTopics]", err);
// //     return res.status(500).json({ success: false, message: "Server error" });
// //   }
// // };

// // /* ─────────────────────────────────────────────────────────
// //    GET /api/explore/active
// //    5 most recent open SOS posts. Excludes admin-authored.
// // ───────────────────────────────────────────────────────── */
// // exports.getActiveRequests = async (req, res) => {
// //   try {
// //     const posts = await Post.find({ type: "sos", status: "active" })
// //       .sort({ createdAt: -1 })
// //       .limit(7) // fetch extra to account for admin filter
// //       .populate("author", "name firstName lastName handle avatar role")
// //       .lean();

// //     const shaped = posts
// //       .filter((p) => p.author?.role !== "admin")
// //       .slice(0, 5)
// //       .map((p) => ({
// //         id: p._id,
// //         title: p.title,
// //         // Strip HTML tags so the preview is clean plain text
// //         preview: p.body.replace(/<[^>]+>/g, "").slice(0, 70) + "…",
// //         replyCount: p.replyCount || 0,
// //         author: {
// //           id: p.author?._id,
// //           name:
// //             p.author?.name ||
// //             `${p.author?.firstName} ${p.author?.lastName}`.trim(),
// //           handle: p.author?.handle,
// //           avatar: p.author?.avatar,
// //         },
// //       }));

// //     return res.status(200).json({ success: true, requests: shaped });
// //   } catch (err) {
// //     console.error("[getActiveRequests]", err);
// //     return res.status(500).json({ success: false, message: "Server error" });
// //   }
// // };

// // /* ─────────────────────────────────────────────────────────
// //    GET /api/explore/leaderboard
// //    Top 5 by helpedCount. Excludes admins.
// // ───────────────────────────────────────────────────────── */
// // exports.getLeaderboard = async (req, res) => {
// //   try {
// //     const leaders = await User.find(NON_ADMIN)
// //       .sort({ helpedCount: -1, points: -1 })
// //       .limit(5)
// //       .select("firstName lastName handle avatar points helpedCount")
// //       .lean();

// //     const MEDALS = ["🥇", "🥈", "🥉", "🌿", "🌿"];
// //     const RANK_CLS = ["gold", "silver", "bronze", "", ""];

// //     const shaped = leaders.map((u, i) => ({
// //       rank: i + 1,
// //       id: u._id,
// //       name: u.name || `${u.firstName} ${u.lastName}`.trim(),
// //       handle: u.handle,
// //       avatar: u.avatar,
// //       points: u.points,
// //       helped: u.helpedCount || 0,
// //       badge: MEDALS[i] ?? "🌿",
// //       rankClass: RANK_CLS[i] ?? "",
// //     }));

// //     return res.status(200).json({ success: true, leaderboard: shaped });
// //   } catch (err) {
// //     console.error("[getLeaderboard]", err);
// //     return res.status(500).json({ success: false, message: "Server error" });
// //   }
// // };

// // /* ─────────────────────────────────────────────────────────
// //    GET /api/explore/search?q=&type=all|posts|people|challenges|badges
// //    Unified live search — up to 5 results per group, debounced on client.
// // ───────────────────────────────────────────────────────── */
// // exports.getUnifiedSearch = async (req, res) => {
// //   try {
// //     const q = (req.query.q || "").trim();
// //     const type = req.query.type || "all";

// //     if (!q || q.length < 2) {
// //       return res.status(200).json({
// //         success: true,
// //         results: { posts: [], people: [], challenges: [], badges: [] },
// //       });
// //     }

// //     const rx = { $regex: q, $options: "i" };
// //     const userId = req.user.userId;
// //     const out = { posts: [], people: [], challenges: [], badges: [] };
// //     const tasks = [];

// //     // ── Posts ─────────────────────────────────────────────
// //     if (type === "all" || type === "posts") {
// //       tasks.push(
// //         Post.find({ $or: [{ title: rx }, { tags: rx }] })
// //           .sort({ createdAt: -1 })
// //           .limit(5)
// //           .populate("author", "name firstName lastName handle role")
// //           .lean()
// //           .then((docs) => {
// //             out.posts = docs
// //               .filter((p) => p.author?.role !== "admin")
// //               .map((p) => ({
// //                 id: p._id,
// //                 type: p.type,
// //                 status: p.status,
// //                 title: p.title,
// //                 replyCount: p.replyCount || 0,
// //                 author: {
// //                   id: p.author?._id,
// //                   name:
// //                     p.author?.name ||
// //                     `${p.author?.firstName} ${p.author?.lastName}`.trim(),
// //                 },
// //                 createdAt: p.createdAt,
// //               }));
// //           }),
// //       );
// //     }

// //     // ── People ────────────────────────────────────────────
// //     if (type === "all" || type === "people") {
// //       tasks.push(
// //         User.find({
// //           _id: { $ne: userId },
// //           ...NON_ADMIN,
// //           $or: [
// //             { handle: rx },
// //             { firstName: rx },
// //             { lastName: rx },
// //             { name: rx },
// //             { hobbies: rx },
// //             { skills: rx },
// //           ],
// //         })
// //           .limit(5)
// //           .select("firstName lastName name handle avatar points location")
// //           .lean()
// //           .then((users) => {
// //             out.people = users.map((u) => ({
// //               id: u._id,
// //               name: u.name || `${u.firstName} ${u.lastName}`.trim(),
// //               handle: u.handle,
// //               avatar: u.avatar,
// //               points: u.points || 0,
// //               location: u.location || "",
// //             }));
// //           }),
// //       );
// //     }

// //     // ── Challenges ────────────────────────────────────────
// //     if (type === "all" || type === "challenges") {
// //       tasks.push(
// //         Challenge.find({ isActive: true, $or: [{ title: rx }, { meta: rx }] })
// //           .limit(4)
// //           .lean()
// //           .then((docs) => {
// //             out.challenges = docs.map((c) => ({
// //               id: c._id,
// //               icon: c.icon,
// //               title: c.title,
// //               meta: c.meta,
// //               participantCount: c.participants?.length ?? 0,
// //               endsAt: c.endsAt,
// //             }));
// //           }),
// //       );
// //     }

// //     // ── Badges ────────────────────────────────────────────
// //     if ((type === "all" || type === "badges") && Badge) {
// //       tasks.push(
// //         Badge.find({ isActive: true, $or: [{ name: rx }, { criteria: rx }] })
// //           .limit(4)
// //           .lean()
// //           .then((docs) => {
// //             out.badges = docs.map((b) => ({
// //               id: b._id,
// //               emoji: b.emoji || "🏅",
// //               name: b.name,
// //               description: b.criteria || "",
// //               holderCount: b.holderCount || 0,
// //             }));
// //           }),
// //       );
// //     }

// //     await Promise.all(tasks);
// //     return res.status(200).json({ success: true, results: out });
// //   } catch (err) {
// //     console.error("[getUnifiedSearch]", err);
// //     return res.status(500).json({ success: false, message: "Server error" });
// //   }
// // };

// // /* ─────────────────────────────────────────────────────────
// //    GET /api/explore/regions
// //    Aggregates non-empty, non-admin user location fields,
// //    sorted by count descending.
// // ───────────────────────────────────────────────────────── */
// // exports.getRegions = async (req, res) => {
// //   try {
// //     const regions = await User.aggregate([
// //       {
// //         $match: {
// //           location: { $exists: true, $ne: "" },
// //           isActive: true,
// //           role: { $ne: "admin" },
// //         },
// //       },
// //       { $group: { _id: "$location", count: { $sum: 1 } } },
// //       { $sort: { count: -1 } },
// //       { $limit: 12 },
// //       { $project: { _id: 0, name: "$_id", count: 1 } },
// //     ]);

// //     return res.status(200).json({ success: true, regions });
// //   } catch (err) {
// //     console.error("[getRegions]", err);
// //     return res.status(500).json({ success: false, message: "Server error" });
// //   }
// // };
// // Backend/controllers/exploreController.js
// // ─────────────────────────────────────────────────────────────────────────────
// // Endpoints:
// //   GET /api/explore/posts        — paginated feed (filter/sort/search/region)
// //   GET /api/explore/crafters     — top 6 by points, non-admin
// //   GET /api/explore/trends       — top tags from last 30 days
// //   GET /api/explore/active       — recent open SOS posts, non-admin
// //   GET /api/explore/leaderboard  — top helpers, non-admin
// //   GET /api/explore/search       — unified live search (posts+people+challenges+badges)
// //   GET /api/explore/regions      — real user-location counts from DB
// // ─────────────────────────────────────────────────────────────────────────────
// const Post = require("../models/Post");
// const User = require("../models/User");
// const Challenge = require("../models/Challenge");

// // Badge model may not exist in all environments — guard gracefully
// let Badge;
// try {
//   Badge = require("../models/Badge");
// } catch (_) {
//   Badge = null;
// }

// /* ── Shared filter that strips admin accounts from every query ─────────── */
// const NON_ADMIN = { role: { $ne: "admin" }, isActive: true };

// /* ── Maps category pill values → Mongoose query objects ─────────────────── */
// function buildCategoryFilter(filter) {
//   switch (filter) {
//     case "distress":
//       return { type: "sos", status: "active" };
//     case "tutorial":
//       return { type: "tut" };
//     case "community":
//       return { type: "com" };
//     case "resource":
//       return { type: "res" };
//     case "resolved":
//       return { status: "resolved" };
//     case "financial":
//       return { tags: { $in: [/financial/i, /vat/i, /pricing/i, /money/i] } };
//     case "order":
//       return {
//         tags: { $in: [/order/i, /courier/i, /shipping/i, /delivery/i] },
//       };
//     case "supplier":
//       return { tags: { $in: [/supplier/i, /wholesale/i, /material/i] } };
//     default:
//       return {};
//   }
// }

// /* ─────────────────────────────────────────────────────────
//    GET /api/explore/posts
//    Query: filter, sort, search, page, limit, region
// ───────────────────────────────────────────────────────── */
// exports.getExplorePosts = async (req, res) => {
//   try {
//     const {
//       filter = "all",
//       sort = "recent",
//       search = "",
//       page = 1,
//       limit = 5,
//       region = "",
//     } = req.query;

//     const query = buildCategoryFilter(filter);

//     if (search.trim()) {
//       query.$or = [
//         { title: { $regex: search.trim(), $options: "i" } },
//         { body: { $regex: search.trim(), $options: "i" } },
//         { tags: { $regex: search.trim(), $options: "i" } },
//       ];
//     }

//     if (region && region !== "all") {
//       const regionUsers = await User.find({
//         location: { $regex: region, $options: "i" },
//         ...NON_ADMIN,
//       })
//         .select("_id")
//         .lean();
//       const ids = regionUsers.map((u) => u._id);
//       query.author = ids.length ? { $in: ids } : { $in: [] };
//     }

//     let sortObj = { createdAt: -1 };
//     if (sort === "popular") sortObj = { replyCount: -1, views: -1 };

//     const pageNum = Math.max(1, parseInt(page, 10));
//     const limitNum = Math.max(1, Math.min(20, parseInt(limit, 10)));
//     const skip = (pageNum - 1) * limitNum;

//     const [posts, total] = await Promise.all([
//       Post.find(query)
//         .sort(sortObj)
//         .skip(skip)
//         .limit(limitNum)
//         .populate(
//           "author",
//           "name firstName lastName handle avatar location role",
//         )
//         .lean(),
//       Post.countDocuments(query),
//     ]);

//     const userId = req.user.userId.toString();
//     const shaped = posts
//       .filter((p) => p.author?.role !== "admin")
//       .map((p) => ({
//         id: p._id,
//         type: p.type,
//         status: p.status,
//         title: p.title,
//         body: p.body,
//         tags: p.tags,
//         views: p.views,
//         replyCount: p.replyCount,
//         saveCount: p.saves?.length ?? 0,
//         isSaved:
//           Array.isArray(p.saves) &&
//           p.saves.some((id) => id?.toString() === userId),
//         author: p.author
//           ? {
//               id: p.author._id,
//               name:
//                 p.author.name ||
//                 `${p.author.firstName} ${p.author.lastName}`.trim(),
//               handle: p.author.handle,
//               avatar: p.author.avatar,
//               location: p.author.location || "",
//             }
//           : null,
//         createdAt: p.createdAt,
//         resolvedAt: p.resolvedAt,
//       }));

//     return res.status(200).json({
//       success: true,
//       posts: shaped,
//       total,
//       page: pageNum,
//       pages: Math.ceil(total / limitNum),
//       hasMore: pageNum * limitNum < total,
//     });
//   } catch (err) {
//     console.error("[getExplorePosts]", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/explore/crafters
//    Top 6 by points. Excludes the current user AND admins.
//    Returns friendStatus per crafter so the frontend can
//    render the correct button state without an extra call.
//      none             — no relationship
//      pending_sent     — viewer sent a request (waiting)
//      pending_received — the crafter sent viewer a request
//      friends          — already connected
// ───────────────────────────────────────────────────────── */
// exports.getFeaturedCrafters = async (req, res) => {
//   try {
//     const userId = req.user.userId.toString();

//     // Fetch crafters + viewer's own friend data in parallel
//     const [crafters, viewer] = await Promise.all([
//       User.find({ _id: { $ne: userId }, ...NON_ADMIN })
//         .sort({ points: -1 })
//         .limit(6)
//         .select(
//           "firstName lastName handle avatar points followers hobbies skills location friends friendRequests",
//         )
//         .lean(),
//       User.findById(userId).select("friends friendRequests").lean(),
//     ]);

//     // viewer.friends        = people viewer is friends with
//     // viewer.friendRequests = IDs of people who sent viewer a request (incoming)
//     const viewerFriends = (viewer?.friends || []).map(String);
//     const viewerIncoming = (viewer?.friendRequests || []).map(String);

//     const shaped = crafters.map((u) => {
//       const uid = String(u._id);

//       // u.friendRequests = people who sent u a request → if viewer is there, viewer sent a request
//       const viewerSentRequest = (u.friendRequests || [])
//         .map(String)
//         .includes(userId);
//       const crafterSentRequest = viewerIncoming.includes(uid);
//       const areFriends = viewerFriends.includes(uid);

//       let friendStatus = "none";
//       if (areFriends) friendStatus = "friends";
//       else if (viewerSentRequest) friendStatus = "pending_sent";
//       else if (crafterSentRequest) friendStatus = "pending_received";

//       return {
//         id: u._id,
//         name: u.name || `${u.firstName} ${u.lastName}`.trim(),
//         handle: u.handle || `@${u.firstName?.toLowerCase()}`,
//         avatar: u.avatar,
//         points: u.points,
//         location: u.location || "",
//         tags: [...(u.skills || []), ...(u.hobbies || [])].slice(0, 3),
//         followers: u.followers?.length ?? 0,
//         friendStatus,
//       };
//     });

//     return res.status(200).json({ success: true, crafters: shaped });
//   } catch (err) {
//     console.error("[getFeaturedCrafters]", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/explore/trends
// ───────────────────────────────────────────────────────── */
// exports.getTrendingTopics = async (req, res) => {
//   try {
//     const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

//     const results = await Post.aggregate([
//       { $match: { createdAt: { $gte: since }, status: "active" } },
//       { $unwind: "$tags" },
//       { $group: { _id: "$tags", count: { $sum: 1 } } },
//       { $sort: { count: -1 } },
//       { $limit: 8 },
//       { $project: { _id: 0, name: "$_id", count: 1 } },
//     ]);

//     const emojiMap = {
//       financial: "💸",
//       vat: "💸",
//       pricing: "💸",
//       money: "💸",
//       yarn: "🧶",
//       knitting: "🧶",
//       crochet: "🧶",
//       wool: "🧶",
//       dye: "🌿",
//       fashion: "🌿",
//       fabric: "🌿",
//       supplier: "📦",
//       courier: "📦",
//       shipping: "📦",
//       delivery: "📦",
//       community: "🤝",
//       network: "🤝",
//       pattern: "📐",
//       license: "📐",
//       digital: "💻",
//       paint: "🎨",
//       resin: "🎨",
//       colour: "🎨",
//       color: "🎨",
//       etsy: "🛒",
//       sell: "🛒",
//       market: "🛒",
//       shop: "🛒",
//     };

//     const trends = results.map((t) => {
//       const key = t.name.toLowerCase();
//       const emoji =
//         Object.entries(emojiMap).find(([k]) => key.includes(k))?.[1] ?? "🏷️";
//       return {
//         name: t.name,
//         count: t.count,
//         label: `${t.count} post${t.count !== 1 ? "s" : ""} this month`,
//         emoji,
//       };
//     });

//     return res.status(200).json({ success: true, trends });
//   } catch (err) {
//     console.error("[getTrendingTopics]", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/explore/active
//    5 most recent open SOS posts. Excludes admin-authored.
// ───────────────────────────────────────────────────────── */
// exports.getActiveRequests = async (req, res) => {
//   try {
//     const posts = await Post.find({ type: "sos", status: "active" })
//       .sort({ createdAt: -1 })
//       .limit(7)
//       .populate("author", "name firstName lastName handle avatar role")
//       .lean();

//     const shaped = posts
//       .filter((p) => p.author?.role !== "admin")
//       .slice(0, 5)
//       .map((p) => ({
//         id: p._id,
//         title: p.title,
//         preview: p.body.replace(/<[^>]+>/g, "").slice(0, 70) + "…",
//         replyCount: p.replyCount || 0,
//         author: {
//           id: p.author?._id,
//           name:
//             p.author?.name ||
//             `${p.author?.firstName} ${p.author?.lastName}`.trim(),
//           handle: p.author?.handle,
//           avatar: p.author?.avatar,
//         },
//       }));

//     return res.status(200).json({ success: true, requests: shaped });
//   } catch (err) {
//     console.error("[getActiveRequests]", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/explore/leaderboard
//    Top 5 by helpedCount. Excludes admins.
// ───────────────────────────────────────────────────────── */
// exports.getLeaderboard = async (req, res) => {
//   try {
//     const leaders = await User.find(NON_ADMIN)
//       .sort({ helpedCount: -1, points: -1 })
//       .limit(5)
//       .select("firstName lastName handle avatar points helpedCount")
//       .lean();

//     const MEDALS = ["🥇", "🥈", "🥉", "🌿", "🌿"];
//     const RANK_CLS = ["gold", "silver", "bronze", "", ""];

//     const shaped = leaders.map((u, i) => ({
//       rank: i + 1,
//       id: u._id,
//       name: u.name || `${u.firstName} ${u.lastName}`.trim(),
//       handle: u.handle,
//       avatar: u.avatar,
//       points: u.points,
//       helped: u.helpedCount || 0,
//       badge: MEDALS[i] ?? "🌿",
//       rankClass: RANK_CLS[i] ?? "",
//     }));

//     return res.status(200).json({ success: true, leaderboard: shaped });
//   } catch (err) {
//     console.error("[getLeaderboard]", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/explore/search?q=&type=all|posts|people|challenges|badges
// ───────────────────────────────────────────────────────── */
// exports.getUnifiedSearch = async (req, res) => {
//   try {
//     const q = (req.query.q || "").trim();
//     const type = req.query.type || "all";

//     if (!q || q.length < 2) {
//       return res.status(200).json({
//         success: true,
//         results: { posts: [], people: [], challenges: [], badges: [] },
//       });
//     }

//     const rx = { $regex: q, $options: "i" };
//     const userId = req.user.userId;
//     const out = { posts: [], people: [], challenges: [], badges: [] };
//     const tasks = [];

//     if (type === "all" || type === "posts") {
//       tasks.push(
//         Post.find({ $or: [{ title: rx }, { tags: rx }] })
//           .sort({ createdAt: -1 })
//           .limit(5)
//           .populate("author", "name firstName lastName handle role")
//           .lean()
//           .then((docs) => {
//             out.posts = docs
//               .filter((p) => p.author?.role !== "admin")
//               .map((p) => ({
//                 id: p._id,
//                 type: p.type,
//                 status: p.status,
//                 title: p.title,
//                 replyCount: p.replyCount || 0,
//                 author: {
//                   id: p.author?._id,
//                   name:
//                     p.author?.name ||
//                     `${p.author?.firstName} ${p.author?.lastName}`.trim(),
//                 },
//                 createdAt: p.createdAt,
//               }));
//           }),
//       );
//     }

//     if (type === "all" || type === "people") {
//       tasks.push(
//         User.find({
//           _id: { $ne: userId },
//           ...NON_ADMIN,
//           $or: [
//             { handle: rx },
//             { firstName: rx },
//             { lastName: rx },
//             { name: rx },
//             { hobbies: rx },
//             { skills: rx },
//           ],
//         })
//           .limit(5)
//           .select("firstName lastName name handle avatar points location")
//           .lean()
//           .then((users) => {
//             out.people = users.map((u) => ({
//               id: u._id,
//               name: u.name || `${u.firstName} ${u.lastName}`.trim(),
//               handle: u.handle,
//               avatar: u.avatar,
//               points: u.points || 0,
//               location: u.location || "",
//             }));
//           }),
//       );
//     }

//     if (type === "all" || type === "challenges") {
//       tasks.push(
//         Challenge.find({ isActive: true, $or: [{ title: rx }, { meta: rx }] })
//           .limit(4)
//           .lean()
//           .then((docs) => {
//             out.challenges = docs.map((c) => ({
//               id: c._id,
//               icon: c.icon,
//               title: c.title,
//               meta: c.meta,
//               participantCount: c.participants?.length ?? 0,
//               endsAt: c.endsAt,
//             }));
//           }),
//       );
//     }

//     if ((type === "all" || type === "badges") && Badge) {
//       tasks.push(
//         Badge.find({ isActive: true, $or: [{ name: rx }, { criteria: rx }] })
//           .limit(4)
//           .lean()
//           .then((docs) => {
//             out.badges = docs.map((b) => ({
//               id: b._id,
//               emoji: b.emoji || "🏅",
//               name: b.name,
//               description: b.criteria || "",
//               holderCount: b.holderCount || 0,
//             }));
//           }),
//       );
//     }

//     await Promise.all(tasks);
//     return res.status(200).json({ success: true, results: out });
//   } catch (err) {
//     console.error("[getUnifiedSearch]", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/explore/regions
// ───────────────────────────────────────────────────────── */
// exports.getRegions = async (req, res) => {
//   try {
//     const regions = await User.aggregate([
//       {
//         $match: {
//           location: { $exists: true, $ne: "" },
//           isActive: true,
//           role: { $ne: "admin" },
//         },
//       },
//       { $group: { _id: "$location", count: { $sum: 1 } } },
//       { $sort: { count: -1 } },
//       { $limit: 12 },
//       { $project: { _id: 0, name: "$_id", count: 1 } },
//     ]);

//     return res.status(200).json({ success: true, regions });
//   } catch (err) {
//     console.error("[getRegions]", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };
// Backend/controllers/exploreController.js
// ─────────────────────────────────────────────────────────────────────────────
// Endpoints:
//   GET /api/explore/posts        — paginated feed (filter/sort/search/region)
//   GET /api/explore/crafters     — top 6 by points, non-admin
//   GET /api/explore/trends       — top tags from last 30 days
//   GET /api/explore/active       — recent open SOS posts, non-admin
//   GET /api/explore/leaderboard  — top helpers, non-admin
//   GET /api/explore/search       — unified live search (posts+people+challenges+badges)
//   GET /api/explore/regions      — real user-location counts from DB
// ─────────────────────────────────────────────────────────────────────────────
const Post = require("../models/Post");
const User = require("../models/User");
const Challenge = require("../models/Challenge");

// Badge model may not exist in all environments — guard gracefully
let Badge;
try {
  Badge = require("../models/Badge");
} catch (_) {
  Badge = null;
}

/* ── Shared filter that strips admin accounts from every query ─────────── */
const NON_ADMIN = { role: { $ne: "admin" }, isActive: true };

/* ── Maps category pill values → Mongoose query objects ─────────────────── */
function buildCategoryFilter(filter) {
  switch (filter) {
    case "distress":
      return { type: "sos", status: "active" };
    case "tutorial":
      return { type: "tut" };
    case "community":
      return { type: "com" };
    case "resource":
      return { type: "res" };
    case "resolved":
      return { status: "resolved" };
    case "financial":
      return { tags: { $in: [/financial/i, /vat/i, /pricing/i, /money/i] } };
    case "order":
      return {
        tags: { $in: [/order/i, /courier/i, /shipping/i, /delivery/i] },
      };
    case "supplier":
      return { tags: { $in: [/supplier/i, /wholesale/i, /material/i] } };
    default:
      return {};
  }
}

/* ─────────────────────────────────────────────────────────
   GET /api/explore/posts
   Query: filter, sort, search, page, limit, region
───────────────────────────────────────────────────────── */
exports.getExplorePosts = async (req, res) => {
  try {
    const {
      filter = "all",
      sort = "recent",
      search = "",
      page = 1,
      limit = 5,
      region = "",
    } = req.query;

    const query = buildCategoryFilter(filter);

    // Text search across title, body, tags
    if (search.trim()) {
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { body: { $regex: search.trim(), $options: "i" } },
        { tags: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // Region: find users in that region → filter posts by those author IDs
    if (region && region !== "all") {
      const regionUsers = await User.find({
        location: { $regex: region, $options: "i" },
        ...NON_ADMIN,
      })
        .select("_id")
        .lean();
      const ids = regionUsers.map((u) => u._id);
      query.author = ids.length ? { $in: ids } : { $in: [] };
    }

    let sortObj = { createdAt: -1 };
    if (sort === "popular") sortObj = { replyCount: -1, views: -1 };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(20, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .populate(
          "author",
          "name firstName lastName handle avatar location role",
        )
        .lean(),
      Post.countDocuments(query),
    ]);

    const userId = req.user.userId.toString();
    const shaped = posts
      .filter((p) => p.author?.role !== "admin")
      .map((p) => ({
        id: p._id,
        type: p.type,
        status: p.status,
        title: p.title,
        body: p.body,
        tags: p.tags,
        views: p.views,
        replyCount: p.replyCount,
        saveCount: p.saves?.length ?? 0,
        isSaved:
          Array.isArray(p.saves) &&
          p.saves.some((id) => id?.toString() === userId),
        author: p.author
          ? {
              id: p.author._id,
              name:
                p.author.name ||
                `${p.author.firstName} ${p.author.lastName}`.trim(),
              handle: p.author.handle,
              avatar: p.author.avatar,
              location: p.author.location || "",
            }
          : null,
        createdAt: p.createdAt,
        resolvedAt: p.resolvedAt,
      }));

    return res.status(200).json({
      success: true,
      posts: shaped,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      hasMore: pageNum * limitNum < total,
    });
  } catch (err) {
    console.error("[getExplorePosts]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/explore/crafters
   Top 6 by points. Excludes the current user AND admins.
   Returns friendStatus per crafter:
     none             — no relationship
     pending_sent     — viewer sent a request (waiting)
     pending_received — the crafter sent viewer a request
     friends          — already connected
───────────────────────────────────────────────────────── */
exports.getFeaturedCrafters = async (req, res) => {
  try {
    // Keep userId as original type (ObjectId) for MongoDB queries
    const userId = req.user.userId;
    const userIdStr = userId.toString(); // string only for JS .includes() comparisons

    // Fetch crafters + viewer's own friend data in parallel
    const [crafters, viewer] = await Promise.all([
      User.find({ _id: { $ne: userId }, ...NON_ADMIN })
        .sort({ points: -1 })
        .limit(6)
        .select(
          "firstName lastName handle avatar points followers hobbies skills location friends friendRequests",
        )
        .lean(),
      User.findById(userId).select("friends friendRequests").lean(),
    ]);

    // viewer.friends        = people viewer is already friends with
    // viewer.friendRequests = IDs of people who sent viewer a request (incoming)
    const viewerFriends = (viewer?.friends || []).map(String);
    const viewerIncoming = (viewer?.friendRequests || []).map(String);

    const shaped = crafters.map((u) => {
      const uid = String(u._id);

      // u.friendRequests = incoming requests TO u; if viewer is in there, viewer sent the request
      const viewerSentRequest = (u.friendRequests || [])
        .map(String)
        .includes(userIdStr);
      const crafterSentRequest = viewerIncoming.includes(uid);
      const areFriends = viewerFriends.includes(uid);

      let friendStatus = "none";
      if (areFriends) friendStatus = "friends";
      else if (viewerSentRequest) friendStatus = "pending_sent";
      else if (crafterSentRequest) friendStatus = "pending_received";

      return {
        id: u._id,
        name: u.name || `${u.firstName} ${u.lastName}`.trim(),
        handle: u.handle || `@${u.firstName?.toLowerCase()}`,
        avatar: u.avatar,
        points: u.points,
        location: u.location || "",
        tags: [...(u.skills || []), ...(u.hobbies || [])].slice(0, 3),
        followers: u.followers?.length ?? 0,
        friendStatus,
      };
    });

    return res.status(200).json({ success: true, crafters: shaped });
  } catch (err) {
    console.error("[getFeaturedCrafters]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/explore/trends
───────────────────────────────────────────────────────── */
exports.getTrendingTopics = async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const results = await Post.aggregate([
      { $match: { createdAt: { $gte: since }, status: "active" } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { _id: 0, name: "$_id", count: 1 } },
    ]);

    const emojiMap = {
      financial: "💸",
      vat: "💸",
      pricing: "💸",
      money: "💸",
      yarn: "🧶",
      knitting: "🧶",
      crochet: "🧶",
      wool: "🧶",
      dye: "🌿",
      fashion: "🌿",
      fabric: "🌿",
      supplier: "📦",
      courier: "📦",
      shipping: "📦",
      delivery: "📦",
      community: "🤝",
      network: "🤝",
      pattern: "📐",
      license: "📐",
      digital: "💻",
      paint: "🎨",
      resin: "🎨",
      colour: "🎨",
      color: "🎨",
      etsy: "🛒",
      sell: "🛒",
      market: "🛒",
      shop: "🛒",
    };

    const trends = results.map((t) => {
      const key = t.name.toLowerCase();
      const emoji =
        Object.entries(emojiMap).find(([k]) => key.includes(k))?.[1] ?? "🏷️";
      return {
        name: t.name,
        count: t.count,
        label: `${t.count} post${t.count !== 1 ? "s" : ""} this month`,
        emoji,
      };
    });

    return res.status(200).json({ success: true, trends });
  } catch (err) {
    console.error("[getTrendingTopics]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/explore/active
   5 most recent open SOS posts. Excludes admin-authored.
───────────────────────────────────────────────────────── */
exports.getActiveRequests = async (req, res) => {
  try {
    const posts = await Post.find({ type: "sos", status: "active" })
      .sort({ createdAt: -1 })
      .limit(7) // fetch extra to account for admin filter
      .populate("author", "name firstName lastName handle avatar role")
      .lean();

    const shaped = posts
      .filter((p) => p.author?.role !== "admin")
      .slice(0, 5)
      .map((p) => ({
        id: p._id,
        title: p.title,
        // Strip HTML tags so the preview is clean plain text
        preview: p.body.replace(/<[^>]+>/g, "").slice(0, 70) + "…",
        replyCount: p.replyCount || 0,
        author: {
          id: p.author?._id,
          name:
            p.author?.name ||
            `${p.author?.firstName} ${p.author?.lastName}`.trim(),
          handle: p.author?.handle,
          avatar: p.author?.avatar,
        },
      }));

    return res.status(200).json({ success: true, requests: shaped });
  } catch (err) {
    console.error("[getActiveRequests]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/explore/leaderboard
   Top 5 by helpedCount. Excludes admins.
───────────────────────────────────────────────────────── */
exports.getLeaderboard = async (req, res) => {
  try {
    const leaders = await User.find(NON_ADMIN)
      .sort({ helpedCount: -1, points: -1 })
      .limit(5)
      .select("firstName lastName handle avatar points helpedCount")
      .lean();

    const MEDALS = ["🥇", "🥈", "🥉", "🌿", "🌿"];
    const RANK_CLS = ["gold", "silver", "bronze", "", ""];

    const shaped = leaders.map((u, i) => ({
      rank: i + 1,
      id: u._id,
      name: u.name || `${u.firstName} ${u.lastName}`.trim(),
      handle: u.handle,
      avatar: u.avatar,
      points: u.points,
      helped: u.helpedCount || 0,
      badge: MEDALS[i] ?? "🌿",
      rankClass: RANK_CLS[i] ?? "",
    }));

    return res.status(200).json({ success: true, leaderboard: shaped });
  } catch (err) {
    console.error("[getLeaderboard]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/explore/search?q=&type=all|posts|people|challenges|badges
   Unified live search — up to 5 results per group, debounced on client.
───────────────────────────────────────────────────────── */
exports.getUnifiedSearch = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const type = req.query.type || "all";

    if (!q || q.length < 2) {
      return res.status(200).json({
        success: true,
        results: { posts: [], people: [], challenges: [], badges: [] },
      });
    }

    const rx = { $regex: q, $options: "i" };
    const userId = req.user.userId;
    const out = { posts: [], people: [], challenges: [], badges: [] };
    const tasks = [];

    // ── Posts ─────────────────────────────────────────────
    if (type === "all" || type === "posts") {
      tasks.push(
        Post.find({ $or: [{ title: rx }, { tags: rx }] })
          .sort({ createdAt: -1 })
          .limit(5)
          .populate("author", "name firstName lastName handle role")
          .lean()
          .then((docs) => {
            out.posts = docs
              .filter((p) => p.author?.role !== "admin")
              .map((p) => ({
                id: p._id,
                type: p.type,
                status: p.status,
                title: p.title,
                replyCount: p.replyCount || 0,
                author: {
                  id: p.author?._id,
                  name:
                    p.author?.name ||
                    `${p.author?.firstName} ${p.author?.lastName}`.trim(),
                },
                createdAt: p.createdAt,
              }));
          }),
      );
    }

    // ── People ────────────────────────────────────────────
    if (type === "all" || type === "people") {
      tasks.push(
        User.find({
          _id: { $ne: userId },
          ...NON_ADMIN,
          $or: [
            { handle: rx },
            { firstName: rx },
            { lastName: rx },
            { name: rx },
            { hobbies: rx },
            { skills: rx },
          ],
        })
          .limit(5)
          .select("firstName lastName name handle avatar points location")
          .lean()
          .then((users) => {
            out.people = users.map((u) => ({
              id: u._id,
              name: u.name || `${u.firstName} ${u.lastName}`.trim(),
              handle: u.handle,
              avatar: u.avatar,
              points: u.points || 0,
              location: u.location || "",
            }));
          }),
      );
    }

    // ── Challenges ────────────────────────────────────────
    if (type === "all" || type === "challenges") {
      tasks.push(
        Challenge.find({ isActive: true, $or: [{ title: rx }, { meta: rx }] })
          .limit(4)
          .lean()
          .then((docs) => {
            out.challenges = docs.map((c) => ({
              id: c._id,
              icon: c.icon,
              title: c.title,
              meta: c.meta,
              participantCount: c.participants?.length ?? 0,
              endsAt: c.endsAt,
            }));
          }),
      );
    }

    // ── Badges ────────────────────────────────────────────
    if ((type === "all" || type === "badges") && Badge) {
      tasks.push(
        Badge.find({ isActive: true, $or: [{ name: rx }, { criteria: rx }] })
          .limit(4)
          .lean()
          .then((docs) => {
            out.badges = docs.map((b) => ({
              id: b._id,
              emoji: b.emoji || "🏅",
              name: b.name,
              description: b.criteria || "",
              holderCount: b.holderCount || 0,
            }));
          }),
      );
    }

    await Promise.all(tasks);
    return res.status(200).json({ success: true, results: out });
  } catch (err) {
    console.error("[getUnifiedSearch]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/explore/regions
   Aggregates non-empty, non-admin user location fields,
   sorted by count descending.
───────────────────────────────────────────────────────── */
exports.getRegions = async (req, res) => {
  try {
    const regions = await User.aggregate([
      {
        $match: {
          location: { $exists: true, $ne: "" },
          isActive: true,
          role: { $ne: "admin" },
        },
      },
      { $group: { _id: "$location", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
      { $project: { _id: 0, name: "$_id", count: 1 } },
    ]);

    return res.status(200).json({ success: true, regions });
  } catch (err) {
    console.error("[getRegions]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
