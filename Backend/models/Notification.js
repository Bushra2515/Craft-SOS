// // models/Notification.js
// const mongoose = require("mongoose");

// const notificationSchema = new mongoose.Schema(
//   {
//     // ================= WHO RECEIVES IT =================
//     recipient: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//       index: true,
//     },

//     // ================= WHO TRIGGERED IT =================
//     // null for system / platform notifications
//     sender: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       default: null,
//     },

//     // ================= TYPE =================
//     // reply      → someone replied to your post
//     // helped     → your answer was marked helpful / SOS resolved
//     // badge      → you earned a badge
//     // sos        → new SOS matching your skills / hobbies
//     // follow     → friend request sent or accepted
//     // milestone  → views / points milestone hit
//     // system     → generic platform announcement
//     type: {
//       type: String,
//       enum: [
//         "reply",
//         "helped",
//         "badge",
//         "sos",
//         "follow",
//         "milestone",
//         "system",
//       ],
//       required: true,
//     },

//     // ================= MESSAGE =================
//     // May contain safe HTML like <strong> for bold names
//     text: {
//       type: String,
//       required: true,
//       maxlength: 500,
//     },

//     // ================= RELATED POST =================
//     // Optional — links the notification to a specific post
//     relatedPost: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Post",
//       default: null,
//     },

//     // ================= READ STATE =================
//     read: {
//       type: Boolean,
//       default: false,
//       index: true,
//     },
//   },
//   {
//     timestamps: true, // createdAt used for ordering + TTL
//     versionKey: false,
//   },
// );

// // ── Compound index: fast unread fetch for a user ─────────
// notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// // ── TTL index: auto-delete notifications after 90 days ───
// notificationSchema.index(
//   { createdAt: 1 },
//   { expireAfterSeconds: 60 * 60 * 24 * 90 },
// );

// module.exports = mongoose.model("Notification", notificationSchema);
// Backend/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Who triggered it (null for system notifications)
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // reply | helped | badge | sos | follow | milestone
    type: {
      type: String,
      enum: ["reply", "helped", "badge", "sos", "follow", "milestone"],
      required: true,
    },

    // The post or challenge this relates to (optional)
    refPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    // Human-readable message (pre-rendered on server)
    message: {
      type: String,
      required: true,
      maxlength: 500,
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

// Compound index — fast unread count per user
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
