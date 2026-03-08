// Backend/models/User.js
// ─────────────────────────────────────────────────────────────────────────────
// Central user schema. Every profile field lives here.
//
// Fields added in this version:
//   bannerImg      — uploaded banner image URL (complements bannerColor)
//   etsy           — Etsy shop name
//   ravelry        — Ravelry handle
//   pinterest      — Pinterest handle
//   communityRole  — "seeker" | "helper" | "both"
//   experience     — years of craft experience (0–20)
//   notifPreferences — full notification toggles object
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ── Notification preferences subdoc ─────────────────────────────────────────
const notifPrefSchema = new mongoose.Schema(
  {
    push: { type: Boolean, default: true },
    newResponses: { type: Boolean, default: true },
    friendRequests: { type: Boolean, default: true },
    communityHighlights: { type: Boolean, default: false },
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true },
  },
  { _id: false },
);

// ── Main user schema ─────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    name: { type: String, trim: true }, // derived, stored for search
    handle: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9_]{3,30}$/,
        "Handle: 3-30 chars, letters/numbers/underscore only",
      ],
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: { type: String, required: true, select: false, minlength: 8 },
    role: {
      type: String,
      enum: ["user", "admin", "moderator"],
      default: "user",
    },

    // ── Profile visuals ─────────────────────────────────────
    avatar: { type: String, default: "" }, // image URL
    bannerImg: { type: String, default: "" }, // banner image URL (NEW)
    bannerColor: { type: String, default: "#7a8f52" }, // fallback CSS colour

    // ── Bio & location ──────────────────────────────────────
    bio: { type: String, default: "", trim: true, maxlength: 500 },
    location: { type: String, default: "", trim: true, maxlength: 100 },

    // ── Extended details ────────────────────────────────────
    website: { type: String, default: "", trim: true, maxlength: 200 },
    businessType: { type: String, default: "", trim: true, maxlength: 100 },
    contact: { type: String, default: "", trim: true, maxlength: 200 },

    // ── Social handles ──────────────────────────────────────
    instagram: { type: String, default: "", trim: true, maxlength: 100 },
    etsy: { type: String, default: "", trim: true, maxlength: 100 }, // NEW
    ravelry: { type: String, default: "", trim: true, maxlength: 100 }, // NEW
    pinterest: { type: String, default: "", trim: true, maxlength: 100 }, // NEW

    // ── Craft profile ───────────────────────────────────────
    skills: [{ type: String, trim: true }],
    hobbies: [{ type: String, trim: true }],
    communityRole: {
      type: String,
      enum: ["seeker", "helper", "both"],
      default: "both",
    }, // NEW
    experience: { type: Number, default: 0, min: 0, max: 20 }, // NEW

    // ── Community ───────────────────────────────────────────
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // Incoming friend request sender IDs — sender → recipient
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    points: { type: Number, default: 0, min: 0 },
    helpedCount: { type: Number, default: 0, min: 0 },
    resolvedCount: { type: Number, default: 0, min: 0 },
    streakDays: { type: Number, default: 0, min: 0 },
    badges: [{ type: String }],

    // ── Auth / account ──────────────────────────────────────
    isActive: { type: Boolean, default: true, index: true },
    isEmailVerified: { type: Boolean, default: false },
    newsletterOptIn: { type: Boolean, default: false },
    notifPreferences: { type: notifPrefSchema, default: () => ({}) },

    // ── Misc ────────────────────────────────────────────────
    lastSeen: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Pre-save hooks ───────────────────────────────────────────────────────────
userSchema.pre("save", async function () {
  // Derive full name whenever first/last changes
  if (this.isModified("firstName") || this.isModified("lastName")) {
    this.name = `${this.firstName} ${this.lastName}`.trim();
  }
  // Hash password only when it changes
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// ── Instance methods ─────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.getRank = function () {
  const p = this.points;
  if (p >= 2000) return "🏆 Master";
  if (p >= 1500) return "🌿 Sage";
  if (p >= 800) return "⭐ Responder";
  if (p >= 300) return "🌱 Member";
  return "🌱 New";
};

module.exports = mongoose.model("User", userSchema);
