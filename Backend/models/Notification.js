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
      enum: [
        "reply",
        "helped",
        "badge",
        "sos",
        "follow",
        "milestone",
        "friend_request",
        "friend_accepted",
      ],
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
