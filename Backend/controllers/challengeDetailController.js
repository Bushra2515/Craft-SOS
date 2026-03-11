// Backend/controllers/challengeDetailController.js
// Handles every API call made by the challenge-detail page:
//
//   GET    /api/challenges/:id/detail          → full challenge data + user state
//   GET    /api/challenges/:id/feed            → paginated community feed
//   GET    /api/challenges/:id/board           → challenge-internal leaderboard
//   POST   /api/challenges/:id/feed            → post a community update
//   PATCH  /api/challenges/:id/feed/:postId/react → toggle emoji reaction
//   DELETE /api/challenges/:id/feed/:postId    → soft-delete own post
//   PATCH  /api/challenges/:id/tasks/:taskId   → mark a task complete
//   PATCH  /api/challenges/:id/bookmark        → toggle bookmark
//   PATCH  /api/challenges/:id/leave           → leave challenge (clear progress)

const mongoose = require("mongoose");
const Challenge = require("../models/Challenge");
const ChallengePost = require("../models/ChallengePost");
const User = require("../models/User");

/* ── Helpers ─────────────────────────────────────────────── */
const toId = (v) => new mongoose.Types.ObjectId(v);
const sameId = (a, b) => a?.toString() === b?.toString();

function daysLeft(endsAt) {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((new Date(endsAt) - Date.now()) / 86400000));
}

function timeLabel(c) {
  if (c.status === "completed") {
    return c.endsAt
      ? "Ended " +
          new Date(c.endsAt).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
          })
      : "Ended";
  }
  if (c.status === "upcoming" && c.startsAt) {
    const d = Math.ceil((c.startsAt - Date.now()) / 86400000);
    return d <= 0 ? "Starting soon" : `Starts in ${d} day${d !== 1 ? "s" : ""}`;
  }
  if (c.status === "active" && c.endsAt) {
    const d = daysLeft(c.endsAt);
    return d === 0 ? "Ends today" : `${d} day${d !== 1 ? "s" : ""} left`;
  }
  return "";
}

// Shape a task with the user's done state injected
function shapeTask(task, completedTaskIds = []) {
  return {
    id: task._id,
    order: task.order,
    title: task.title,
    description: task.description,
    dueLabel: task.dueLabel,
    tagCls: task.tagCls,
    tagText: task.tagText,
    done: completedTaskIds.some((tid) => sameId(tid, task._id)),
  };
}

