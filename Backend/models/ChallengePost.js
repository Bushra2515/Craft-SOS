// Backend/models/ChallengePost.js
// Community feed posts scoped to a single challenge.
// Each post belongs to one challenge, one author, and holds an
// array of reaction sub-docs (emoji + users who reacted).

const mongoose = require("mongoose");

/* ── Reaction sub-doc ────────────────────────────────────── */
const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true, maxlength: 4 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false },
);

/* ── Main schema ─────────────────────────────────────────── */
const challengePostSchema = new mongoose.Schema(
  {
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    // Optional attachment label (filename shown in UI; actual file upload is separate)
    attachLabel: {
      type: String,
      default: null,
      maxlength: 120,
    },
    reactions: { type: [reactionSchema], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

challengePostSchema.index({ challengeId: 1, createdAt: -1 });

module.exports = mongoose.model("ChallengePost", challengePostSchema);
