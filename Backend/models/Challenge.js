// // // models/Challenge.js
// // const mongoose = require("mongoose");

// // const challengeSchema = new mongoose.Schema(
// //   {
// //     // ================= DISPLAY =================
// //     icon: {
// //       type: String,
// //       default: "🎯",
// //     },

// //     // CSS background value for the icon tile, e.g. "rgba(74,140,66,.12)"
// //     bg: {
// //       type: String,
// //       default: "rgba(122,143,82,.12)",
// //     },

// //     title: {
// //       type: String,
// //       required: true,
// //       trim: true,
// //       maxlength: 150,
// //     },

// //     // Short subtitle shown under the title in the widget
// //     meta: {
// //       type: String,
// //       default: "",
// //       maxlength: 200,
// //     },

// //     // ================= PARTICIPANTS =================
// //     participants: [
// //       {
// //         type: mongoose.Schema.Types.ObjectId,
// //         ref: "User",
// //       },
// //     ],

// //     // ================= LIFECYCLE =================
// //     endsAt: {
// //       type: Date,
// //       default: null, // null = no expiry
// //     },

// //     isActive: {
// //       type: Boolean,
// //       default: true,
// //       index: true,
// //     },

// //     // ================= CREATED BY =================
// //     // null = seeded / platform-generated
// //     createdBy: {
// //       type: mongoose.Schema.Types.ObjectId,
// //       ref: "User",
// //       default: null,
// //     },
// //   },
// //   {
// //     timestamps: true,
// //     versionKey: false,
// //   },
// // );

// // // ── Virtual: participant count ────────────────────────────
// // challengeSchema.virtual("participantCount").get(function () {
// //   return this.participants.length;
// // });

// // module.exports = mongoose.model("Challenge", challengeSchema);
// // Backend/models/Challenge.js
// // Full challenge model — supports rich UI: difficulty, rewards, niche,
// // cover gradient, status lifecycle, per-user progress tracking.

// const mongoose = require("mongoose");

// /* ── Reward sub-document ─────────────────────────────────── */
// const rewardSchema = new mongoose.Schema(
//   {
//     type: {
//       type: String,
//       enum: ["pts", "badge", "cert", "top"],
//       required: true,
//     },
//     label: { type: String, required: true, maxlength: 80 },
//     icon: { type: String, default: "" }, // emoji icon for reward card
//     sub: { type: String, default: "" }, // subtitle e.g. "Exclusive badge"
//     topOnly: { type: Boolean, default: false }, // locked unless top-3
//   },
//   { _id: false },
// );

// /* ── Per-user progress sub-document ─────────────────────── */
// const progressSchema = new mongoose.Schema(
//   {
//     userId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     progress: { type: Number, default: 0, min: 0, max: 100 }, // 0–100 %
//     progressLabel: { type: String, default: "" }, // "8 / 20 tasks done"
//     completedAt: { type: Date, default: null },
//     rank: { type: Number, default: null },
//     ptsEarned: { type: Number, default: 0 },
//   },
//   { _id: false },
// );

// /* ── Main schema ─────────────────────────────────────────── */
// const challengeSchema = new mongoose.Schema(
//   {
//     // ── Display ──────────────────────────────────────────
//     emoji: { type: String, default: "🎯" },
//     coverBg: {
//       type: String,
//       default: "linear-gradient(135deg,#7a8f52 0%,#3d5a20 100%)",
//     },
//     niche: { type: String, default: "Community", maxlength: 60 },
//     title: { type: String, required: true, trim: true, maxlength: 150 },
//     description: { type: String, default: "", maxlength: 800 },

//     // ── Classification ───────────────────────────────────
//     difficulty: {
//       type: String,
//       enum: ["easy", "medium", "hard"],
//       default: "medium",
//     },

//     // ── Status ───────────────────────────────────────────
//     // "upcoming" → not yet started; "active" → in progress; "completed" → ended
//     status: {
//       type: String,
//       enum: ["upcoming", "active", "completed"],
//       default: "upcoming",
//       index: true,
//     },
//     featured: { type: Boolean, default: false },

