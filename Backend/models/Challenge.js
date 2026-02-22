// models/Challenge.js
const mongoose = require("mongoose");

const challengeSchema = new mongoose.Schema(
  {
    // ================= DISPLAY =================
    icon: {
      type: String,
      default: "🎯",
    },

    // CSS background value for the icon tile, e.g. "rgba(74,140,66,.12)"
    bg: {
      type: String,
      default: "rgba(122,143,82,.12)",
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    // Short subtitle shown under the title in the widget
    meta: {
      type: String,
      default: "",
      maxlength: 200,
    },

    // ================= PARTICIPANTS =================
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ================= LIFECYCLE =================
    endsAt: {
      type: Date,
      default: null, // null = no expiry
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ================= CREATED BY =================
    // null = seeded / platform-generated
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Virtual: participant count ────────────────────────────
challengeSchema.virtual("participantCount").get(function () {
  return this.participants.length;
});

module.exports = mongoose.model("Challenge", challengeSchema);