/* ════════════════════════════════════════════════════════════
   GET /api/challenges/:id/detail
   Full challenge payload for the detail page.
════════════════════════════════════════════════════════════ */
exports.getDetail = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const c = await Challenge.findOne({ _id: req.params.id, isActive: true });
    if (!c)
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found" });

    const joined = userId
      ? c.participants.some((p) => sameId(p, userId))
      : false;
    const myProg = userId
      ? c.userProgress.find((p) => sameId(p.userId, userId))
      : null;

    // Sorted tasks with user done-state
    const sortedTasks = [...c.tasks]
      .sort((a, b) => a.order - b.order)
      .map((t) => shapeTask(t, myProg?.completedTasks || []));

    // Mark active task = first incomplete
    const firstIncomplete = sortedTasks.find((t) => !t.done);
    if (firstIncomplete) firstIncomplete.active = true;

    // Deadline ring: pct elapsed
    let deadlineElapsed = 0;
    if (c.startsAt && c.endsAt) {
      const total = c.endsAt - c.startsAt;
      const passed = Date.now() - c.startsAt;
      deadlineElapsed = Math.min(1, Math.max(0, passed / total));
    }

    // Participant avatar list (first 9)
    await c.populate({
      path: "participants",
      select: "handle niche",
      options: { limit: 9 },
    });

    return res.json({
      success: true,
      challenge: {
        id: c._id,
        emoji: c.emoji,
        coverBg: c.coverBg,
        niche: c.niche,
        title: c.title,
        description: c.description,
        difficulty: c.difficulty,
        status: c.status,
        rewards: c.rewards,
        tasks: sortedTasks,
        rules: [...c.rules].sort((a, b) => a.order - b.order),
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        timeLabel: timeLabel(c),
        daysLeft: daysLeft(c.endsAt),
        deadlineElapsed,
        urgent:
          c.endsAt && c.status === "active" ? daysLeft(c.endsAt) <= 3 : false,
        totalP: c.participants.length,
        participants: c.participants.slice(0, 9).map((u) => ({
          id: u._id,
          handle: u.handle,
          niche: u.niche || "",
        })),
      },
      // current-user state
      myState: {
        joined,
        bookmarked: myProg?.bookmarked ?? false,
        progress: myProg?.progress ?? 0,
        progressLabel: myProg?.progressLabel ?? "",
        completedTasks: (myProg?.completedTasks || []).map(String),
        rank: myProg?.rank ?? null,
        ptsEarned: myProg?.ptsEarned ?? 0,
        completedAt: myProg?.completedAt ?? null,
      },
    });
  } catch (err) {
    console.error("[getDetail]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   GET /api/challenges/:id/board
   Top participants ranked by completedTasks count within this challenge.
════════════════════════════════════════════════════════════ */
exports.getBoard = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const c = await Challenge.findOne({
      _id: req.params.id,
      isActive: true,
    }).select("userProgress participants title");
    if (!c)
      return res.status(404).json({ success: false, message: "Not found" });

    // Sort by tasks completed desc
    const sorted = [...c.userProgress]
      .sort((a, b) => b.completedTasks.length - a.completedTasks.length)
      .slice(0, 10);

    const uIds = sorted.map((p) => p.userId);
    const users = await User.find({ _id: { $in: uIds } }).select(
      "handle niche",
    );
    const uMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const board = sorted.map((p, i) => {
      const u = uMap[p.userId.toString()] || {};
      return {
        rank: i + 1,
        userId: p.userId,
        handle: u.handle || "—",
        niche: u.niche || "",
        tasksCompleted: p.completedTasks.length,
        progress: p.progress,
        isMe: userId ? sameId(p.userId, userId) : false,
      };
    });

    // find current user rank if outside top-10
    let myEntry = null;
    if (userId) {
      const idx = c.userProgress.findIndex((p) => sameId(p.userId, userId));
      if (idx !== -1) {
        const myProg = c.userProgress[idx];
        const rank =
          c.userProgress.filter(
            (p) => p.completedTasks.length > myProg.completedTasks.length,
          ).length + 1;
        myEntry = {
          rank,
          tasksCompleted: myProg.completedTasks.length,
          progress: myProg.progress,
        };
      }
    }

    return res.json({
      success: true,
      board,
      myEntry,
      total: c.participants.length,
    });
  } catch (err) {
    console.error("[getBoard]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   GET /api/challenges/:id/feed?page=1&limit=10
════════════════════════════════════════════════════════════ */
exports.getFeed = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const total = await ChallengePost.countDocuments({
      challengeId: req.params.id,
      isDeleted: false,
    });

    const posts = await ChallengePost.find({
      challengeId: req.params.id,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("userId", "handle niche");

    const shaped = posts.map((p) => ({
      id: p._id,
      userId: p.userId._id,
      handle: p.userId.handle,
      niche: p.userId.niche || "",
      text: p.text,
      attachLabel: p.attachLabel,
      createdAt: p.createdAt,
      timeLabel: relativeTime(p.createdAt),
      isOwn: userId ? sameId(p.userId._id, userId) : false,
      reactions: p.reactions.map((r) => ({
        emoji: r.emoji,
        count: r.users.length,
        reacted: userId ? r.users.some((u) => sameId(u, userId)) : false,
      })),
    }));

    return res.json({
      success: true,
      total,
      page: Number(page),
      posts: shaped,
    });
  } catch (err) {
    console.error("[getFeed]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   POST /api/challenges/:id/feed
   Body: { text, attachLabel? }
════════════════════════════════════════════════════════════ */
exports.postFeed = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { text, attachLabel = null } = req.body;

    if (!text?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Text is required" });
    }

    // Verify user has joined
    const c = await Challenge.findOne({
      _id: req.params.id,
      isActive: true,
    }).select("participants title");
    if (!c)
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found" });
    if (!c.participants.some((p) => sameId(p, userId))) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Join the challenge to post updates",
        });
    }

    const post = await ChallengePost.create({
      challengeId: req.params.id,
      userId,
      text: text.trim(),
      attachLabel: attachLabel || null,
      reactions: [
        { emoji: "🙌", users: [] },
        { emoji: "💚", users: [] },
        { emoji: "🔥", users: [] },
      ],
    });

    const user = await User.findById(userId).select("handle niche");

    return res.status(201).json({
      success: true,
      message: "Update posted! +10 pts earned",
      post: {
        id: post._id,
        userId,
        handle: user.handle,
        niche: user.niche || "",
        text: post.text,
        attachLabel: post.attachLabel,
        createdAt: post.createdAt,
        timeLabel: "Just now",
        isOwn: true,
        reactions: post.reactions.map((r) => ({
          emoji: r.emoji,
          count: 0,
          reacted: false,
        })),
      },
    });
  } catch (err) {
    console.error("[postFeed]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   PATCH /api/challenges/:id/feed/:postId/react
   Body: { emoji }
════════════════════════════════════════════════════════════ */
exports.toggleReaction = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { emoji } = req.body;
    if (!emoji)
      return res
        .status(400)
        .json({ success: false, message: "emoji required" });

    const post = await ChallengePost.findOne({
      _id: req.params.postId,
      challengeId: req.params.id,
      isDeleted: false,
    });
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    let reaction = post.reactions.find((r) => r.emoji === emoji);
    if (!reaction) {
      post.reactions.push({ emoji, users: [userId] });
      await post.save();
      return res.json({ success: true, reacted: true, count: 1 });
    }

    const idx = reaction.users.findIndex((u) => sameId(u, userId));
    if (idx === -1) {
      reaction.users.push(userId);
    } else {
      reaction.users.splice(idx, 1);
    }
    await post.save();

    return res.json({
      success: true,
      reacted: idx === -1,
      count: reaction.users.length,
    });
  } catch (err) {
    console.error("[toggleReaction]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   DELETE /api/challenges/:id/feed/:postId
════════════════════════════════════════════════════════════ */
exports.deleteFeedPost = async (req, res) => {
  try {
    const userId = req.user.userId;
    const post = await ChallengePost.findOne({
      _id: req.params.postId,
      challengeId: req.params.id,
    });
    if (!post)
      return res.status(404).json({ success: false, message: "Not found" });
    if (!sameId(post.userId, userId)) {
      return res.status(403).json({ success: false, message: "Not your post" });
    }
    post.isDeleted = true;
    await post.save();
    return res.json({ success: true, message: "Post removed" });
  } catch (err) {
    console.error("[deleteFeedPost]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   PATCH /api/challenges/:id/tasks/:taskId
   Marks a task as complete for the current user.
   Auto-recalculates progress % and awards points on 100%.
════════════════════════════════════════════════════════════ */
exports.completeTask = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { taskId } = req.params;

    const c = await Challenge.findOne({ _id: req.params.id, isActive: true });
    if (!c)
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found" });

    // Verify task exists in this challenge
    const task = c.tasks.find((t) => sameId(t._id, taskId));
    if (!task)
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });

    // Verify user is a participant
    if (!c.participants.some((p) => sameId(p, userId))) {
      return res
        .status(403)
        .json({ success: false, message: "Join the challenge first" });
    }

    let entry = c.userProgress.find((p) => sameId(p.userId, userId));
    if (!entry) {
      c.userProgress.push({ userId, completedTasks: [], progress: 0 });
      entry = c.userProgress[c.userProgress.length - 1];
    }

    // Idempotent
    if (entry.completedTasks.some((tid) => sameId(tid, taskId))) {
      return res.json({
        success: true,
        alreadyDone: true,
        progress: entry.progress,
      });
    }

    entry.completedTasks.push(toId(taskId));

    // Recalculate %
    const totalTasks = c.tasks.length;
    const doneTasks = entry.completedTasks.length;
    entry.progress =
      totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    entry.progressLabel = `${doneTasks} of ${totalTasks} tasks done`;

    // Auto-complete at 100%
    if (entry.progress === 100 && !entry.completedAt) {
      entry.completedAt = new Date();
      const rank =
        c.userProgress.filter((p) => p.completedAt && !sameId(p.userId, userId))
          .length + 1;
      entry.rank = rank;
      entry.ptsEarned = c.pointsReward;
      await User.findByIdAndUpdate(userId, {
        $inc: { points: c.pointsReward },
      });
    }

    await c.save();

    return res.json({
      success: true,
      progress: entry.progress,
      progressLabel: entry.progressLabel,
      completedTasks: entry.completedTasks.map(String),
      justCompleted: entry.progress === 100,
      rank: entry.rank,
      ptsEarned: entry.ptsEarned,
    });
  } catch (err) {
    console.error("[completeTask]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   PATCH /api/challenges/:id/bookmark
════════════════════════════════════════════════════════════ */
exports.toggleBookmark = async (req, res) => {
  try {
    const userId = req.user.userId;
    const c = await Challenge.findOne({
      _id: req.params.id,
      isActive: true,
    }).select("userProgress participants");
    if (!c)
      return res.status(404).json({ success: false, message: "Not found" });

    let entry = c.userProgress.find((p) => sameId(p.userId, userId));
    if (!entry) {
      c.userProgress.push({
        userId,
        bookmarked: true,
        completedTasks: [],
        progress: 0,
      });
      await c.save();
      return res.json({ success: true, bookmarked: true });
    }
    entry.bookmarked = !entry.bookmarked;
    await c.save();
    return res.json({ success: true, bookmarked: entry.bookmarked });
  } catch (err) {
    console.error("[toggleBookmark]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   PATCH /api/challenges/:id/leave
   Removes user from participants and clears their progress.
════════════════════════════════════════════════════════════ */
exports.leaveChallenge = async (req, res) => {
  try {
    const userId = req.user.userId;
    const c = await Challenge.findOne({ _id: req.params.id, isActive: true });
    if (!c)
      return res.status(404).json({ success: false, message: "Not found" });
    if (c.status === "completed") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Cannot leave a completed challenge",
        });
    }

    c.participants = c.participants.filter((p) => !sameId(p, userId));
    c.userProgress = c.userProgress.filter((p) => !sameId(p.userId, userId));
    await c.save();

    return res.json({
      success: true,
      message: "You have left the challenge. Your progress has been reset.",
    });
  } catch (err) {
    console.error("[leaveChallenge]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ── Utility ─────────────────────────────────────────────── */
function relativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
