// Backend/controllers/indexController.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Powers every data section on the main index (home) page.
//   All endpoints are JWT-protected. Designed for a single-page
//   layout that loads multiple sections independently so each
//   panel can render as soon as its own data arrives.
//
//   Routes (all under /api/index):
//     GET  /welcome              → personalised welcome banner + quick stats
//     GET  /feed                 → SOS / community feed with filter + pagination
//     GET  /needs-help           → posts with 0 replies matched to viewer's craft
//     GET  /activity             → recent community-wide activity feed
//     GET  /top-helpers          → top-helpers leaderboard (current week)
//     GET  /suggestions          → crafters to follow (not yet friends/followers)
//     GET  /friend-requests      → viewer's incoming pending friend requests
//     POST /friend-requests/:userId         → send a friend request
//     PATCH /friend-requests/:userId/accept → accept an incoming request
//     PATCH /friend-requests/:userId/decline→ decline / remove a request
//
//   Reuses existing endpoints (no duplication):
//     PATCH /api/posts/:id/save         → toggleSave in postController
//     PATCH /api/dashboard/follow/:id   → toggleFollow in dashboardController
//     POST  /api/posts/:id/replies      → addReply in postController
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");

// ── Shared helpers ────────────────────────────────────────
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function _timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

// Derives severity label from post age + reply count
function _severity(post) {
  const hoursOld = (Date.now() - new Date(post.createdAt).getTime()) / 3600000;
  if (hoursOld < 6 && post.replyCount === 0) return "High";
  if (hoursOld < 24 && post.replyCount < 3) return "Medium";
  return "Low";
}

// Map post type to emoji icon
const TYPE_ICON = { sos: "🆘", tut: "📚", com: "💬", res: "📦" };

