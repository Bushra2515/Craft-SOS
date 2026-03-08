// REAL FIELD MAP (Challenge.js):
//   icon, bg, title, meta, participants([ObjectId]), isActive, endsAt, createdBy
//   NO startDate / completionRate / rewardBadge / targetNiche
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

const getChallenges = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status === "active") filter.isActive = true;
    if (req.query.status === "ended") filter.isActive = false;

    const challenges = await Challenge.find(filter)
      .sort({ createdAt: -1 })
      .populate("createdBy", "handle firstName avatar");
    res.json({ success: true, challenges });
  } catch (err) {
    next(err);
  }
};

const getChallengeStats = async (req, res, next) => {
  try {
    const [active, ended, agg] = await Promise.all([
      Challenge.countDocuments({ isActive: true }),
      Challenge.countDocuments({ isActive: false }),
      Challenge.aggregate([
        { $group: { _id: null, total: { $sum: { $size: "$participants" } } } },
      ]),
    ]);
    res.json({
      success: true,
      stats: { active, ended, totalParticipants: agg[0]?.total ?? 0 },
    });
  } catch (err) {
    next(err);
  }
};

const createChallenge = async (req, res, next) => {
  try {
    const { icon, bg, title, meta, endsAt } = req.body;
    if (!title)
      return res
        .status(400)
        .json({ success: false, message: "title is required" });

    const ch = await Challenge.create({
      icon: icon || "🎯",
      bg: bg || "rgba(122,143,82,.12)",
      title: title.trim(),
      meta: meta || "",
      endsAt: endsAt ? new Date(endsAt) : null,
      isActive: true,
      createdBy: req.admin.id || null,
    });
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

const endChallenge = async (req, res, next) => {
  try {
    const ch = await Challenge.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true, select: "title isActive" },
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
    res.json({ success: true, message: "Challenge ended" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getChallenges,
  getChallengeStats,
  createChallenge,
  endChallenge,
};
