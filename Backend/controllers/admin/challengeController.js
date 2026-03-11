// // REAL FIELD MAP (Challenge.js):
// // /controllers/admin/challengeController
// //   icon, bg, title, meta, participants([ObjectId]), isActive, endsAt, createdBy
// //   NO startDate / completionRate / rewardBadge / targetNiche
// const Challenge = require("../../models/Challenge");
// const AdminLog = require("../../models/AdminLog");

// const log = (admin, action, targetId, detail) =>
//   AdminLog.create({
//     admin,
//     action,
//     targetType: "challenge",
//     targetId: String(targetId),
//     detail,
//   }).catch((e) => console.error("[AdminLog]", e.message));

// const getChallenges = async (req, res, next) => {
//   try {
//     const filter = {};
//     if (req.query.status === "active") filter.isActive = true;
//     if (req.query.status === "ended") filter.isActive = false;

//     const challenges = await Challenge.find(filter)
//       .sort({ createdAt: -1 })
//       .populate("createdBy", "handle firstName avatar");
//     res.json({ success: true, challenges });
//   } catch (err) {
//     next(err);
//   }
// };

// const getChallengeStats = async (req, res, next) => {
//   try {
//     const [active, ended, agg] = await Promise.all([
//       Challenge.countDocuments({ isActive: true }),
//       Challenge.countDocuments({ isActive: false }),
//       Challenge.aggregate([
//         { $group: { _id: null, total: { $sum: { $size: "$participants" } } } },
//       ]),
//     ]);
//     res.json({
//       success: true,
//       stats: { active, ended, totalParticipants: agg[0]?.total ?? 0 },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// const createChallenge = async (req, res, next) => {
//   try {
//     const { icon, bg, title, meta, endsAt } = req.body;
//     if (!title)
//       return res
//         .status(400)
//         .json({ success: false, message: "title is required" });

//     const ch = await Challenge.create({
//       icon: icon || "🎯",
//       bg: bg || "rgba(122,143,82,.12)",
//       title: title.trim(),
//       meta: meta || "",
//       endsAt: endsAt ? new Date(endsAt) : null,
//       isActive: true,
//       createdBy: req.admin.id || null,
//     });
//     await log(
//       req.admin.handle,
//       "create_challenge",
//       ch._id,
//       `Launched: "${ch.title}"`,
//     );
//     res
//       .status(201)
//       .json({ success: true, message: "Challenge launched!", challenge: ch });
//   } catch (err) {
//     next(err);
//   }
// };

// const endChallenge = async (req, res, next) => {
//   try {
//     const ch = await Challenge.findByIdAndUpdate(
//       req.params.id,
//       { isActive: false },
//       { new: true, select: "title isActive" },
//     );
//     if (!ch)
//       return res
//         .status(404)
//         .json({ success: false, message: "Challenge not found" });
//     await log(
//       req.admin.handle,
//       "end_challenge",
//       ch._id,
//       `Ended: "${ch.title}"`,
//     );
//     res.json({ success: true, message: "Challenge ended" });
//   } catch (err) {
//     next(err);
//   }
// };

// module.exports = {
//   getChallenges,
//   getChallengeStats,
//   createChallenge,
//   endChallenge,
// };
// craftsos-admin/Backend/controllers/admin/challengeController.js
// ──────────────────────────────────────────────────────────────────────
// REAL FIELD MAP (Challenge.js v2 — expanded schema):
//   emoji, coverBg, niche, title, description
//   difficulty: "easy"|"medium"|"hard"
//   status:     "upcoming"|"active"|"completed"
//   featured:   Boolean
//   rewards:    [{ type, label, icon, sub, topOnly }]
//   tasks:      [{ order, title, description, dueLabel, tagCls, tagText }]
//   rules:      [{ order, text }]
//   startsAt:   Date | null
//   endsAt:     Date | null
//   pointsReward: Number
//   participants: [ObjectId]   ← read-only from admin
//   userProgress: [...]        ← read-only from admin
//   isActive:   Boolean        ← soft-delete flag
//   createdBy:  ObjectId | null
// ──────────────────────────────────────────────────────────────────────
const Challenge = require("../../models/Challenge");
const AdminLog = require("../../models/AdminLog");

const log = (admin, action, targetId, detail) =>
  AdminLog.create({
    admin,
    action,
    targetType: "challenge",
    targetId: String(targetId),
    detail,
  }).catch((e) => console.error("[AdminLog]", e.message));

