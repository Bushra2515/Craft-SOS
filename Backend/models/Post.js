// models/Post.js
const mongoose = require("mongoose");

// ── Embedded reply schema ─────────────────────────────────
const replySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: {
      type: String,
      required: true,
      maxlength: 5000,
      trim: true,
    },
    isHelpful: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    _id: true,
  },
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

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000,
    },

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
  },
  {
    timestamps: true,
    versionKey: false,
  },
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
  // ✅ Uses `this` (the Mongoose document) — no `doc` variable needed.
  //    Null-guards every saves entry so deleted-user ObjectIds don't crash.
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
    author: this.author, // populated object or raw ObjectId
    replies: this.replies,
    resolvedAt: this.resolvedAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("Post", postSchema);
