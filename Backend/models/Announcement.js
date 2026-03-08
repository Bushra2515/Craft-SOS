const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    audience: {
      type: String,
      enum: [
        "all",
        "crochet",
        "baking",
        "resin",
        "new_members",
        "moderators",
        "verified_sellers",
      ],
      default: "all",
    },
    type: {
      type: String,
      enum: [
        "announcement",
        "challenge",
        "spotlight",
        "notification",
        "feature_update",
        "safety_notice",
      ],
      default: "announcement",
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "sent"],
      default: "draft",
    },
    scheduledAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    seenCount: { type: Number, default: 0 },
    createdBy: { type: String },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Announcement", announcementSchema);