// Allowed reward types
const REWARD_TYPES = ["pts", "badge", "cert", "top", "sponsor"];
// Editable scalar fields
const SCALAR_FIELDS = [
  "emoji",
  "coverBg",
  "niche",
  "title",
  "description",
  "difficulty",
  "status",
  "featured",
  "pointsReward",
  "startsAt",
  "endsAt",
];

/* ── Helpers ─────────────────────────────────────────────── */
function sanitizeRewards(arr) {
  if (!Array.isArray(arr)) return undefined;
  return arr
    .filter((r) => r && REWARD_TYPES.includes(r.type) && r.label?.trim())
    .map((r) => ({
      type: r.type,
      label: String(r.label).trim().slice(0, 80),
      icon: r.icon ? String(r.icon).trim() : "",
      sub: r.sub ? String(r.sub).trim() : "",
      topOnly: !!r.topOnly,
    }));
}

function sanitizeTasks(arr) {
  if (!Array.isArray(arr)) return undefined;
  return arr
    .filter((t) => t && t.title?.trim())
    .map((t, i) => ({
      order: typeof t.order === "number" ? t.order : i + 1,
      title: String(t.title).trim().slice(0, 150),
      description: t.description
        ? String(t.description).trim().slice(0, 400)
        : "",
      dueLabel: t.dueLabel ? String(t.dueLabel).trim() : "",
      tagCls: t.tagCls ? String(t.tagCls).trim() : "",
      tagText: t.tagText ? String(t.tagText).trim() : "",
    }));
}

function sanitizeRules(arr) {
  if (!Array.isArray(arr)) return undefined;
  return arr
    .filter((r) => r && r.text?.trim())
    .map((r, i) => ({
      order: typeof r.order === "number" ? r.order : i + 1,
      text: String(r.text).trim().slice(0, 500),
    }));
}

function buildUpdate(body) {
  const update = {};

  // Scalar fields
  SCALAR_FIELDS.forEach((k) => {
    if (body[k] !== undefined) {
      if (k === "startsAt" || k === "endsAt") {
        update[k] = body[k] ? new Date(body[k]) : null;
      } else if (k === "pointsReward") {
        update[k] = Math.max(0, Number(body[k]) || 0);
      } else if (k === "featured") {
        update[k] = !!body[k];
      } else {
        update[k] = body[k];
      }
    }
  });

  // Array sub-docs
  const rewards = sanitizeRewards(body.rewards);
  if (rewards !== undefined) update.rewards = rewards;

  const tasks = sanitizeTasks(body.tasks);
  if (tasks !== undefined) update.tasks = tasks;

  const rules = sanitizeRules(body.rules);
  if (rules !== undefined) update.rules = rules;

  return update;
}

/* ══════════════════════════════════════════════════════════
   GET /api/admin/challenges?status=active|upcoming|completed|ended
   Returns list + a summary shape for the admin table.
══════════════════════════════════════════════════════════ */
const getChallenges = async (req, res, next) => {
  try {
    const filter = { isActive: true }; // default: non-deleted only
    const { status, showEnded } = req.query;

    if (showEnded === "1") delete filter.isActive; // show all including soft-deleted
    if (status === "active") filter.status = "active";
    if (status === "upcoming") filter.status = "upcoming";
    if (status === "completed") filter.status = "completed";
    if (status === "ended") {
      filter.isActive = false;
      delete filter.status;
    }

    const challenges = await Challenge.find(filter)
      .sort({ createdAt: -1 })
      .select("-userProgress") // don't return huge progress arrays in list
      .populate("createdBy", "handle firstName");

    // Shape for admin table
    const shaped = challenges.map((c) => ({
      id: c._id,
      emoji: c.emoji,
      coverBg: c.coverBg,
      niche: c.niche,
      title: c.title,
      description: c.description,
      difficulty: c.difficulty,
      status: c.status,
      featured: c.featured,
      isActive: c.isActive,
      participantCount: c.participants.length,
      taskCount: c.tasks.length,
      ruleCount: c.rules.length,
      rewardCount: c.rewards.length,
      pointsReward: c.pointsReward,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
    }));

    res.json({ success: true, challenges: shaped, total: shaped.length });
  } catch (err) {
    next(err);
  }
};

