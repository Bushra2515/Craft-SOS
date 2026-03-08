// // models/Post.js
// const mongoose = require("mongoose");

// // ── Embedded reply schema ─────────────────────────────────
// const replySchema = new mongoose.Schema(
//   {
//     author: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     body: {
//       type: String,
//       required: true,
//       maxlength: 5000,
//       trim: true,
//     },
//     isHelpful: {
//       type: Boolean,
//       default: false,
//     },
//   },
//   {
//     timestamps: true,
//     _id: true,
//   },
// );

// // ── Main post schema ──────────────────────────────────────
// const postSchema = new mongoose.Schema(
//   {
//     author: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//       index: true,
//     },

//     type: {
//       type: String,
//       enum: ["sos", "tut", "com", "res"],
//       required: true,
//       index: true,
//     },

//     title: {
//       type: String,
//       required: true,
//       trim: true,
//       maxlength: 200,
//     },

//     body: {
//       type: String,
//       required: true,
//       trim: true,
//       maxlength: 10000,
//     },

//     tags: [{ type: String, trim: true }],

//     status: {
//       type: String,
//       enum: ["active", "resolved", "closed"],
//       default: "active",
//       index: true,
//     },

//     resolvedAt: { type: Date, default: null },
//     resolvedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       default: null,
//     },

//     views: { type: Number, default: 0, min: 0 },
//     replyCount: { type: Number, default: 0, min: 0 },

//     saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

//     replies: [replySchema],
//   },
//   {
//     timestamps: true,
//     versionKey: false,
//   },
// );

// // ── Indexes ───────────────────────────────────────────────
// postSchema.index({ author: 1, createdAt: -1 });
// postSchema.index({ type: 1, status: 1, createdAt: -1 });
// postSchema.index({ saves: 1 });
// postSchema.index({ tags: 1 });

// // ── Virtual ───────────────────────────────────────────────
// postSchema.virtual("saveCount").get(function () {
//   return this.saves.length;
// });

// // ── toPublic ──────────────────────────────────────────────
// postSchema.methods.toPublic = function (currentUserId) {
//   // ✅ Uses `this` (the Mongoose document) — no `doc` variable needed.
//   //    Null-guards every saves entry so deleted-user ObjectIds don't crash.
//   const isSaved = Array.isArray(this.saves)
//     ? this.saves.some(
//         (id) =>
//           id != null &&
//           currentUserId != null &&
//           id.toString() === currentUserId.toString(),
//       )
//     : false;

//   return {
//     id: this._id,
//     type: this.type,
//     status: this.status,
//     title: this.title,
//     body: this.body,
//     tags: this.tags,
//     views: this.views,
//     replyCount: this.replyCount,
//     saveCount: this.saves.length,
//     isSaved,
//     author: this.author, // populated object or raw ObjectId
//     replies: this.replies,
//     resolvedAt: this.resolvedAt,
//     createdAt: this.createdAt,
//   };
// };

// module.exports = mongoose.model("Post", postSchema);

// Backend/models/Post.js
const mongoose = require("mongoose");

// ── Reply subdoc ──────────────────────────────────────────
const replySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: { type: String, required: true, maxlength: 5000, trim: true },
    isHelpful: { type: Boolean, default: false },
    // helpfulVotes: array of userIds who marked this reply helpful
    helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true, _id: true },
);

// ── Reaction subdoc ───────────────────────────────────────
// One reaction document per emoji type, embedded in the post.
// users[] stores who has reacted so we can toggle correctly.
const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true }, // "🔥"
    label: { type: String, required: true }, // "Insightful"
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: false },
);

// ── Resource subdoc ───────────────────────────────────────
// Free downloads / attachments attached to a tutorial post.
const resourceSchema = new mongoose.Schema(
  {
    emoji: { type: String, default: "📄" },
    title: { type: String, required: true, trim: true },
    type: { type: String, trim: true }, // "Google Sheets · Free copy"
    url: { type: String, default: "" }, // download URL
  },
  { _id: true },
);

// ── Main post schema ──────────────────────────────────────
const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["sos", "tut", "com", "res"],
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 10000 },
    tags: [{ type: String, trim: true }],

    status: {
      type: String,
      enum: ["active", "resolved", "closed"],
      default: "active",
      index: true,
    },

    resolvedAt: { type: Date, default: null },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    views: { type: Number, default: 0, min: 0 },
    replyCount: { type: Number, default: 0, min: 0 },

    saves: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    replies: [replySchema],
    reactions: [reactionSchema],
    resources: [resourceSchema],
  },
  { timestamps: true, versionKey: false },
);

// ── Indexes ───────────────────────────────────────────────
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ type: 1, status: 1, createdAt: -1 });
postSchema.index({ saves: 1 });
postSchema.index({ tags: 1 });

// ── Virtual ───────────────────────────────────────────────
postSchema.virtual("saveCount").get(function () {
  return this.saves.length;
});

// ── toPublic ──────────────────────────────────────────────
postSchema.methods.toPublic = function (currentUserId) {
  const isSaved = Array.isArray(this.saves)
    ? this.saves.some(
        (id) =>
          id != null &&
          currentUserId != null &&
          id.toString() === currentUserId.toString(),
      )
    : false;

  return {
    id: this._id,
    type: this.type,
    status: this.status,
    title: this.title,
    body: this.body,
    tags: this.tags,
    views: this.views,
    replyCount: this.replyCount,
    saveCount: this.saves.length,
    isSaved,
    reactions: (this.reactions || []).map((r) => ({
      emoji: r.emoji,
      label: r.label,
      count: r.users.length,
      reacted:
        Array.isArray(r.users) && currentUserId
          ? r.users.some((id) => id?.toString() === currentUserId.toString())
          : false,
    })),
    resources: this.resources || [],
    author: this.author,
    replies: this.replies,
    resolvedAt: this.resolvedAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("Post", postSchema);
