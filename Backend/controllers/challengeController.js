// const Challenge = require("../models/Challenge");

// // ── GET /api/challenges ────────────────────────────────────
// exports.getChallenges = async (req, res) => {
//   try {
//     const userId = req.user.userId;
//     const challenges = await Challenge.find({ isActive: true }).sort({
//       createdAt: -1,
//     });

//     // const data = challenges.map((c) => ({
//     //   id: c._id,
//     //   icon: c.icon,
//     //   bg: c.bg,
//     //   title: c.title,
//     //   meta: c.meta,
//     //   participantCount: c.participants.length,
//     //   joined: c.participants.some((p) => p.toString() === userId.toString()),
//     //   endsAt: c.endsAt,
//     // }));
//     const data = challenges.map((c) => ({
//       id: c._id,
//       icon: c.icon,
//       iconBg: c.iconBg, // ✅ was c.bg  — field is iconBg in the model
//       title: c.title,
//       description: c.description, // ✅ was c.meta — field is description in the model
//       participantCount: c.participants.length,
//       joined: c.participants.some((p) => p.toString() === userId.toString()),
//       endsAt: c.endsAt,
//     }));

//     return res.status(200).json({ success: true, data });
//   } catch (err) {
//     console.error("[getChallenges]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// // ── PATCH /api/challenges/:id/join ─────────────────────────
// exports.toggleJoin = async (req, res) => {
//   try {
//     const challenge = await Challenge.findById(req.params.id);
//     if (!challenge)
//       return res.status(404).json({ message: "Challenge not found" });

//     const userId = req.user.userId;
//     const idx = challenge.participants.findIndex(
//       (p) => p.toString() === userId.toString(),
//     );

//     idx === -1
//       ? challenge.participants.push(userId)
//       : challenge.participants.splice(idx, 1);

//     await challenge.save();

//     return res.status(200).json({
//       success: true,
//       joined: idx === -1,
//       participantCount: challenge.participants.length,
//     });
//   } catch (err) {
//     console.error("[toggleJoin]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };
// Backend/controllers/challengeController.js
const Challenge = require("../models/Challenge");

// ── GET /api/challenges ────────────────────────────────────
exports.getChallenges = async (req, res) => {
  try {
    const userId = req.user.userId;
    const challenges = await Challenge.find({ isActive: true }).sort({
      createdAt: -1,
    });

    const data = challenges.map((c) => ({
      id: c._id,
      icon: c.icon,
      iconBg: c.iconBg, // Challenge.js schema field name
      title: c.title,
      description: c.description, // Challenge.js schema field name
      participantCount: c.participants.length,
      joined: c.participants.some((p) => p.toString() === userId.toString()),
      endsAt: c.endsAt,
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("[getChallenges]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── PATCH /api/challenges/:id/join ─────────────────────────
exports.toggleJoin = async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) {
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found" });
    }

    const userId = req.user.userId;
    const idx = challenge.participants.findIndex(
      (p) => p.toString() === userId.toString(),
    );

    idx === -1
      ? challenge.participants.push(userId)
      : challenge.participants.splice(idx, 1);

    await challenge.save();

    return res.status(200).json({
      success: true,
      joined: idx === -1,
      participantCount: challenge.participants.length,
    });
  } catch (err) {
    console.error("[toggleJoin]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