/* ══════════════════════════════════════════════════════════
   GET /api/admin/challenges/stats
══════════════════════════════════════════════════════════ */
const getChallengeStats = async (req, res, next) => {
  try {
    const [upcoming, active, completed, ended, participantsAgg, featuredCount] =
      await Promise.all([
        Challenge.countDocuments({ status: "upcoming", isActive: true }),
        Challenge.countDocuments({ status: "active", isActive: true }),
        Challenge.countDocuments({ status: "completed", isActive: true }),
        Challenge.countDocuments({ isActive: false }),
        Challenge.aggregate([
          { $match: { isActive: true } },
          {
            $group: { _id: null, total: { $sum: { $size: "$participants" } } },
          },
        ]),
        Challenge.countDocuments({ featured: true, isActive: true }),
      ]);

    res.json({
      success: true,
      stats: {
        upcoming,
        active,
        completed,
        ended,
        featured: featuredCount,
        totalParticipants: participantsAgg[0]?.total ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

/* ══════════════════════════════════════════════════════════
   GET /api/admin/challenges/:id  — full detail including tasks/rules
══════════════════════════════════════════════════════════ */
const getChallenge = async (req, res, next) => {
  try {
    const ch = await Challenge.findById(req.params.id)
      .select("-userProgress")
      .populate("createdBy", "handle firstName");
    if (!ch)
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found" });
    res.json({ success: true, challenge: ch });
  } catch (err) {
    next(err);
  }
};

/* ══════════════════════════════════════════════════════════
   POST /api/admin/challenges
   Full creation with all new fields.
══════════════════════════════════════════════════════════ */
const createChallenge = async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "title is required" });
    }

    const data = buildUpdate(req.body);
    data.title = title.trim();
    data.isActive = true;
    data.createdBy = req.admin?.id || null;

    // Default status to "upcoming" if not provided
    if (!data.status) data.status = "upcoming";

    const ch = await Challenge.create(data);
    await log(
      req.admin.handle,
      "create_challenge",
      ch._id,
      `Launched: "${ch.title}"`,
    );

    res
      .status(201)
      .json({ success: true, message: "Challenge launched!", challenge: ch });
  } catch (err) {
    next(err);
  }
};

/* ══════════════════════════════════════════════════════════
   PUT /api/admin/challenges/:id  — full update
══════════════════════════════════════════════════════════ */
const updateChallenge = async (req, res, next) => {
  try {
    const update = buildUpdate(req.body);
    if (Object.keys(update).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Nothing to update" });
    }

    const ch = await Challenge.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).select("-userProgress");
    if (!ch)
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found" });

    await log(
      req.admin.handle,
      "update_challenge",
      ch._id,
      `Updated: "${ch.title}"`,
    );
    res.json({ success: true, message: "Challenge updated", challenge: ch });
  } catch (err) {
    next(err);
  }
};

/* ══════════════════════════════════════════════════════════
   PATCH /api/admin/challenges/:id/end
   Sets status = "completed" + isActive = false.
══════════════════════════════════════════════════════════ */
const endChallenge = async (req, res, next) => {
  try {
    const ch = await Challenge.findByIdAndUpdate(
      req.params.id,
      { isActive: false, status: "completed" },
      { new: true, select: "title isActive status" },
    );
    if (!ch)
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found" });

    await log(
      req.admin.handle,
      "end_challenge",
      ch._id,
      `Ended: "${ch.title}"`,
    );
    res.json({ success: true, message: "Challenge ended", challenge: ch });
  } catch (err) {
    next(err);
  }
};

/* ══════════════════════════════════════════════════════════
   PATCH /api/admin/challenges/:id/reactivate
   Restores a soft-deleted / completed challenge to active.
══════════════════════════════════════════════════════════ */
const reactivateChallenge = async (req, res, next) => {
  try {
    const ch = await Challenge.findByIdAndUpdate(
      req.params.id,
      { isActive: true, status: "active" },
      { new: true, select: "title isActive status" },
    );
    if (!ch)
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found" });

    await log(
      req.admin.handle,
      "reactivate_challenge",
      ch._id,
      `Reactivated: "${ch.title}"`,
    );
    res.json({
      success: true,
      message: "Challenge reactivated",
      challenge: ch,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getChallenges,
  getChallengeStats,
  getChallenge,
  createChallenge,
  updateChallenge,
  endChallenge,
  reactivateChallenge,
};