/* ─────────────────────────────────────────────────────────
   GET /api/index/welcome
   Personalised welcome banner: user name, stats, unread counts.
   Single round-trip for all top-of-page data.
───────────────────────────────────────────────────────── */
exports.getWelcome = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [user, unreadNotifs, myActivePosts, myRepliedPosts] =
      await Promise.all([
        User.findById(userId)
          .select(
            "name handle avatar points helpedCount resolvedCount streakDays badges friends friendRequests",
          )
          .lean(),
        Notification.countDocuments({ recipient: userId, isRead: false }),
        Post.countDocuments({ author: userId, status: "active" }),
        // Posts where viewer left a reply — count replies on others' posts
        Post.countDocuments({
          author: { $ne: userId },
          "replies.author": userId,
          status: "active",
        }),
      ]);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Derive rank from points
    const pts = user.points || 0;
    let rank = "🌱 New Member";
    if (pts >= 2000) rank = "🏆 Master Crafter";
    else if (pts >= 1500) rank = "🌿 Sage";
    else if (pts >= 800) rank = "⭐ Responder";
    else if (pts >= 300) rank = "🌱 Member";

    // Unread direct messages (count Message docs unread by viewer)
    // — we use Notification with type "reply" as proxy if no Message model imported
    const pendingFriendRequests = (user.friendRequests || []).length;

    return res.status(200).json({
      success: true,
      welcome: {
        name: user.name,
        handle: user.handle,
        avatar: user.avatar || "",
        points: pts,
        helpedCount: user.helpedCount || 0,
        resolvedCount: user.resolvedCount || 0,
        streakDays: user.streakDays || 0,
        friendCount: (user.friends || []).length,
        rank,
        badges: user.badges || [],
        // Notification counts for the quick-stat pills in the banner
        unreadNotifs,
        activePostCount: myActivePosts,
        repliedPostCount: myRepliedPosts,
        pendingFriendRequests,
      },
    });
  } catch (err) {
    console.error("[getWelcome]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/index/feed
   Main SOS/community feed with filter and pagination.
   Query: type (sos|tut|com|res|all), severity (High|Medium|Low),
          tag, page, limit
───────────────────────────────────────────────────────── */
exports.getFeed = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      type = "all",
      severity, // derived client-side filter
      tag,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { status: "active" };
    if (type && type !== "all") filter.type = type;
    if (tag) filter.tags = { $regex: new RegExp(tag, "i") };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(30, parseInt(limit, 10)));

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate("author", "name handle avatar points badges location")
        .lean(),
      Post.countDocuments(filter),
    ]);

    const shaped = posts
      .map((p) => {
        const sev = _severity(p);
        // If severity filter is active, skip mismatches
        if (severity && sev !== severity) return null;

        const authorName = p.author?.name || "Unknown";
        const authorInitials = authorName
          .replace("@", "")
          .slice(0, 2)
          .toUpperCase();

        return {
          id: p._id,
          type: p.type,
          icon: TYPE_ICON[p.type] ?? "📄",
          title: p.title,
          body: (p.body || "").slice(0, 260),
          tags: p.tags || [],
          severity: sev,
          replyCount: p.replyCount || 0,
          views: p.views || 0,
          saveCount: (p.saves || []).length,
          isSaved: (p.saves || []).some(
            (s) => s?.toString() === userId.toString(),
          ),
          status: p.status,
          createdAt: p.createdAt,
          timeAgo: _timeAgo(p.createdAt),
          author: {
            id: p.author?._id,
            name: authorName,
            initials: authorInitials,
            handle: p.author?.handle || "",
            avatar: p.author?.avatar || "",
            points: p.author?.points || 0,
            badges: p.author?.badges || [],
            location: p.author?.location || "",
          },
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      posts: shaped,
      total,
      page: pageNum,
      hasMore: pageNum * limitNum < total,
    });
  } catch (err) {
    console.error("[getFeed]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/index/needs-help
   Posts with 0 replies — matched to viewer's skills/location.
   Falls back to global 0-reply SOS posts if no match found.
───────────────────────────────────────────────────────── */
exports.getNeedsHelp = async (req, res) => {
  try {
    const userId = req.user.userId;

    const viewer = await User.findById(userId)
      .select("skills hobbies location")
      .lean();

    // Build a craft-match filter from viewer's skills
    const craftTerms = [...(viewer?.skills || []), ...(viewer?.hobbies || [])];
    const tagFilter = craftTerms.length
      ? {
          $or: craftTerms.map((t) => ({
            tags: { $regex: new RegExp(t, "i") },
          })),
        }
      : {};

    const baseFilter = {
      type: "sos",
      status: "active",
      replyCount: 0,
      author: { $ne: userId },
    };

    let posts = await Post.find({ ...baseFilter, ...tagFilter })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("author", "name handle avatar location")
      .lean();

    // Fallback: any 0-reply SOS
    if (!posts.length) {
      posts = await Post.find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("author", "name handle avatar location")
        .lean();
    }

    const shaped = posts.map((p) => ({
      id: p._id,
      title: p.title,
      tags: p.tags || [],
      timeAgo: _timeAgo(p.createdAt),
      author: {
        id: p.author?._id,
        name: p.author?.name || "Unknown",
        initials: (p.author?.name || "??").slice(0, 2).toUpperCase(),
        avatar: p.author?.avatar || "",
        location: p.author?.location || "",
      },
    }));

    return res.status(200).json({ success: true, posts: shaped });
  } catch (err) {
    console.error("[getNeedsHelp]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/index/activity
   Community-wide recent activity: new tutorials, resolved SOS,
   new resources, badge events. Returns 8 most recent items.
───────────────────────────────────────────────────────── */
exports.getActivity = async (req, res) => {
  try {
    // Derive from recent posts (tutorials resolved, resources posted)
    const recentPosts = await Post.find({
      status: { $in: ["active", "resolved"] },
    })
      .sort({ updatedAt: -1 })
      .limit(12)
      .populate("author", "name handle avatar")
      .lean();

    const items = recentPosts.slice(0, 8).map((p) => {
      const isResolved = p.status === "resolved";
      const isTutorial = p.type === "tut";
      const isResource = p.type === "res";

      let icon,
        title,
        sub,
        tags = [];

      if (isResolved) {
        icon = "✅";
        title = `SOS Solved: ${p.title}`;
        sub = `${p.author?.name || "Someone"} got help · ${_timeAgo(p.updatedAt)}`;
        tags = [
          { label: "🎉 Resolved", cls: "resolved" },
          { label: "Read solution", cls: "" },
        ];
      } else if (isTutorial) {
        icon = "📹";
        title = `New Tutorial: ${p.title}`;
        sub = `by ${p.author?.name || "Unknown"} · ${_timeAgo(p.createdAt)} · ${p.views || 0} views`;
        tags = [
          { label: "✔ Helpful", cls: "" },
          { label: "💾 Save", cls: "" },
          { label: "💬 Comment", cls: "" },
        ];
      } else if (isResource) {
        icon = "📄";
        title = `Resource: ${p.title}`;
        sub = `Shared by ${p.author?.name || "Unknown"} · ${_timeAgo(p.createdAt)}`;
        tags = [
          { label: "✔ Helpful", cls: "" },
          { label: "💾 Save", cls: "" },
        ];
      } else {
        icon = "💬";
        title = `Discussion: ${p.title}`;
        sub = `by ${p.author?.name || "Unknown"} · ${_timeAgo(p.createdAt)} · ${p.replyCount || 0} replies`;
        tags = [
          { label: "💬 Reply", cls: "" },
          { label: "💾 Save", cls: "" },
        ];
      }

      return {
        id: p._id,
        type: p.type,
        status: p.status,
        icon,
        title,
        sub,
        tags,
        author: {
          id: p.author?._id,
          name: p.author?.name || "Unknown",
          avatar: p.author?.avatar || "",
        },
      };
    });

    // Supplement with actual Activity docs if they exist
    const activityDocs = await Activity.find({})
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("user", "name handle avatar")
      .lean();

    const ACTIVITY_ICON = {
      helped: "💚",
      posted: "📝",
      replied: "💬",
      badge_earned: "⭐",
      rank_up: "🏆",
      tutorial: "📚",
      resolved: "✅",
      friend_added: "🤝",
    };

    const docItems = activityDocs.map((a) => ({
      id: a._id,
      icon: ACTIVITY_ICON[a.type] ?? "💬",
      title: a.text,
      sub: `${a.user?.name || "Community"} · ${_timeAgo(a.createdAt)}`,
      tags: [],
      type: a.type,
    }));

    // Merge and deduplicate by id string
    const seen = new Set();
    const merged = [...docItems, ...items]
      .filter((item) => {
        const k = String(item.id);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 8);

    return res.status(200).json({ success: true, activity: merged });
  } catch (err) {
    console.error("[getActivity]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/index/top-helpers
   Users sorted by helpedCount descending (top 5).
   Includes a "this week" approximation via recent activity.
───────────────────────────────────────────────────────── */
exports.getTopHelpers = async (req, res) => {
  try {
    const userId = req.user.userId;

    const helpers = await User.find({ _id: { $ne: userId }, isActive: true })
      .sort({ helpedCount: -1 })
      .limit(5)
      .select("name handle avatar points helpedCount badges")
      .lean();

    const MEDALS = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    const shaped = helpers.map((u, i) => ({
      id: u._id,
      name: u.name,
      handle: u.handle,
      avatar: u.avatar || "",
      initials: (u.name || "??").slice(0, 2).toUpperCase(),
      helpedCount: u.helpedCount || 0,
      points: u.points || 0,
      medal: MEDALS[i] ?? `${i + 1}`,
      badge: u.badges?.[0] || "",
    }));

    return res.status(200).json({ success: true, helpers: shaped });
  } catch (err) {
    console.error("[getTopHelpers]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/index/suggestions
   Crafters the viewer does not yet follow or friend.
   Ranked by shared craft tags → helpedCount → newest.
───────────────────────────────────────────────────────── */
exports.getSuggestions = async (req, res) => {
  try {
    const userId = req.user.userId;

    const viewer = await User.findById(userId)
      .select("friends followers skills hobbies")
      .lean();

    const excluded = new Set([
      userId.toString(),
      ...(viewer?.friends || []).map(String),
      ...(viewer?.followers || []).map(String),
    ]);

    const candidates = await User.find({
      _id: { $nin: [...excluded].map((id) => new mongoose.Types.ObjectId(id)) },
      isActive: true,
    })
      .sort({ helpedCount: -1, createdAt: -1 })
      .limit(8)
      .select(
        "name handle avatar points helpedCount skills hobbies location badges",
      )
      .lean();

    // Score by shared skills/hobbies
    const viewerCrafts = new Set(
      [...(viewer?.skills || []), ...(viewer?.hobbies || [])].map((s) =>
        s.toLowerCase(),
      ),
    );

    const scored = candidates
      .map((u) => {
        const userCrafts = [...(u.skills || []), ...(u.hobbies || [])].map(
          (s) => s.toLowerCase(),
        );
        const overlap = userCrafts.filter((c) => viewerCrafts.has(c)).length;
        return { ...u, _score: overlap * 10 + (u.helpedCount || 0) };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, 6);

    const shaped = scored.map((u) => ({
      id: u._id,
      name: u.name,
      handle: u.handle,
      avatar: u.avatar || "",
      initials: (u.name || "??").slice(0, 2).toUpperCase(),
      niche:
        [...(u.skills || []), ...(u.hobbies || [])].slice(0, 2).join(" · ") ||
        "Crafter",
      location: u.location || "",
      points: u.points || 0,
      badge: u.badges?.[0] || "",
    }));

    return res.status(200).json({ success: true, suggestions: shaped });
  } catch (err) {
    console.error("[getSuggestions]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/index/friend-requests
   Viewer's incoming pending friend requests (full user details).
───────────────────────────────────────────────────────── */
exports.getFriendRequests = async (req, res) => {
  try {
    const userId = req.user.userId;

    const viewer = await User.findById(userId)
      .select("friendRequests")
      .populate(
        "friendRequests",
        "name handle avatar location skills hobbies points badges",
      )
      .lean();

    if (!viewer) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const shaped = (viewer.friendRequests || []).map((u) => ({
      id: u._id,
      name: u.name,
      handle: u.handle,
      avatar: u.avatar || "",
      initials: (u.name || "??").slice(0, 2).toUpperCase(),
      niche:
        [...(u.skills || []), ...(u.hobbies || [])].slice(0, 1).join("") ||
        "Crafter",
      location: u.location || "",
    }));

    return res.status(200).json({ success: true, requests: shaped });
  } catch (err) {
    console.error("[getFriendRequests]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/index/friend-requests/:userId
   Send a friend request from viewer to target.
   Adds viewer's ID to target.friendRequests[] and emits socket notif.
───────────────────────────────────────────────────────── */
exports.sendFriendRequest = async (req, res) => {
  try {
    const senderId = req.user.userId;
    const targetId = req.params.userId;

    if (!isValidId(targetId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }
    if (senderId.toString() === targetId) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot send request to yourself" });
    }

    const [sender, target] = await Promise.all([
      User.findById(senderId).select(
        "name handle avatar friends friendRequests",
      ),
      User.findById(targetId).select("name friends friendRequests"),
    ]);

    if (!target) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Already friends?
    if ((sender.friends || []).some((id) => id.toString() === targetId)) {
      return res
        .status(400)
        .json({ success: false, message: "Already friends" });
    }
    // Already sent?
    if (
      (target.friendRequests || []).some(
        (id) => id.toString() === senderId.toString(),
      )
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Request already sent" });
    }

    await User.findByIdAndUpdate(targetId, {
      $addToSet: { friendRequests: senderId },
    });

    // Socket notification to target
    const io = req.app.get("io");
    if (io) {
      // io.to(`user:${targetId}`).emit("notification:new", {
      io.to(`user:${targetId}`).emit("notif:new", {
        type: "friend_request",
        message: `${sender.name} sent you a friend request`,
        actorId: senderId,
      });
    }

    return res
      .status(200)
      .json({ success: true, message: "Friend request sent" });
  } catch (err) {
    console.error("[sendFriendRequest]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/index/friend-requests/:userId/accept
   Accept an incoming friend request.
   Adds each user to the other's friends[], removes the request.
───────────────────────────────────────────────────────── */
exports.acceptFriendRequest = async (req, res) => {
  try {
    const viewerId = req.user.userId;
    const senderId = req.params.userId;

    if (!isValidId(senderId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const viewer = await User.findById(viewerId).select("friendRequests");
    if (!viewer) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const hasPending = (viewer.friendRequests || []).some(
      (id) => id.toString() === senderId,
    );
    if (!hasPending) {
      return res
        .status(400)
        .json({ success: false, message: "No pending request from this user" });
    }

    // Mutual add + remove request — atomic via $pull / $addToSet
    await Promise.all([
      User.findByIdAndUpdate(viewerId, {
        $pull: { friendRequests: senderId },
        $addToSet: { friends: senderId },
      }),
      User.findByIdAndUpdate(senderId, {
        $addToSet: { friends: viewerId },
      }),
    ]);

    // Log activity + notify
    const io = req.app.get("io");
    if (io) {
      // io.to(`user:${senderId}`).emit("notification:new", {
      io.to(`user:${senderId}`).emit("notif:new", {
        type: "friend_accepted",
        message: "Your friend request was accepted! 🎉",
        actorId: viewerId,
      });
    }

    const newFriend = await User.findById(senderId)
      .select("name handle avatar location skills hobbies")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Friend request accepted",
      newFriend: {
        id: newFriend?._id,
        name: newFriend?.name,
        handle: newFriend?.handle,
        avatar: newFriend?.avatar || "",
        initials: (newFriend?.name || "??").slice(0, 2).toUpperCase(),
        niche:
          [...(newFriend?.skills || []), ...(newFriend?.hobbies || [])]
            .slice(0, 1)
            .join("") || "Crafter",
        location: newFriend?.location || "",
      },
    });
  } catch (err) {
    console.error("[acceptFriendRequest]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/index/friend-requests/:userId/decline
   Decline / dismiss a pending request — just removes it.
───────────────────────────────────────────────────────── */
exports.declineFriendRequest = async (req, res) => {
  try {
    const viewerId = req.user.userId;
    const senderId = req.params.userId;

    if (!isValidId(senderId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    await User.findByIdAndUpdate(viewerId, {
      $pull: { friendRequests: senderId },
    });

    return res.status(200).json({ success: true, message: "Request declined" });
  } catch (err) {
    console.error("[declineFriendRequest]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
