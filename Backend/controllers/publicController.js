// Backend/controllers/publicController.js
// ─────────────────────────────────────────────────────────────────────────────
// Public-facing endpoints — NO admin auth required.
// These power the community widgets on regular user pages:
//   GET  /api/community/challenges        → active challenges list
//   POST /api/community/challenges/:id/join → join/leave a challenge (user JWT)
//   GET  /api/community/announcements     → latest sent announcements
//   GET  /api/community/badges            → featured badge showcase
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");
const Challenge = require("../models/Challenge");
const Announcement = require("../models/Announcement");
const Badge = require("../models/Badge");
const User = require("../models/User");

/* ── GET /api/community/challenges ──────────────────────────────────────────
   Returns active challenges, with a `joined` boolean if userId is provided
   via the `?userId=` query param (or decoded from optional JWT).            */
exports.getChallenges = async (req, res) => {
  try {
    const challenges = await Challenge.find({ isActive: true })
      .sort({ createdAt: -1 })
      .select("icon bg title meta participants endsAt createdAt")
      .lean();

    // Optional: mark which ones the current user has joined
    const userId = req.query.userId || req.user?.userId;
    const shaped = challenges.map((c) => ({
      _id: c._id,
      icon: c.icon || "🎯",
      bg: c.bg || "rgba(122,143,82,.12)",
      title: c.title,
      meta: c.meta || "",
      participantCount: c.participants.length,
      endsAt: c.endsAt,
      createdAt: c.createdAt,
      joined: userId
        ? c.participants.some((p) => String(p) === String(userId))
        : false,
    }));

    res.json({ success: true, challenges: shaped });
  } catch (err) {
    console.error("[community/challenges]", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to load challenges" });
  }
};

/* ── POST /api/community/challenges/:id/join ────────────────────────────────
   Toggles the current user in/out of challenge.participants.
   Requires user JWT (via existing auth middleware on the route).             */
exports.joinChallenge = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid request" });
    }

    const challenge = await Challenge.findOne({ _id: id, isActive: true });
    if (!challenge) {
      return res
        .status(404)
        .json({ success: false, message: "Challenge not found or ended" });
    }

    const uid = new mongoose.Types.ObjectId(userId);
    const alreadyIn = challenge.participants.some(
      (p) => String(p) === String(uid),
    );

    if (alreadyIn) {
      // Leave
      await Challenge.findByIdAndUpdate(id, { $pull: { participants: uid } });
      return res.json({
        success: true,
        joined: false,
        message: `You've left "${challenge.title}"`,
        participantCount: challenge.participants.length - 1,
      });
    } else {
      // Join
      await Challenge.findByIdAndUpdate(id, {
        $addToSet: { participants: uid },
      });
      return res.json({
        success: true,
        joined: true,
        message: `You joined "${challenge.title}"! 🎉`,
        participantCount: challenge.participants.length + 1,
      });
    }
  } catch (err) {
    console.error("[community/challenges/join]", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to update challenge" });
  }
};

/* ── GET /api/community/announcements ──────────────────────────────────────
   Returns the latest N sent announcements, newest first.
   ?limit=3 (default), ?type= for filtering                                  */
exports.getAnnouncements = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 3, 10);
    const type = req.query.type;

    const filter = { status: "sent" };
    if (type) filter.type = type;

    const announcements = await Announcement.find(filter)
      .sort({ sentAt: -1 })
      .limit(limit)
      .select("title message type audience sentAt")
      .lean();

    // Increment seenCount asynchronously (fire-and-forget, don't await)
    if (announcements.length) {
      const ids = announcements.map((a) => a._id);
      Announcement.updateMany(
        { _id: { $in: ids } },
        { $inc: { seenCount: 1 } },
      ).catch((e) => console.error("[seenCount increment]", e.message));
    }

    res.json({ success: true, announcements });
  } catch (err) {
    console.error("[community/announcements]", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to load announcements" });
  }
};

/* ── GET /api/community/badges ──────────────────────────────────────────────
   Returns featured badges (most holders) for the showcase widget.
   Also returns top recent award if available.
   ?limit=6 (default)                                                         */
exports.getFeaturedBadges = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 6, 12);

    const badges = await Badge.find({ isActive: true })
      .sort({ holderCount: -1 })
      .limit(limit)
      .select("name emoji criteria holderCount pointsReward awards")
      .lean();

    // Extract the most recent award across all badges for the "spotlight" slot
    let latestAward = null;
    for (const b of badges) {
      if (b.awards?.length) {
        const sorted = [...b.awards].sort(
          (a, c) => new Date(c.awardedAt) - new Date(a.awardedAt),
        );
        const top = sorted[0];
        if (
          !latestAward ||
          new Date(top.awardedAt) > new Date(latestAward.awardedAt)
        ) {
          latestAward = { ...top, badge: b.name, emoji: b.emoji };
        }
      }
    }

    const shaped = badges.map((b) => ({
      _id: b._id,
      name: b.name,
      emoji: b.emoji || "🏅",
      criteria: b.criteria || "",
      holderCount: b.holderCount,
      pointsReward: b.pointsReward,
    }));

    res.json({ success: true, badges: shaped, latestAward });
  } catch (err) {
    console.error("[community/badges]", err);
    res.status(500).json({ success: false, message: "Failed to load badges" });
  }
};
