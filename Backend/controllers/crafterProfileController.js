// Backend/controllers/crafterProfileController.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Powers the PUBLIC crafter profile page — the page OTHER users see when
//   viewing someone else's profile (crafter-profile.html?id=USER_ID).
//
//   This is DIFFERENT from profileController.js (which is the self-edit view).
//   Here we show full public data for any user, plus social actions (follow,
//   message link) and mutual friends visible to the logged-in viewer.
//
//   All routes require JWT — we need the viewer's ID to:
//     • Show follow/following state
//     • Show mutual friends
//     • Enforce friend-gate on message button
//
//   Endpoints:
//     GET  /api/crafter/:userId            → getCrafterProfile
//     GET  /api/crafter/:userId/posts      → getCrafterPosts?tab=posts|tutorials
//     GET  /api/crafter/:userId/friends    → getCrafterFriends
//     GET  /api/crafter/:userId/activity   → getCrafterActivity
//     POST /api/crafter/:userId/follow     → toggleFollow
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");
const User = require("../models/User");
const Post = require("../models/Post");
const Activity = require("../models/Activity");

// ── Badge catalogue (mirrors profileController) ─────────
const ALL_BADGES = [
  {
    id: "first_help",
    icon: "🆘",
    title: "First Responder",
    desc: "Responded to distress call in <1 hr",
    tier: "bronze",
  },
  {
    id: "top_responder",
    icon: "⭐",
    title: "Top Responder",
    desc: "Top 5% helpful responses in a month",
    tier: "gold",
  },
  {
    id: "mentor",
    icon: "🏆",
    title: "Mentor Rank",
    desc: "Reached 2,000 community points",
    tier: "gold",
  },
  {
    id: "verified",
    icon: "🏅",
    title: "Verified Expert",
    desc: "Verified by community moderators",
    tier: "gold",
  },
  {
    id: "master_craft",
    icon: "🧶",
    title: "Master Crafter",
    desc: "Shared 10+ craft technique tutorials",
    tier: "green",
  },
  {
    id: "pillar",
    icon: "💚",
    title: "Community Pillar",
    desc: "100+ members followed you",
    tier: "green",
  },
  {
    id: "author",
    icon: "📚",
    title: "Published Author",
    desc: "Tutorial reached 1,000+ views",
    tier: "silver",
  },
  {
    id: "solver",
    icon: "✅",
    title: "Problem Solver",
    desc: "10 responses marked as resolving",
    tier: "silver",
  },
  {
    id: "streak",
    icon: "🔥",
    title: "7-Day Streak",
    desc: "Posted or responded 7 days running",
    tier: "silver",
  },
  {
    id: "early",
    icon: "🌱",
    title: "Early Adopter",
    desc: "Joined in Craft-SOS's first year",
    tier: "bronze",
  },
];

