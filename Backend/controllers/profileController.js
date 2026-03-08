// Backend/controllers/profileController.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Powers the profile page. Returns the current user's full profile, their
//   posts (filterable), activity timeline, and friends list. Also handles
//   profile and hobbies updates.
//
//   All routes are protected by JWT — the current user is always req.user.
//
//   Endpoints:
//     GET   /api/profile              → getProfile
//     PATCH /api/profile              → updateProfile
//     GET   /api/profile/posts        → getProfilePosts
//     GET   /api/profile/activity     → getActivity
//     GET   /api/profile/friends      → getFriends
//     PATCH /api/profile/hobbies      → updateHobbies
// ─────────────────────────────────────────────────────────────────────────────
const User = require("../models/User");
const Post = require("../models/Post");
const Activity = require("../models/Activity");

// ── Points breakdown config ────────────────────────────────
// Maps a label + icon to the user field that stores its value.
// The frontend renders this as the animated bar chart.
const POINTS_BREAKDOWN = [
  {
    label: "Community Help Responses",
    field: "helpedCount", // User field
    perPt: 10, // points per unit
    color: "#7a8f52",
    bg: "#e6ecda",
    icon: '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>',
  },
  {
    label: "Distress Posts Resolved",
    field: "resolvedCount", // derived from Post query
    perPt: 15,
    color: "#6ab04c",
    bg: "#e8f5e3",
    icon: '<polyline points="20 6 9 17 4 12"/>',
  },
  {
    label: "Resources Shared",
    field: "resourceCount", // derived from Post query
    perPt: 10,
    color: "#a8ba7e",
    bg: "#f0f5e6",
    icon: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  },
  {
    label: "Craft Tutorials Posted",
    field: "tutorialCount", // derived from Post query
    perPt: 10,
    color: "#9a6d1e",
    bg: "#fdf3e0",
    icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  },
  {
    label: "Friends Invited",
    field: "friendCount", // user.friends.length
    perPt: 5,
    color: "#5e6e3b",
    bg: "#e6ecda",
    icon: '<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  },
];

// ── System badge catalogue ─────────────────────────────────
// Locked/unlocked determined by matching badge name against user.badges[]
const ALL_BADGES = [
  { emoji: "🌱", name: "First Assist", pts: "50 pts" },
  { emoji: "🤝", name: "Helper", pts: "100 pts" },
  { emoji: "⭐", name: "Top Responder", pts: "200 pts" },
  { emoji: "🔥", name: "30-day Streak", pts: "150 pts" },
  { emoji: "🧶", name: "Yarn Mentor", pts: "300 pts" },
  { emoji: "🌿", name: "Sage Helper", pts: "500 pts" },
  { emoji: "🏆", name: "Master Crafter", pts: "1000 pts" },
  { emoji: "🌟", name: "Community Star", pts: "500 pts" },
  { emoji: "💎", name: "Diamond Guild", pts: "2000 pts" },
  { emoji: "🛡️", name: "Guardian", pts: "750 pts" },
];

/* ─────────────────────────────────────────────────────────
   GET /api/profile
   Returns the full profile shaped for the frontend.
   Includes: hero, stats, points breakdown, badges, hobbies,
   friends (first 8), and details panel.
───────────────────────────────────────────────────────── */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId)
      .select("-password")
      .populate("friends", "name firstName lastName handle avatar")
      .lean();

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // ── Post counts (one aggregation, faster than 4 queries) ──
    const postAgg = await Post.aggregate([
      { $match: { author: user._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
          tutorials: { $sum: { $cond: [{ $eq: ["$type", "tut"] }, 1, 0] } },
          resources: { $sum: { $cond: [{ $eq: ["$type", "res"] }, 1, 0] } },
        },
      },
    ]);
    const pc = postAgg[0] || {
      total: 0,
      resolved: 0,
      tutorials: 0,
      resources: 0,
    };

    // ── Points breakdown values ────────────────────────────
    const breakdownValues = {
      helpedCount: user.helpedCount || 0,
      resolvedCount: pc.resolved,
      resourceCount: pc.resources,
      tutorialCount: pc.tutorials,
      friendCount: user.friends?.length || 0,
    };

    const totalPts = user.points || 0;
    const pointsBreakdown = POINTS_BREAKDOWN.map((row) => ({
      label: row.label,
      color: row.color,
      bg: row.bg,
      icon: row.icon,
      val: breakdownValues[row.field] * row.perPt,
      raw: breakdownValues[row.field],
      max: totalPts || 1, // avoid divide-by-zero
    }));

    // ── Badges: merge earned + locked catalogue ────────────
    const earnedNames = new Set(user.badges || []);
    const badges = ALL_BADGES.map((b) => ({
      ...b,
      locked: !earnedNames.has(b.name),
    }));

    // ── Member since (human readable) ─────────────────────
    const memberSince = new Date(user.createdAt).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });

    // ── Friends (first 8 for the strip) ───────────────────
    const friendsStrip = (user.friends || []).slice(0, 8).map((f) => ({
      id: f._id,
      name: f.name || `${f.firstName} ${f.lastName}`.trim(),
      handle: f.handle,
      avatar: f.avatar,
    }));

    // ── Shape the response ────────────────────────────────
    const profile = {
      // Hero
      id: user._id,
      name: user.name || `${user.firstName} ${user.lastName}`.trim(),
      handle: user.handle,
      bio: user.bio || "",
      location: user.location || "",
      avatar: user.avatar || "",
      bannerColor: user.bannerColor || "#7a8f52",
      memberSince,

      // Stats
      friendCount: user.friends?.length || 0,
      points: totalPts,
      postCount: pc.total,
      helpedCount: user.helpedCount || 0,
      resolvedCount: pc.resolved,
      rank: (() => {
        const pts = user.points || 0;
        if (pts >= 2000) return "🏆 Master";
        if (pts >= 1500) return "🌿 Sage";
        if (pts >= 800) return "⭐ Responder";
        if (pts >= 300) return "🌱 Member";
        return "🌱 New";
      })(),

      // Points breakdown for the bar chart
      pointsBreakdown,

      // Badges (earned + locked catalogue)
      badges,

      // Hobbies / crafts
      hobbies: [...(user.hobbies || []), ...(user.skills || [])],

      // Friends strip
      friendsStrip,

      // Details panel
      details: {
        location: user.location || "",
        website: user.website || "",
        businessType: user.businessType || "",
        memberSince,
        contact: user.contact || "",
        instagram: user.instagram || "",
      },
    };

    return res.status(200).json({ success: true, profile });
  } catch (err) {
    console.error("[getProfile]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/profile
   Updates editable profile fields.
   Body can contain any subset of: name, bio, location,
   website, businessType, contact, instagram, bannerColor.
───────────────────────────────────────────────────────── */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const ALLOWED = [
      "bio",
      "location",
      "website",
      "businessType",
      "contact",
      "instagram",
      "bannerColor",
      "firstName",
      "lastName",
    ];
    const updates = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Derive name if first/last changed
    if (updates.firstName || updates.lastName) {
      const user = await User.findById(userId)
        .select("firstName lastName")
        .lean();
      updates.name =
        `${updates.firstName || user.firstName} ${updates.lastName || user.lastName}`.trim();
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true, select: "-password" },
    ).lean();

    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Log activity
    // Profile updates are not meaningful feed events — activity log skipped

    return res.status(200).json({
      success: true,
      message: "Profile updated",
      user: {
        name: updated.name,
        bio: updated.bio,
        location: updated.location,
        website: updated.website,
        businessType: updated.businessType,
        contact: updated.contact,
        instagram: updated.instagram,
        bannerColor: updated.bannerColor,
      },
    });
  } catch (err) {
    console.error("[updateProfile]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/profile/posts?filter=all|distress|resolved
   Returns the current user's posts shaped for the post cards.
───────────────────────────────────────────────────────── */
exports.getProfilePosts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const filter = req.query.filter || "all";

    const query = { author: userId };
    if (filter === "distress") query.type = "sos";
    if (filter === "resolved") query.status = "resolved";

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const TYPE_CAT = {
      sos: "Distress Call",
      tut: "Tutorial",
      com: "Community",
      res: "Resource",
    };

    const shaped = posts.map((p) => ({
      id: p._id,
      type: p.type,
      cat: TYPE_CAT[p.type] ?? p.type,
      title: p.title,
      status: p.status,
      resolved: p.status === "resolved",
      tags: p.tags,
      comments: p.replyCount,
      helps: 0, // extend with helpfulVotes count if needed
      severity: _severity(p), // calculated for SOS posts
      time: _fmtDate(p.createdAt),
      createdAt: p.createdAt,
    }));

    return res.status(200).json({ success: true, posts: shaped });
  } catch (err) {
    console.error("[getProfilePosts]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/profile/activity
   Returns the 15 most recent Activity docs for the user.
   Falls back to deriving from recent posts if none exist.
───────────────────────────────────────────────────────── */
exports.getActivity = async (req, res) => {
  try {
    const userId = req.user.userId;

    let activities = await Activity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    // ── Fallback: derive from recent posts if no Activity docs ──
    if (!activities.length) {
      const recentPosts = await Post.find({ author: userId })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();

      const TYPE_EMOJI = { sos: "🆘", tut: "✍️", com: "💬", res: "📦" };
      const TYPE_VERB = {
        sos: "Posted a distress call",
        tut: "Shared a tutorial",
        com: "Posted in community",
        res: "Shared a resource",
      };

      activities = recentPosts.map((p) => ({
        _id: p._id,
        emoji: TYPE_EMOJI[p.type] ?? "📄",
        text: `${TYPE_VERB[p.type] ?? "Posted"}: <strong>${_escapeHTML(p.title)}</strong>`,
        createdAt: p.createdAt,
      }));
    } else {
      // Map Activity type → emoji
      const EMOJI_MAP = {
        helped: "🤝",
        posted: "✍️",
        replied: "💬",
        badge_earned: "⭐",
        rank_up: "🌿",
        tutorial: "🧶",
        resolved: "✅",
        friend_added: "👋",
      };
      activities = activities.map((a) => ({
        _id: a._id,
        emoji: EMOJI_MAP[a.type] ?? "📄",
        text: a.text,
        createdAt: a.createdAt,
      }));
    }

    // Add human-readable relative time
    const shaped = activities.map((a) => ({
      ...a,
      timeAgo: _timeAgo(a.createdAt),
    }));

    return res.status(200).json({ success: true, activity: shaped });
  } catch (err) {
    console.error("[getActivity]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/profile/friends
   Returns all friends (populated) for the "See all" view.
───────────────────────────────────────────────────────── */
exports.getFriends = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId)
      .select("friends")
      .populate("friends", "name firstName lastName handle avatar points")
      .lean();

    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const friends = (user.friends || []).map((f) => ({
      id: f._id,
      name: f.name || `${f.firstName} ${f.lastName}`.trim(),
      handle: f.handle,
      avatar: f.avatar,
      points: f.points,
    }));

    return res.status(200).json({ success: true, friends });
  } catch (err) {
    console.error("[getFriends]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/profile/hobbies
   Body: { hobbies: string[] }
   Replaces the user's hobbies array.
───────────────────────────────────────────────────────── */
exports.updateHobbies = async (req, res) => {
  try {
    const userId = req.user.userId;
    const hobbies = req.body.hobbies;

    if (!Array.isArray(hobbies)) {
      return res
        .status(400)
        .json({ success: false, message: "hobbies must be an array" });
    }

    // Sanitise: trim, deduplicate, max 20 items, max 50 chars each
    const clean = [
      ...new Set(
        hobbies.map((h) => String(h).trim().slice(0, 50)).filter(Boolean),
      ),
    ].slice(0, 20);

    await User.findByIdAndUpdate(userId, { $set: { hobbies: clean } });

    return res.status(200).json({ success: true, hobbies: clean });
  } catch (err) {
    console.error("[updateHobbies]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Private helpers ───────────────────────────────────────
function _severity(post) {
  if (post.type !== "sos") return null;
  const ageHours = (Date.now() - new Date(post.createdAt).getTime()) / 3600000;
  if (ageHours < 12 && post.replyCount < 3) return "High";
  if (ageHours < 48 || post.replyCount < 8) return "Medium";
  return "Low";
}

function _fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function _timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return `${Math.floor(d / 7)} week${Math.floor(d / 7) !== 1 ? "s" : ""} ago`;
}

function _escapeHTML(str = "") {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
