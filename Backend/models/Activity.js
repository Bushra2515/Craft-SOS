// Backend/models/Activity.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Stores a lightweight activity log for each user.
//   Every meaningful action (helped someone, earned a badge, posted, replied)
//   creates one Activity document. The profile page timeline reads the 20
//   most recent ones for the current user.
//
//   Rather than deriving the timeline from multiple collections at query time
//   (expensive joins), we write a small record here whenever the action happens.
//   The profileController also has a fallback: if no Activity docs exist yet,
//   it derives a basic feed from recent posts.
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Human-readable type used for the emoji + copy in the timeline
    type: {
      type: String,
      enum: [
        "helped", // helped another user resolve a post
        "posted", // created a new post
        "replied", // left a reply on a post
        "badge_earned", // earned an achievement badge
        "rank_up", // reached a new rank
        "tutorial", // shared a tutorial post
        "resolved", // marked own post as resolved
        "friend_added", // added a new friend
      ],
      required: true,
    },

    // Display text — supports HTML for <strong> links
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    // Optional link target (post ID, badge name, etc.)
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    refModel: {
      type: String,
      enum: ["Post", "User", null],
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Index: latest activities per user ─────────────────────
activitySchema.index({ user: 1, createdAt: -1 });

// ── Static helper used by other controllers ───────────────
// Call Activity.log(userId, type, text, refId?, refModel?) anywhere
activitySchema.statics.log = async function (
  userId,
  type,
  text,
  refId = null,
  refModel = null,
) {
  try {
    await this.create({ user: userId, type, text, refId, refModel });
  } catch (err) {
    // Never let activity logging crash the main action
    console.error("[Activity.log]", err.message);
  }
};

module.exports = mongoose.model("Activity", activitySchema);