// ── Helper: validate MongoDB ObjectId ───────────────────
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/* ─────────────────────────────────────────────────────────
   GET /api/crafter/:userId
   Full public profile. Includes:
     - Identity (name, handle, avatar, bio, location, rank)
     - Stats (posts, helped, resolved, points, friends count)
     - Skills + hobbies combined
     - Badges (earned vs locked)
     - Points breakdown
     - Mutual friends (viewer ↔ target overlap)
     - Is viewer already following this person?
     - Is viewer friends with this person? (for message gating)
───────────────────────────────────────────────────────── */
exports.getCrafterProfile = async (req, res) => {
  try {
    const viewerId = req.user.userId;
    const { userId } = req.params;

    if (!isValidId(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }
    if (userId === viewerId) {
      // Redirect hint — frontend should show own profile page instead
      return res.status(400).json({
        success: false,
        message: "Use /api/profile for your own profile",
        ownProfile: true,
      });
    }

    const [target, viewer] = await Promise.all([
      User.findById(userId).select("-password").lean(),
      User.findById(viewerId).select("friends followers friendRequests").lean(),
    ]);

    if (!target || !target.isActive) {
      return res.status(404).json({
        success: false,
        message: "User not found or account inactive",
      });
    }

    // ── Post counts (single aggregation) ─────────────────
    const postStats = await Post.aggregate([
      { $match: { author: new mongoose.Types.ObjectId(userId) } },
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
    const ps = postStats[0] || {
      total: 0,
      resolved: 0,
      tutorials: 0,
      resources: 0,
    };

    // ── Rank label ────────────────────────────────────────
    const p = target.points || 0;
    const rank =
      p >= 2000
        ? "🏆 Mentor"
        : p >= 1500
          ? "🌿 Sage"
          : p >= 800
            ? "⭐ Responder"
            : p >= 300
              ? "🌱 Member"
              : "🌱 New";

    // ── Badges with locked state ──────────────────────────
    const earnedIds = new Set(target.badges || []);
    const badges = ALL_BADGES.map((b) => ({
      ...b,
      locked: !earnedIds.has(b.id),
    }));

    // ── Skills + hobbies merged ──────────────────────────
    const skills = [
      ...(target.skills || []).map((s) => ({ text: s, type: "skill" })),
      ...(target.hobbies || []).map((h) => ({ text: h, type: "hobby" })),
    ];

    // ── Social state (viewer perspective) ────────────────
    const viewerFriends = (viewer?.friends || []).map(String);
    const viewerFriendReqs = (viewer?.friendRequests || []).map(String);
    const targetFriendReqs = (target.friendRequests || []).map(String);

    // friendStatus: none | pending_sent | pending_received | friends
    let friendStatus = "none";
    if (viewerFriends.includes(userId)) friendStatus = "friends";
    else if (targetFriendReqs.includes(viewerId)) friendStatus = "pending_sent";
    else if (viewerFriendReqs.includes(userId))
      friendStatus = "pending_received";

    const isFollowing = friendStatus === "friends"; // backward compat
    const isFriend = friendStatus === "friends";

    // ── Mutual friends ────────────────────────────────────
    const targetFriendIds = new Set((target.friends || []).map(String));
    const mutualIds = viewerFriends
      .filter((id) => targetFriendIds.has(id))
      .slice(0, 8);
    const mutuals = mutualIds.length
      ? await User.find({ _id: { $in: mutualIds } })
          .select("name firstName lastName handle avatar")
          .lean()
      : [];

    // ── Points breakdown ──────────────────────────────────
    const breakdown = [
      {
        label: "Responses given",
        icon: "💬",
        value: target.helpedCount || 0,
        perPt: 10,
      },
      { label: "Tutorials posted", icon: "📚", value: ps.tutorials, perPt: 10 },
      {
        label: "Marked helpful",
        icon: "🌟",
        value: Math.round((target.helpedCount || 0) * 0.4),
        perPt: 5,
      },
      { label: "Resolved issues", icon: "✅", value: ps.resolved, perPt: 15 },
      {
        label: "Bonuses earned",
        icon: "👋",
        value: Math.max(
          0,
          p -
            (target.helpedCount || 0) * 10 -
            ps.tutorials * 10 -
            ps.resolved * 15,
        ),
        perPt: 1,
      },
    ];
    const maxBreakdown = Math.max(
      ...breakdown.map((b) => b.value * b.perPt),
      1,
    );
    const breakdownShaped = breakdown.map((b) => ({
      ...b,
      pts: b.value * b.perPt,
      pct: Math.round(((b.value * b.perPt) / maxBreakdown) * 100),
    }));

    return res.status(200).json({
      success: true,
      profile: {
        // Identity
        id: target._id,
        name:
          target.name ||
          `${target.firstName || ""} ${target.lastName || ""}`.trim() ||
          target.handle ||
          "Crafter",
        firstName: target.firstName || "",
        lastName: target.lastName || "",
        handle: target.handle,
        avatar: target.avatar || "",
        bannerImg: target.bannerImg || "",
        bannerColor: target.bannerColor || "#7a8f52",
        bio: target.bio || "",
        location: target.location || "",
        website: target.website || "",
        memberSince: target.createdAt,
        businessType: target.businessType || "",
        communityRole: target.communityRole || "both",

        // Rank + badges
        rank,
        points: target.points || 0,
        badges,
        skills,

        // Stats
        stats: {
          postCount: ps.total,
          helpedCount: target.helpedCount || 0,
          resolvedCount: ps.resolved,
          friendCount: (target.friends || []).length,
          tutorialCount: ps.tutorials,
          followerCount: (target.followers || []).length,
        },

        // Points breakdown
        breakdown: breakdownShaped,

        // Social state
        isFollowing,
        isFriend,
        friendStatus,

        // Mutual friends
        mutualFriends: {
          count: mutualIds.length,
          list: mutuals.map((m) => ({
            id: m._id,
            name:
              m.name ||
              `${m.firstName || ""} ${m.lastName || ""}`.trim() ||
              m.handle ||
              "Crafter",
            handle: m.handle,
            avatar: m.avatar || "",
          })),
        },
      },
    });
  } catch (err) {
    console.error("[getCrafterProfile]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/crafter/:userId/posts?tab=posts|tutorials|helped
   Returns the target user's posts filtered by tab.
   "helped" tab returns posts where this user posted a reply
   marked as the most helpful (limited implementation).
───────────────────────────────────────────────────────── */
exports.getCrafterPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const tab = req.query.tab || "posts";
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;

    if (!isValidId(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const filter = { author: new mongoose.Types.ObjectId(userId) };

    if (tab === "tutorials") filter.type = "tut";
    else if (tab === "resources") filter.type = "res";
    // "posts" = all, no extra filter

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Post.countDocuments(filter),
    ]);

    const shaped = posts.map((p) => {
      // Severity for SOS posts
      let severity = null;
      if (p.type === "sos") {
        const ageH = (Date.now() - new Date(p.createdAt).getTime()) / 3600000;
        const replies = p.replies?.length || 0;
        severity =
          ageH < 12 && replies < 3
            ? "High"
            : ageH < 48 || replies < 8
              ? "Medium"
              : "Low";
      }

      const typeMap = {
        sos: { icon: "🆘", lbl: "Distress Call" },
        tutorial: { icon: "📚", lbl: "Tutorial" },
        resource: { icon: "🗂️", lbl: "Resource" },
        community: { icon: "💬", lbl: "Community" },
      };
      const t = typeMap[p.type] || { icon: "💬", lbl: "Post" };

      return {
        id: p._id,
        icon: t.icon,
        type: p.type,
        lbl: t.lbl,
        cat: p.category || "",
        title: p.title,
        body: stripHTMLNode(p.body || "").slice(0, 220),
        tags: p.tags || [],
        resolved: p.status === "resolved",
        severity,
        views: p.views || 0,
        replies: (p.replies || []).length,
        saves: (p.saves || []).length,
        time: timeAgo(p.createdAt),
        createdAt: p.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      posts: shaped,
      page,
      hasMore: page * limit < total,
      total,
    });
  } catch (err) {
    console.error("[getCrafterPosts]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/crafter/:userId/friends?page=1
   Public friends list for the target user.
   Also shows which are mutual with the viewer.
───────────────────────────────────────────────────────── */
exports.getCrafterFriends = async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user.userId;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 18;

    if (!isValidId(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const target = await User.findById(userId).select("friends").lean();
    if (!target)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const allFriendIds = target.friends || [];
    const pageIds = allFriendIds.slice((page - 1) * limit, page * limit);

    const viewer = await User.findById(viewerId).select("friends").lean();
    const viewerFriendSet = new Set((viewer?.friends || []).map(String));

    const friends = await User.find({ _id: { $in: pageIds } })
      .select("name firstName lastName handle avatar points badges")
      .lean();

    const p = (pts) =>
      pts >= 2000
        ? "🏆 Mentor"
        : pts >= 1500
          ? "🌿 Sage"
          : pts >= 800
            ? "⭐ Responder"
            : pts >= 300
              ? "🌱 Member"
              : "🌱 New";

    return res.status(200).json({
      success: true,
      friends: friends.map((f) => ({
        id: f._id,
        name:
          f.name ||
          `${f.firstName || ""} ${f.lastName || ""}`.trim() ||
          f.handle ||
          "Crafter",
        handle: f.handle,
        avatar: f.avatar || "",
        rank: p(f.points || 0),
        mutual: viewerFriendSet.has(String(f._id)),
      })),
      page,
      total: allFriendIds.length,
      hasMore: page * limit < allFriendIds.length,
    });
  } catch (err) {
    console.error("[getCrafterFriends]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/crafter/:userId/activity
   Returns 15 most-recent Activity docs for this user.
───────────────────────────────────────────────────────── */
exports.getCrafterActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidId(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const emojiMap = {
      helped: "💬",
      posted: "📝",
      replied: "💬",
      badge_earned: "⭐",
      rank_up: "🏆",
      tutorial: "📚",
      resolved: "✅",
      friend_added: "🤝",
    };

    const activities = await Activity.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    // Fallback: derive from posts if no Activity docs
    if (!activities.length) {
      const posts = await Post.find({ author: userId })
        .sort({ createdAt: -1 })
        .limit(8)
        .select("title type createdAt")
        .lean();

      return res.status(200).json({
        success: true,
        activity: posts.map((p) => ({
          icon: p.type === "tut" ? "📚" : p.type === "sos" ? "🆘" : "💬",
          text: `Posted <strong>"${p.title}"</strong>`,
          time: timeAgo(p.createdAt),
          pts: "+10",
        })),
      });
    }

    return res.status(200).json({
      success: true,
      activity: activities.map((a) => ({
        icon: emojiMap[a.type] || "📌",
        text: a.text,
        time: timeAgo(a.createdAt),
        pts: "+10",
      })),
    });
  } catch (err) {
    console.error("[getCrafterActivity]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/crafter/:userId/follow
   Toggle follow state. Adds/removes viewerId from
   target.followers[]. Returns new isFollowing state.
───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────
   POST /api/crafter/:userId/follow
   Friend-request state machine (replaces simple follow toggle).

   State transitions:
     none             → pending_sent   (add viewerId → target.friendRequests, notify target)
     pending_sent     → none           (cancel: remove viewerId from target.friendRequests)
     pending_received → 400            (use accept/decline instead)
     friends          → none           (unfriend: remove from both friends[])
───────────────────────────────────────────────────────── */
exports.toggleFollow = async (req, res) => {
  try {
    const viewerId = req.user.userId;
    const { userId } = req.params;

    if (userId === viewerId) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot add yourself" });
    }
    if (!isValidId(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    // Load both users in parallel — we need viewer's friendRequests to detect incoming
    const [target, viewer] = await Promise.all([
      User.findById(userId)
        .select("friendRequests friends name firstName lastName handle")
        .lean(),
      User.findById(viewerId)
        .select("friendRequests friends name firstName lastName handle")
        .lean(),
    ]);
    if (!target)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const targetFriendReqs = (target.friendRequests || []).map(String);
    const viewerFriendReqs = (viewer?.friendRequests || []).map(String);
    const viewerFriends = (viewer?.friends || []).map(String);

    // Determine current state
    let currentStatus = "none";
    if (viewerFriends.includes(userId)) currentStatus = "friends";
    else if (targetFriendReqs.includes(viewerId))
      currentStatus = "pending_sent";
    else if (viewerFriendReqs.includes(userId))
      currentStatus = "pending_received";

    const io = req.app.get("io");
    const targetName =
      target.name ||
      `${target.firstName || ""} ${target.lastName || ""}`.trim() ||
      target.handle ||
      "Crafter";
    const viewerName =
      viewer?.name ||
      `${viewer?.firstName || ""} ${viewer?.lastName || ""}`.trim() ||
      viewer?.handle ||
      "Someone";

    if (currentStatus === "friends") {
      // Unfriend — remove from both sides
      await Promise.all([
        User.findByIdAndUpdate(userId, { $pull: { friends: viewerId } }),
        User.findByIdAndUpdate(viewerId, { $pull: { friends: userId } }),
      ]);
      return res.status(200).json({
        success: true,
        friendStatus: "none",
        message: `Unfriended ${targetName}`,
      });
    }

    if (currentStatus === "pending_sent") {
      // Cancel sent request
      await User.findByIdAndUpdate(userId, {
        $pull: { friendRequests: viewerId },
      });
      return res.status(200).json({
        success: true,
        friendStatus: "none",
        message: "Friend request cancelled",
      });
    }

    if (currentStatus === "pending_received") {
      return res.status(400).json({
        success: false,
        friendStatus: "pending_received",
        message: "Use accept or decline to respond to this request",
      });
    }

    // none → send request
    await User.findByIdAndUpdate(userId, {
      $addToSet: { friendRequests: viewerId },
    });

    // Notify target
    if (io) {
      try {
        const { emitNotification } = require("../socket/notifyHelper");
        await emitNotification(io, {
          recipient: userId,
          actor: viewerId,
          type: "friend_request",
          message: `${viewerName} sent you a friend request`,
        });
      } catch (_) {
        /* non-fatal */
      }
    }

    return res.status(200).json({
      success: true,
      friendStatus: "pending_sent",
      message: `Friend request sent to ${targetName}`,
    });
  } catch (err) {
    console.error("[toggleFollow]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/crafter/:userId/accept
   Accept an incoming friend request from :userId.
   Moves both parties to friends[], clears the request.
───────────────────────────────────────────────────────── */
exports.acceptFriendRequest = async (req, res) => {
  try {
    const viewerId = req.user.userId; // the one accepting
    const { userId: requesterId } = req.params; // the one who sent it

    if (!isValidId(requesterId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const me = await User.findById(viewerId)
      .select("friendRequests name firstName lastName")
      .lean();
    if (!me)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const hasPending = (me.friendRequests || [])
      .map(String)
      .includes(requesterId);
    if (!hasPending) {
      return res
        .status(404)
        .json({ success: false, message: "No pending request from this user" });
    }

    await Promise.all([
      User.findByIdAndUpdate(viewerId, {
        $pull: { friendRequests: requesterId },
        $addToSet: { friends: requesterId },
      }),
      User.findByIdAndUpdate(requesterId, {
        $addToSet: { friends: viewerId },
      }),
    ]);

    // Notify requester
    const io = req.app.get("io");
    if (io) {
      try {
        const { emitNotification } = require("../socket/notifyHelper");
        const myName =
          me.name ||
          `${me.firstName || ""} ${me.lastName || ""}`.trim() ||
          "Someone";
        await emitNotification(io, {
          recipient: requesterId,
          actor: viewerId,
          type: "friend_accepted",
          message: `${myName} accepted your friend request`,
        });
      } catch (_) {
        /* non-fatal */
      }
    }

    return res.status(200).json({
      success: true,
      friendStatus: "friends",
      message: "Friend request accepted",
    });
  } catch (err) {
    console.error("[acceptFriendRequest]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/crafter/:userId/decline
   Decline an incoming friend request — just removes it.
───────────────────────────────────────────────────────── */
exports.declineFriendRequest = async (req, res) => {
  try {
    const viewerId = req.user.userId;
    const { userId: requesterId } = req.params;

    if (!isValidId(requesterId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    await User.findByIdAndUpdate(viewerId, {
      $pull: { friendRequests: requesterId },
    });

    return res.status(200).json({
      success: true,
      friendStatus: "none",
      message: "Friend request declined",
    });
  } catch (err) {
    console.error("[declineFriendRequest]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/crafter/:userId/friend-status
   Quick status check — used by chat page not-friends card.
───────────────────────────────────────────────────────── */
exports.getFriendStatus = async (req, res) => {
  try {
    const viewerId = req.user.userId;
    const { userId } = req.params;

    if (!isValidId(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }
    if (userId === viewerId) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot check own status" });
    }

    const [target, viewer] = await Promise.all([
      User.findById(userId)
        .select("name firstName lastName handle avatar friendRequests isActive")
        .lean(),
      User.findById(viewerId).select("friends friendRequests").lean(),
    ]);

    if (!target || !target.isActive) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const viewerFriends = (viewer?.friends || []).map(String);
    const viewerFriendReqs = (viewer?.friendRequests || []).map(String);
    const targetFriendReqs = (target.friendRequests || []).map(String);

    let friendStatus = "none";
    if (viewerFriends.includes(userId)) friendStatus = "friends";
    else if (targetFriendReqs.includes(viewerId)) friendStatus = "pending_sent";
    else if (viewerFriendReqs.includes(userId))
      friendStatus = "pending_received";

    return res.status(200).json({
      success: true,
      friendStatus,
      user: {
        id: target._id,
        name:
          target.name ||
          `${target.firstName || ""} ${target.lastName || ""}`.trim() ||
          target.handle ||
          "Crafter",
        handle: target.handle || "",
        avatar: target.avatar || "",
      },
    });
  } catch (err) {
    console.error("[getFriendStatus]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Utility ───────────────────────────────────────────────
/** Strip HTML tags from a string (Node-safe — no DOM available server-side) */
function stripHTMLNode(html = "") {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function timeAgo(iso) {
  if (!iso) return "";
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  const wk = Math.floor(days / 7);
  if (wk < 5) return `${wk}w ago`;
  const mo = Math.floor(days / 30);
  if (mo < 12) return `${mo} month${mo > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
  });
}