//     // ── Rewards ──────────────────────────────────────────
//     rewards: { type: [rewardSchema], default: [] },
//     pointsReward: { type: Number, default: 0, min: 0 }, // convenience mirror of pts reward

//     // ── Timing ───────────────────────────────────────────
//     startsAt: { type: Date, default: null },
//     endsAt: { type: Date, default: null },

//     // ── Participants ─────────────────────────────────────
//     participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

//     // ── Per-user progress ─────────────────────────────────
//     userProgress: { type: [progressSchema], default: [] },

//     // ── Meta ─────────────────────────────────────────────
//     isActive: { type: Boolean, default: true, index: true },
//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       default: null,
//     },
//   },
//   { timestamps: true, versionKey: false },
// );

// /* ── Virtuals ────────────────────────────────────────────── */
// challengeSchema.virtual("participantCount").get(function () {
//   return this.participants.length;
// });

// /* ── Index for common queries ────────────────────────────── */
// challengeSchema.index({ status: 1, isActive: 1, createdAt: -1 });

// module.exports = mongoose.model("Challenge", challengeSchema);
// Backend/models/Challenge.js
const mongoose = require("mongoose");

/* ── Reward sub-doc ──────────────────────────────────────── */
const rewardSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["pts", "badge", "cert", "top", "sponsor"],
      required: true,
    },
    label: { type: String, required: true, maxlength: 80 },
    icon: { type: String, default: "" }, // emoji icon for reward card
    sub: { type: String, default: "" }, // subtitle e.g. "Exclusive badge"
    topOnly: { type: Boolean, default: false }, // locked unless top-3
  },
  { _id: false },
);

/* ── Task sub-doc ────────────────────────────────────────── */
const taskSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    title: { type: String, required: true, maxlength: 150 },
    description: { type: String, default: "", maxlength: 400 },
    dueLabel: { type: String, default: "" }, // "Due Mar 22"
    tagCls: { type: String, default: "" }, // "tag-pts" | "tag-badge" | "tag-req" | "tag-final"
    tagText: { type: String, default: "" }, // "+100 pts" | "Key milestone" | "Required"
  },
  { _id: true },
);

/* ── Rule sub-doc ────────────────────────────────────────── */
const ruleSchema = new mongoose.Schema(
  { order: Number, text: String },
  { _id: false },
);

/* ── Per-user progress sub-doc ───────────────────────────── */
const progressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    progressLabel: { type: String, default: "" },
    completedTasks: [{ type: mongoose.Schema.Types.ObjectId }], // task _ids completed
    completedAt: { type: Date, default: null },
    rank: { type: Number, default: null },
    ptsEarned: { type: Number, default: 0 },
    bookmarked: { type: Boolean, default: false },
  },
  { _id: false },
);

/* ── Main schema ─────────────────────────────────────────── */
const challengeSchema = new mongoose.Schema(
  {
    emoji: { type: String, default: "🎯" },
    coverBg: {
      type: String,
      default: "linear-gradient(135deg,#7a8f52 0%,#3d5a20 100%)",
    },
    niche: { type: String, default: "Community", maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: "", maxlength: 800 },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["upcoming", "active", "completed"],
      default: "upcoming",
      index: true,
    },
    featured: { type: Boolean, default: false },

    rewards: { type: [rewardSchema], default: [] },
    pointsReward: { type: Number, default: 0, min: 0 },

    tasks: { type: [taskSchema], default: [] },
    rules: { type: [ruleSchema], default: [] },

    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },

    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    userProgress: { type: [progressSchema], default: [] },

    isActive: { type: Boolean, default: true, index: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

challengeSchema.virtual("participantCount").get(function () {
  return this.participants.length;
});
challengeSchema.index({ status: 1, isActive: 1, createdAt: -1 });

module.exports = mongoose.model("Challenge", challengeSchema);
