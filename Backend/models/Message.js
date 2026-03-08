// Backend/models/Message.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Stores private chat messages between two users.
//   Every document belongs to exactly one conversation (identified by roomId).
//
//   roomId convention (enforced by helper):
//     [userId1, userId2].sort().join("_")
//     → same room regardless of who initiates
//
//   Friend gating is enforced at the Socket layer (socketManager.js), not here.
//   This model is only written to after the gate passes.
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true, // fast room history queries
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    // Optional image attachment URL (from /api/upload/post-image)
    imageUrl: {
      type: String,
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Compound index — fast unread count per recipient per room
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, isRead: 1 });

// ── Static: derive roomId from two user IDs ───────────────
messageSchema.statics.roomId = function (idA, idB) {
  return [String(idA), String(idB)].sort().join("_");
};

module.exports = mongoose.model("Message", messageSchema);
