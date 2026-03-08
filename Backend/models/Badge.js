const mongoose = require("mongoose");

const badgeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    emoji: { type: String, default: "🏅" },
    criteria: { type: String, default: "" },
    trigger: { type: String, enum: ["auto", "manual"], default: "auto" },
    pointsReward: { type: Number, default: 0 },
    holderCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    awards: [
      {
        userHandle: { type: String },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        awardedBy: { type: String },
        awardedAt: { type: Date, default: Date.now },
        reason: { type: String },
      },
    ],
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Badge", badgeSchema);
