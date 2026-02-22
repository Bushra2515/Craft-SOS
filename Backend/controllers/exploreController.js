// Backend/controllers/exploreController.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Handles all Explore page data. Five endpoints — posts (with filter/sort/
//   search/pagination), featured crafters, trending topics, active SOS
//   requests, and the helpers leaderboard.
//   All routes are protected (JWT required).
// ─────────────────────────────────────────────────────────────────────────────
const Post = require("../models/Post");
const User = require("../models/User");

/* ── category filter → Mongoose query helper ─────────────────────────────── */
// Maps the explore page's category pill values to Post schema fields.
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
    // Financial / order / supplier are tag-based, not a separate type field.
    // We search inside the tags array so any post tagged correctly will match.
    case "financial":
      return { tags: { $in: [/financial/i, /vat/i, /pricing/i, /money/i] } };
    case "order":
      return {
        tags: { $in: [/order/i, /courier/i, /shipping/i, /delivery/i] },
      };
    case "supplier":
      return { tags: { $in: [/supplier/i, /wholesale/i, /material/i] } };
    default:
      return {}; // "all" — no restriction
  }
}

/* ─────────────────────────────────────────────────────────
   GET /api/explore/posts
   Query params:
     filter   — category pill value  (default: "all")
     sort     — "recent" | "urgent" | "popular"   (default: "recent")
     search   — free-text search string
     page     — page number, 1-based              (default: 1)
     limit    — posts per page                    (default: 5)
───────────────────────────────────────────────────────── */
exports.getExplorePosts = async (req, res) => {
  try {
    const {
      filter = "all",
      sort = "recent",
      search = "",
      page = 1,
      limit = 5,
    } = req.query;

    // ── Build query ───────────────────────────────────────
    const query = buildCategoryFilter(filter);

    if (search.trim()) {
      // Full-text search across title, body, and tags
      query.$or = [
        { title: { $regex: search.trim(), $options: "i" } },
        { body: { $regex: search.trim(), $options: "i" } },
        { tags: { $regex: search.trim(), $options: "i" } },
      ];
    }

    // ── Sort ──────────────────────────────────────────────
    let sortObj = { createdAt: -1 }; // default: recent
    if (sort === "popular") sortObj = { replyCount: -1, views: -1 };
    if (sort === "urgent") sortObj = { createdAt: -1 }; // urgent: handled client-side by severity; server still sorts by date

    // ── Paginate ──────────────────────────────────────────
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(20, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum)
        .populate("author", "name firstName lastName handle avatar")
        .lean(),
      Post.countDocuments(query),
    ]);

    // ── Annotate isSaved for the current user ─────────────
    const userId = req.user.userId.toString();
    const shaped = posts.map((p) => ({
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
   Returns the 6 most active users sorted by points.
   Excludes the current user so you don't follow yourself.
───────────────────────────────────────────────────────── */
exports.getFeaturedCrafters = async (req, res) => {
  try {
    const userId = req.user.userId;

    const crafters = await User.find({ _id: { $ne: userId }, isActive: true })
      .sort({ points: -1 })
      .limit(6)
      .select(
        "firstName lastName handle avatar points followers hobbies skills",
      )
      .lean();

    const shaped = crafters.map((u) => ({
      id: u._id,
      name: u.name || `${u.firstName} ${u.lastName}`.trim(),
      handle: u.handle || `@${u.firstName?.toLowerCase()}`,
      avatar: u.avatar,
      points: u.points,
      tags: [...(u.skills || []), ...(u.hobbies || [])].slice(0, 3),
      followers: u.followers?.length ?? 0,
      isFollowed:
        Array.isArray(u.followers) &&
        u.followers.some((id) => id?.toString() === userId.toString()),
    }));

    return res.status(200).json({ success: true, crafters: shaped });
  } catch (err) {
    console.error("[getFeaturedCrafters]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/explore/trends
   Aggregates the most-used tags from posts in the last 30 days.
   Returns top 6 tags with their post count.
───────────────────────────────────────────────────────── */
exports.getTrendingTopics = async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const results = await Post.aggregate([
      { $match: { createdAt: { $gte: since }, status: "active" } },
      { $unwind: "$tags" }, // one doc per tag
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
      { $project: { _id: 0, name: "$_id", count: 1 } },
    ]);

    // Emoji map — pure cosmetic, client could also own this
    const emojiMap = {
      financial: "💸",
      vat: "💸",
      pricing: "💸",
      money: "💸",
      yarn: "🧶",
      knitting: "🧶",
      dyeing: "🌿",
      supplier: "📦",
      courier: "📦",
      shipping: "📦",
      community: "🤝",
      network: "🤝",
      pattern: "📐",
      license: "📐",
      fashion: "🌿",
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
   Returns the 4 most recent open SOS posts for the
   "Active Help Needed" sidebar panel.
───────────────────────────────────────────────────────── */
exports.getActiveRequests = async (req, res) => {
  try {
    const posts = await Post.find({ type: "sos", status: "active" })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("author", "name firstName lastName handle avatar")
      .lean();

    const shaped = posts.map((p) => ({
      id: p._id,
      title: p.title,
      preview: p.body.slice(0, 60) + (p.body.length > 60 ? "…" : ""),
      author: {
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
   Returns the top 5 users by helpedCount this month.
───────────────────────────────────────────────────────── */
exports.getLeaderboard = async (req, res) => {
  try {
    const leaders = await User.find({ isActive: true })
      .sort({ helpedCount: -1, points: -1 })
      .limit(5)
      .select("firstName lastName handle avatar points helpedCount badges")
      .lean();

    const RANK_BADGES = ["🌟", "🏆", "🥉", "🌿", "🌿"];
    const RANK_CLASS = ["gold", "silver", "bronze", "", ""];

    const shaped = leaders.map((u, i) => ({
      rank: i + 1,
      id: u._id,
      name: u.name || `${u.firstName} ${u.lastName}`.trim(),
      handle: u.handle,
      avatar: u.avatar,
      points: u.points,
      badge: RANK_BADGES[i] ?? "🌿",
      rankClass: RANK_CLASS[i] ?? "",
    }));

    return res.status(200).json({ success: true, leaderboard: shaped });
  } catch (err) {
    console.error("[getLeaderboard]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
