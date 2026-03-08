// User.badges is String[] — we push the badge NAME (not ObjectId)
const Badge = require("../../models/Badge");
const User = require("../../models/User");
const AdminLog = require("../../models/AdminLog");

const log = (admin, action, targetId, detail) =>
  AdminLog.create({
    admin,
    action,
    targetType: "badge",
    targetId: String(targetId),
    detail,
  }).catch((e) => console.error("[AdminLog]", e.message));

const getBadges = async (req, res, next) => {
  try {
    const badges = await Badge.find({ isActive: true }).sort({
      holderCount: -1,
    });
    res.json({ success: true, badges });
  } catch (err) {
    next(err);
  }
};

const getRecentAwards = async (req, res, next) => {
  try {
    const awards = await Badge.aggregate([
      { $unwind: "$awards" },
      { $sort: { "awards.awardedAt": -1 } },
      { $limit: 10 },
      {
        $project: {
          badge: "$name",
          user: "$awards.userHandle",
          awardedBy: "$awards.awardedBy",
          awardedAt: "$awards.awardedAt",
          reason: "$awards.reason",
        },
      },
    ]);
    res.json({ success: true, awards });
  } catch (err) {
    next(err);
  }
};

const createBadge = async (req, res, next) => {
  try {
    const { name, emoji, criteria, trigger, pointsReward } = req.body;
    if (!name)
      return res
        .status(400)
        .json({ success: false, message: "name is required" });
    const badge = await Badge.create({
      name: name.trim(),
      emoji: emoji || "🏅",
      criteria: criteria || "",
      trigger: trigger || "manual",
      pointsReward: pointsReward || 0,
    });
    await log(
      req.admin.handle,
      "create_badge",
      badge._id,
      `Created: ${badge.emoji} ${badge.name}`,
    );
    res.status(201).json({ success: true, message: "Badge created", badge });
  } catch (err) {
    next(err);
  }
};

const assignBadge = async (req, res, next) => {
  try {
    const { userId, reason = "" } = req.body;
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });

    const [badge, user] = await Promise.all([
      Badge.findById(req.params.id),
      User.findById(userId).select("handle firstName badges points"),
    ]);
    if (!badge)
      return res
        .status(404)
        .json({ success: false, message: "Badge not found" });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // User.badges is String[] — check for duplicate by name
    if (user.badges.includes(badge.name)) {
      return res.status(409).json({
        success: false,
        message: `@${user.handle} already has "${badge.name}"`,
      });
    }

    // Push badge NAME (string) into user, award points
    await User.findByIdAndUpdate(userId, {
      $addToSet: { badges: badge.name },
      $inc: { points: badge.pointsReward || 0 },
    });

    // Record award + increment holderCount
    await Badge.findByIdAndUpdate(req.params.id, {
      $push: {
        awards: {
          userHandle: user.handle,
          userId: user._id,
          awardedBy: req.admin.handle,
          awardedAt: new Date(),
          reason,
        },
      },
      $inc: { holderCount: 1 },
    });

    await log(
      req.admin.handle,
      "assign_badge",
      badge._id,
      `Awarded ${badge.emoji} "${badge.name}" to @${user.handle}`,
    );

    res.json({
      success: true,
      message: `${badge.emoji} "${badge.name}" awarded to @${user.handle}`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getBadges, getRecentAwards, createBadge, assignBadge };
