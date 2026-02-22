// Backend/controllers/dashboardController.js
const Post = require("../models/Post");
const User = require("../models/User");
const Notification = require("../models/Notification");
const Challenge = require("../models/Challenge");

/* ─────────────────────────────────────────────────────────
   GET /api/dashboard
   Returns everything the dashboard home section needs in
   a single round-trip: user stats, feed preview, SOS pulse,
   open posts widget, streak, suggested friends, challenges.
───────────────────────────────────────────────────────── */
const getDashboard = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Run all queries in parallel for speed
    const [
      user,
      feedPosts,
      sosPosts,
      myOpenPosts,
      unreadCount,
      challenges,
      suggestedUsers,
    ] = await Promise.all([
      // Current user (stats + points)
      User.findById(userId).select(
        "name handle avatar points helpedCount friendCount",
      ),

      // Community feed (newest 4, any type)
      Post.find({ status: "active" })
        .sort({ createdAt: -1 })
        .limit(4)
        .populate("author", "name handle avatar"),

      // Live SOS pulse (newest 2 open distress calls)
      Post.find({ type: "sos", status: "active" })
        .sort({ createdAt: -1 })
        .limit(2)
        .populate("author", "name handle avatar"),

      // My open posts (newest 3)
      Post.find({ author: userId, status: { $in: ["active", "resolved"] } })
        .sort({ createdAt: -1 })
        .limit(3),

      // Unread notification count
      Notification.countDocuments({ recipient: userId, isRead: false }),

      // Active challenges
      Challenge.find({ isActive: true }).sort({ createdAt: -1 }).limit(5),

      // Suggested friends — users who are NOT the current user, sample 3
      User.find({ _id: { $ne: userId } })
        .select("name handle avatar")
        .limit(3),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        user: user
          ? {
              id: user._id,
              name: user.name,
              handle: user.handle,
              avatar: user.avatar,
              points: user.points || 0,
              helpedCount: user.helpedCount || 0,
              friendCount: user.friendCount || 0,
              postCount: myOpenPosts.length,
            }
          : null,

        feedPosts: feedPosts.map((p) => p.toPublic(userId)),
        sosPosts: sosPosts.map((p) => p.toPublic(userId)),
        myOpenPosts: myOpenPosts.map((p) => p.toPublic(userId)),
        unreadNotifications: unreadCount,

        challenges: challenges.map((c) => ({
          id: c._id,
          title: c.title,
          description: c.description,
          icon: c.icon,
          iconBg: c.iconBg,
          participantCount: c.participants.length,
          endsAt: c.endsAt,
          isJoined: c.participants.some(
            (id) => id.toString() === userId.toString(),
          ),
        })),

        suggestedFriends: suggestedUsers.map((u) => ({
          id: u._id,
          name: u.name,
          handle: u.handle,
          avatar: u.avatar,
        })),
      },
    });
  } catch (err) {
    console.error("[getDashboard]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/dashboard/notifications
   Paginated full notification list for the Notifications tab
───────────────────────────────────────────────────────── */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [notifications, total] = await Promise.all([
      Notification.find({ recipient: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("actor", "name handle avatar"),
      Notification.countDocuments({ recipient: userId }),
    ]);

    return res.status(200).json({
      success: true,
      total,
      unread: await Notification.countDocuments({
        recipient: userId,
        isRead: false,
      }),
      data: notifications,
    });
  } catch (err) {
    console.error("[getNotifications]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/dashboard/notifications/read-all
   Mark all notifications as read
───────────────────────────────────────────────────────── */
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.userId, isRead: false },
      { isRead: true },
    );
    return res
      .status(200)
      .json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    console.error("[markAllRead]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/dashboard/saved
   Posts the current user has bookmarked
───────────────────────────────────────────────────────── */
const getSavedPosts = async (req, res) => {
  try {
    const userId = req.user.userId;

    const saved = await Post.find({ saves: userId })
      .sort({ updatedAt: -1 })
      .populate("author", "name handle avatar");

    return res.status(200).json({
      success: true,
      data: saved.map((p) => p.toPublic(userId)),
    });
  } catch (err) {
    console.error("[getSavedPosts]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/dashboard/progress
   Full progress data for the Progress tab
───────────────────────────────────────────────────────── */
const getProgress = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [user, totalPosts, helpedPosts] = await Promise.all([
      User.findById(userId).select("name points helpedCount badges streakDays"),
      Post.countDocuments({ author: userId }),
      Post.countDocuments({ author: userId, status: "resolved" }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        points: user?.points || 0,
        helpedCount: user?.helpedCount || 0,
        totalPosts,
        resolvedPosts: helpedPosts,
        streakDays: user?.streakDays || 0,
        badges: user?.badges || [],
      },
    });
  } catch (err) {
    console.error("[getProgress]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/dashboard/challenges/:id/join
   Toggle join/leave a challenge
───────────────────────────────────────────────────────── */
const toggleChallenge = async (req, res) => {
  try {
    const userId = req.user.userId;
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) {
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found" });
    }

    const alreadyJoined = challenge.participants.some(
      (id) => id.toString() === userId.toString(),
    );

    if (alreadyJoined) {
      challenge.participants = challenge.participants.filter(
        (id) => id.toString() !== userId.toString(),
      );
    } else {
      challenge.participants.push(userId);
    }

    await challenge.save();

    return res.status(200).json({
      success: true,
      joined: !alreadyJoined,
      count: challenge.participants.length,
    });
  } catch (err) {
    console.error("[toggleChallenge]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/dashboard/follow/:userId
   Toggle follow/unfollow a user
   (Simple implementation — extend with a Friendship model later)
───────────────────────────────────────────────────────── */
const toggleFollow = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const targetId = req.params.userId;

    if (currentUserId.toString() === targetId) {
      return res
        .status(400)
        .json({ success: false, message: "Cannot follow yourself" });
    }

    const target = await User.findById(targetId);
    if (!target) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // We store followers on the User model — add the field if not present
    const isFollowing = (target.followers || []).some(
      (id) => id.toString() === currentUserId.toString(),
    );

    await User.findByIdAndUpdate(
      targetId,
      isFollowing
        ? { $pull: { followers: currentUserId } }
        : { $addToSet: { followers: currentUserId } },
    );

    return res.status(200).json({
      success: true,
      following: !isFollowing,
      targetName: target.name,
    });
  } catch (err) {
    console.error("[toggleFollow]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getDashboard,
  getNotifications,
  markAllRead,
  getSavedPosts,
  getProgress,
  toggleChallenge,
  toggleFollow,
};
