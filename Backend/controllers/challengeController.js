// Backend/controllers/challengeController.js
// Handles all challenge routes:
//   GET    /api/challenges           → list (filtered by status/search)
//   GET    /api/challenges/leaderboard → top users by points from challenges
//   GET    /api/challenges/:id       → single challenge detail
//   POST   /api/challenges           → admin: create challenge
//   PATCH  /api/challenges/:id/join  → join or leave
//   PATCH  /api/challenges/:id/progress → update own progress %
//   PATCH  /api/challenges/:id/status   → admin: change status
//   DELETE /api/challenges/:id       → admin: delete

const Challenge = require("../models/Challenge");
const User = require("../models/User");

/* ── Helpers ─────────────────────────────────────────────── */
const isSameId = (a, b) => a.toString() === b.toString();

// Build the "time" display string sent to the frontend
function buildTimeLabel(c) {
  const now = Date.now();
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
    const diff = c.startsAt - now;
    const days = Math.ceil(diff / 86400000);
    return days <= 0
      ? "Starting soon"
      : `Starts in ${days} day${days !== 1 ? "s" : ""}`;
  }
  if (c.status === "active" && c.endsAt) {
    const diff = c.endsAt - now;
    if (diff <= 0) return "Ending soon";
    const days = Math.ceil(diff / 86400000);
    return `${days} day${days !== 1 ? "s" : ""} left`;
  }
  return "";
}

// Shape a challenge document for the frontend
function formatChallenge(c, userId) {
  const joined = userId
    ? c.participants.some((p) => isSameId(p, userId))
    : false;

  // Find this user's progress entry
  const myProgress = userId
    ? c.userProgress.find((p) => isSameId(p.userId, userId))
    : null;

  return {
    id: c._id,
    emoji: c.emoji,
    coverBg: c.coverBg,
    niche: c.niche,
    title: c.title,
    description: c.description,
    difficulty: c.difficulty,
    status: c.status,
    featured: c.featured,
    rewards: c.rewards,
    pointsReward: c.pointsReward,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    time: buildTimeLabel(c),
    urgent:
      c.endsAt && c.status === "active"
        ? c.endsAt - Date.now() < 3 * 86400000 // < 3 days
        : false,
    totalP: c.participants.length,
    // small avatar stack (just first 4 participant IDs — frontend fetches handles if needed)
    participantIds: c.participants.slice(0, 4).map((p) => p.toString()),
    joined,
    progress: myProgress?.progress ?? 0,
    progressLabel: myProgress?.progressLabel ?? "",
    completed:
      joined && myProgress?.completedAt
        ? {
            rank: myProgress.rank,
            ptsEarned: myProgress.ptsEarned,
          }
        : null,
  };
}

