const mongoose = require("mongoose");

const adminLogSchema = new mongoose.Schema(
  {
    admin: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, default: "" },
    targetId: { type: String, default: "" },
    detail: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false },
);

// Auto-expire after 180 days
adminLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 },
);

module.exports = mongoose.model("AdminLog", adminLogSchema);