/* ════════════════════════════════════════════════════════════
   GET /api/challenges
   Query params: status (upcoming|active|completed|all), search, page, limit
════════════════════════════════════════════════════════════ */
exports.getChallenges = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { status = "all", search = "", page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };
    if (status && status !== "all") filter.status = status;
    if (search.trim()) {
      const re = new RegExp(search.trim(), "i");
      filter.$or = [{ title: re }, { description: re }, { niche: re }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Challenge.countDocuments(filter);
    const challenges = await Challenge.find(filter)
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      challenges: challenges.map((c) => formatChallenge(c, userId)),
    });
  } catch (err) {
    console.error("[getChallenges]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   GET /api/challenges/leaderboard
   Returns top 10 users ranked by total ptsEarned across all challenges
════════════════════════════════════════════════════════════ */
exports.getLeaderboard = async (req, res) => {
  try {
    const userId = req.user?.userId;

    // Aggregate total points earned per user from completed challenges
    const rows = await Challenge.aggregate([
      { $unwind: "$userProgress" },
      { $match: { "userProgress.completedAt": { $ne: null } } },
      {
        $group: {
          _id: "$userProgress.userId",
          ptsTotal: { $sum: "$userProgress.ptsEarned" },
          wins: { $sum: { $cond: [{ $eq: ["$userProgress.rank", 1] }, 1, 0] } },
          completed: { $sum: 1 },
        },
      },
      { $sort: { ptsTotal: -1 } },
      { $limit: 10 },
    ]);

    // Populate handle + niche from User
    const ids = rows.map((r) => r._id);
    const users = await User.find({ _id: { $in: ids } }).select(
      "handle firstName niche",
    );
    const uMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const leaderboard = rows.map((r, i) => {
      const u = uMap[r._id.toString()] || {};
      return {
        rank: i + 1,
        userId: r._id,
        handle: u.handle || "—",
        niche: u.niche || "",
        ptsTotal: r.ptsTotal,
        wins: r.wins,
        completed: r.completed,
        isMe: userId ? isSameId(r._id, userId) : false,
      };
    });

    // Also return the current user's rank if they're not in top 10
    let myRank = null;
    if (userId) {
      const myIdx = leaderboard.findIndex((l) => l.isMe);
      if (myIdx === -1) {
        // Count users with more points
        const myTotalArr = await Challenge.aggregate([
          { $unwind: "$userProgress" },
          {
            $match: {
              "userProgress.userId": new (require("mongoose").Types.ObjectId)(
                userId,
              ),
              "userProgress.completedAt": { $ne: null },
            },
          },
          { $group: { _id: null, total: { $sum: "$userProgress.ptsEarned" } } },
        ]);
        const myTotal = myTotalArr[0]?.total ?? 0;
        const above = await Challenge.aggregate([
          { $unwind: "$userProgress" },
          { $match: { "userProgress.completedAt": { $ne: null } } },
          {
            $group: {
              _id: "$userProgress.userId",
              pts: { $sum: "$userProgress.ptsEarned" },
            },
          },
          { $match: { pts: { $gt: myTotal } } },
          { $count: "n" },
        ]);
        myRank = { rank: (above[0]?.n ?? 0) + 1, ptsTotal: myTotal };
      } else {
        myRank = leaderboard[myIdx];
      }
    }

    return res.json({ success: true, leaderboard, myRank });
  } catch (err) {
    console.error("[getLeaderboard]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   GET /api/challenges/:id
════════════════════════════════════════════════════════════ */
exports.getChallenge = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const c = await Challenge.findById(req.params.id);
    if (!c)
      return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, challenge: formatChallenge(c, userId) });
  } catch (err) {
    console.error("[getChallenge]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   POST /api/challenges   (admin only)
   Body: { title, description, emoji, coverBg, niche, difficulty,
           rewards, pointsReward, startsAt, endsAt, featured }
════════════════════════════════════════════════════════════ */
exports.createChallenge = async (req, res) => {
  try {
    const {
      title,
      description = "",
      emoji = "🎯",
      coverBg,
      niche = "Community",
      difficulty = "medium",
      rewards = [],
      pointsReward = 0,
      startsAt,
      endsAt,
      featured = false,
    } = req.body;

    if (!title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Title is required" });
    }

    // Derive initial status from startsAt
    let status = "active";
    if (startsAt && new Date(startsAt) > new Date()) status = "upcoming";

    const challenge = await Challenge.create({
      title: title.trim(),
      description,
      emoji,
      coverBg: coverBg || "linear-gradient(135deg,#7a8f52 0%,#3d5a20 100%)",
      niche,
      difficulty,
      rewards,
      pointsReward,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      featured,
      status,
      createdBy: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      message: "Challenge created",
      challenge: formatChallenge(challenge, req.user.userId),
    });
  } catch (err) {
    console.error("[createChallenge]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   PATCH /api/challenges/:id/join
   Toggles current user in/out of participants array
════════════════════════════════════════════════════════════ */
exports.toggleJoin = async (req, res) => {
  try {
    const userId = req.user.userId;
    const c = await Challenge.findById(req.params.id);
    if (!c)
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found" });
    if (c.status === "completed") {
      return res
        .status(400)
        .json({ success: false, message: "This challenge has ended" });
    }

    const idx = c.participants.findIndex((p) => isSameId(p, userId));
    const joining = idx === -1;

    if (joining) {
      c.participants.push(userId);
      // Create a progress entry if not yet present
      const hasProgress = c.userProgress.some((p) =>
        isSameId(p.userId, userId),
      );
      if (!hasProgress) {
        c.userProgress.push({ userId, progress: 0, progressLabel: "" });
      }
    } else {
      c.participants.splice(idx, 1);
    }

    await c.save();

    return res.json({
      success: true,
      joined: joining,
      participantCount: c.participants.length,
      message: joining ? `Joined "${c.title}"! 🎉` : `Left "${c.title}"`,
    });
  } catch (err) {
    console.error("[toggleJoin]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   PATCH /api/challenges/:id/progress
   Body: { progress (0-100), progressLabel }
════════════════════════════════════════════════════════════ */
exports.updateProgress = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { progress, progressLabel = "" } = req.body;

    if (typeof progress !== "number" || progress < 0 || progress > 100) {
      return res
        .status(400)
        .json({ success: false, message: "progress must be 0–100" });
    }

    const c = await Challenge.findById(req.params.id);
    if (!c)
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found" });

    const isParticipant = c.participants.some((p) => isSameId(p, userId));
    if (!isParticipant) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You have not joined this challenge",
        });
    }

    const entry = c.userProgress.find((p) => isSameId(p.userId, userId));
    if (!entry) {
      c.userProgress.push({ userId, progress, progressLabel });
    } else {
      entry.progress = progress;
      entry.progressLabel = progressLabel;
      // Mark completed if 100%
      if (progress === 100 && !entry.completedAt) {
        entry.completedAt = new Date();
        // Assign rank = number of people who completed before + 1
        const rank =
          c.userProgress.filter(
            (p) => p.completedAt && !isSameId(p.userId, userId),
          ).length + 1;
        entry.rank = rank;
        entry.ptsEarned = c.pointsReward;

        // Award points to user
        await User.findByIdAndUpdate(userId, {
          $inc: { points: c.pointsReward },
        });
      }
    }

    await c.save();

    return res.json({
      success: true,
      message: "Progress updated",
      progress,
      progressLabel,
    });
  } catch (err) {
    console.error("[updateProgress]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   PATCH /api/challenges/:id/status  (admin only)
   Body: { status: "upcoming"|"active"|"completed" }
════════════════════════════════════════════════════════════ */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["upcoming", "active", "completed"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }
    const c = await Challenge.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );
    if (!c)
      return res.status(404).json({ success: false, message: "Not found" });
    return res.json({
      success: true,
      message: `Status set to ${status}`,
      challenge: formatChallenge(c, req.user.userId),
    });
  } catch (err) {
    console.error("[updateStatus]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ════════════════════════════════════════════════════════════
   DELETE /api/challenges/:id  (admin only)
════════════════════════════════════════════════════════════ */
exports.deleteChallenge = async (req, res) => {
  try {
    const c = await Challenge.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    );
    if (!c)
      return res.status(404).json({ success: false, message: "Not found" });
    return res.json({ success: true, message: "Challenge removed" });
  } catch (err) {
    console.error("[deleteChallenge]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
