// // const mongoose = require("mongoose");

// // const friendSchema = new mongoose.Schema(
// //   {
// //     user: {
// //       type: mongoose.Schema.Types.ObjectId,
// //       ref: "User",
// //       required: true,
// //     },
// //     since: {
// //       type: Date,
// //       default: Date.now,
// //     },
// //   },
// //   { _id: false },
// // );

// // const userSchema = new mongoose.Schema(
// //   {
// //     // ================= BASIC INFO =================
// //     name: {
// //       type: String,
// //       required: true,
// //       trim: true,
// //     },

// //     username: {
// //       type: String,
// //       unique: true,
// //       sparse: true,
// //       trim: true,
// //     },

// //     email: {
// //       type: String,
// //       required: true,
// //       unique: true,
// //       lowercase: true,
// //       trim: true,
// //       index: true,
// //     },

// //     password: {
// //       type: String,
// //       required: true,
// //       select: false,
// //     },

// //     bio: {
// //       type: String,
// //       default: "",
// //       maxlength: 300,
// //     },

// //     profileImage: {
// //       type: String,
// //       default: "",
// //     },

// //     location: {
// //       type: String,
// //       default: "",
// //     },

// //     website: {
// //       type: String,
// //       default: "",
// //     },

// //     hobbies: [
// //       {
// //         type: String,
// //         trim: true,
// //       },
// //     ],

// //     // ================= SOCIAL SYSTEM =================
// //     friends: [friendSchema],

// //     friendRequests: [
// //       {
// //         type: mongoose.Schema.Types.ObjectId,
// //         ref: "User",
// //       },
// //     ],

// //     blockedUsers: [
// //       {
// //         type: mongoose.Schema.Types.ObjectId,
// //         ref: "User",
// //       },
// //     ],

// //     // ================= GAMIFICATION =================
// //     points: {
// //       type: Number,
// //       default: 0,
// //     },

// //     level: {
// //       type: Number,
// //       default: 1,
// //     },

// //     badges: [
// //       {
// //         type: String,
// //       },
// //     ],

// //     completedHelpCount: {
// //       type: Number,
// //       default: 0,
// //     },

// //     receivedHelpCount: {
// //       type: Number,
// //       default: 0,
// //     },

// //     rating: {
// //       type: Number,
// //       default: 0,
// //       min: 0,
// //       max: 5,
// //     },

// //     totalRatings: {
// //       type: Number,
// //       default: 0,
// //     },

// //     // ================= NOTIFICATIONS =================
// //     fcmTokens: [
// //       {
// //         type: String,
// //       },
// //     ],

// //     notificationsEnabled: {
// //       type: Boolean,
// //       default: true,
// //     },

// //     // ================= ACCOUNT CONTROL =================
// //     role: {
// //       type: String,
// //       enum: ["user", "admin", "moderator"],
// //       default: "user",
// //     },

// //     isActive: {
// //       type: Boolean,
// //       default: true,
// //     },

// //     isVerified: {
// //       type: Boolean,
// //       default: false,
// //     },

// //     lastLogin: {
// //       type: Date,
// //     },

// //     // ================= SECURITY =================
// //     passwordChangedAt: Date,

// //     resetPasswordToken: String,
// //     resetPasswordExpires: Date,
// //   },
// //   {
// //     timestamps: true,
// //     versionKey: false,
// //     strict: true,
// //   },
// // );

// // module.exports = mongoose.model("User", userSchema);
// // Backend/models/User.js
// const mongoose = require("mongoose");

// // ── Friend sub-document (unchanged) ──────────────────────
// const friendSchema = new mongoose.Schema(
//   {
//     user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
//     since: { type: Date, default: Date.now },
//   },
//   { _id: false },
// );

// // ── Main schema ───────────────────────────────────────────
// const userSchema = new mongoose.Schema(
//   {
//     // ════════════════ BASIC INFO ════════════════
//     firstName: {
//       type: String,
//       required: true,
//       trim: true,
//     },
//     lastName: {
//       type: String,
//       required: true,
//       trim: true,
//     },

//     username: {
//       type: String,
//       unique: true,
//       sparse: true,
//       trim: true,
//     },

//     // // ✅ ADDED: dashboard + auth.js display "@handle" in sidebar/greeting
//     // handle: {
//     //   type: String,
//     //   trim: true,
//     //   default: "",
//     // },
//     // handle: {
//     //   type: String,
//     //   unique: true,
//     //   sparse: true,
//     //   trim: true,
//     // },

//     email: {
//       type: String,
//       required: true,
//       unique: true,
//       lowercase: true,
//       trim: true,
//       index: true,
//     },

//     password: {
//       type: String,
//       required: true,
//       select: false,
//     },

//     businessType: String,
//     skills: [String],
//     experience: Number,
//     location: String,

//     role: {
//       type: String,
//       enum: ["seeker", "helper", "both"],
//       default: "both",
//     },

//     bio: {
//       type: String,
//       default: "",
//       maxlength: 300,
//     },

//     profileImage: {
//       type: String,
//       default: "",
//     },

//     // ✅ ADDED: postController populates "avatar" on author,
//     //           dashboard renders it for feed/SOS cards.
//     //           Set this equal to profileImage in your save hooks if needed.
//     avatar: {
//       type: String,
//       default: "",
//     },

//     location: {
//       type: String,
//       default: "",
//     },

//     website: {
//       type: String,
//       default: "",
//     },

//     hobbies: [{ type: String, trim: true }],

//     // ════════════════ SOCIAL SYSTEM ════════════════
//     friends: [friendSchema],
//     friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
//     blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

//     // ✅ ADDED: dashboardController.toggleFollow uses $addToSet/$pull on these
//     followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
//     following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

//     // ✅ ADDED: getDashboard returns this in the user stats strip
//     friendCount: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },

//     // ════════════════ GAMIFICATION ════════════════
//     points: {
//       type: Number,
//       default: 0,
//     },

//     level: {
//       type: Number,
//       default: 1,
//     },

//     // Stored as plain strings — e.g. "Mentor", "Top Responder"
//     // Dashboard falls back to DEFAULT_BADGES array when this is empty
//     badges: [{ type: String }],

//     completedHelpCount: {
//       type: Number,
//       default: 0,
//     },

//     // ✅ ADDED: alias of completedHelpCount used by getDashboard + getProgress.
//     //           Increment both together, or use a pre-save hook to sync them.
//     helpedCount: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },

//     receivedHelpCount: {
//       type: Number,
//       default: 0,
//     },

//     rating: {
//       type: Number,
//       default: 0,
//       min: 0,
//       max: 5,
//     },

//     totalRatings: {
//       type: Number,
//       default: 0,
//     },

//     // ✅ ADDED: getProgress returns this for the streak widget
//     streakDays: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },

//     // ════════════════ NOTIFICATIONS ════════════════
//     fcmTokens: [{ type: String }],
//     notificationsEnabled: { type: Boolean, default: true },

//     // ════════════════ ACCOUNT CONTROL ════════════════
//     role: {
//       type: String,
//       // "user" is the default member role.
//       // authController checks role === "admin" for the Admin tab — still works.
//       enum: ["user", "admin", "moderator"],
//       default: "user",
//     },

//     isActive: { type: Boolean, default: true },
//     isVerified: { type: Boolean, default: false },
//     lastLogin: { type: Date },

//     // ════════════════ SECURITY ════════════════
//     passwordChangedAt: Date,

//     // ⚠️  NOTE: authController currently uses resetToken / resetExpires (shorter names).
//     //     These are the correct full names — update authController to match:
//     //       user.resetPasswordToken   = token;
//     //       user.resetPasswordExpires = Date.now() + 3600000;
//     resetPasswordToken: String,
//     resetPasswordExpires: Date,
//   },
//   {
//     timestamps: true,
//     versionKey: false,
//     strict: true,
//   },
// );

// // ── Keep helpedCount in sync with completedHelpCount ─────
// // If you increment completedHelpCount directly, this hook
// // ensures helpedCount (used by dashboard) always matches.
// userSchema.pre("save", function (next) {
//   if (this.isModified("completedHelpCount")) {
//     this.helpedCount = this.completedHelpCount;
//   }
//   // Sync avatar → profileImage so both fields always match
//   if (this.isModified("profileImage") && !this.isModified("avatar")) {
//     this.avatar = this.profileImage;
//   }
//   next();
// });

// module.exports = mongoose.model("User", userSchema);
// Backend/models/User.js
const mongoose = require("mongoose");

// ── Friend sub-document ───────────────────────────────────
const friendSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    since: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    // ════════════════ BASIC INFO ════════════════
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },

    // Virtual full name (used by loginUser response + dashboard greeting)
    // Accessed as user.fullName — no DB column needed

    username: {
      type: String,
      unique: true,
      sparse: true, // allows null without violating unique
      trim: true,
    },

    // ✅ handle = "@username" alias displayed in sidebar/cards
    //    Auto-generated from username in authController.registerUser
    handle: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    bio: { type: String, default: "", maxlength: 300 },

    profileImage: { type: String, default: "" },

    // ✅ avatar — same image, used by postController populate + dashboard cards
    avatar: { type: String, default: "" },

    // ✅ location — single definition (was duplicated before, caused strict-mode error)
    location: { type: String, default: "" },

    website: { type: String, default: "" },
    hobbies: [{ type: String, trim: true }],

    // ════════════════ CRAFT PROFILE (from register Step 2) ════════════════
    // business type selected on the type-grid cards
    businessType: {
      type: String,
      enum: [
        "sole-maker",
        "small-studio",
        "supplier",
        "aspiring",
        "just-crafter",
        null,
      ],
      default: null,
    },

    skills: [{ type: String, trim: true }], // skill pills selected in Step 2

    experience: { type: Number, default: 0 }, // range slider 0-10

    // ════════════════ COMMUNITY ROLE (from register Step 3) ════════════════
    // ✅ communityRole — was stored as "role" before, which CONFLICTED
    //    with the account role field below. Renamed to avoid Mongoose
    //    silently dropping whichever definition came first.
    communityRole: {
      type: String,
      enum: ["seeker", "helper", "both"],
      default: "both",
    },

    // ════════════════ ACCOUNT ROLE (for auth/admin) ════════════════
    // Separate from communityRole — adminController checks this field
    role: {
      type: String,
      enum: ["user", "admin", "moderator"],
      default: "user",
    },

    // ════════════════ SOCIAL SYSTEM ════════════════
    friends: [friendSchema],
    friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    friendCount: { type: Number, default: 0, min: 0 },

    // ════════════════ GAMIFICATION ════════════════
    points: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    badges: [{ type: String }],
    completedHelpCount: { type: Number, default: 0 },
    helpedCount: { type: Number, default: 0, min: 0 },
    receivedHelpCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0, min: 0 },

    // ════════════════ NOTIFICATIONS ════════════════
    fcmTokens: [{ type: String }],
    notificationsEnabled: { type: Boolean, default: true },

    // ════════════════ ACCOUNT CONTROL ════════════════
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    lastLogin: { type: Date },

    // ════════════════ SECURITY ════════════════
    passwordChangedAt: { type: Date },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  },
);

// ── Virtual: fullName ─────────────────────────────────────
// Access as user.fullName — not stored in DB
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

// ── Pre-save hooks ────────────────────────────────────────
// userSchema.pre("save", function (next) {
//   // Keep helpedCount in sync with completedHelpCount
//   if (this.isModified("completedHelpCount")) {
//     this.helpedCount = this.completedHelpCount;
//   }
//   // Keep avatar in sync with profileImage
//   if (this.isModified("profileImage") && !this.isModified("avatar")) {
//     this.avatar = this.profileImage;
//   }
//   next();
// });
// ── Pre-save hooks ────────────────────────────────────────
// ✅ async pre-save — NO next() call. Mongoose resolves when the Promise returns.
//    Mixing async + next() causes "next is not a function" crash.
userSchema.pre("save", async function () {
  // Keep helpedCount in sync with completedHelpCount
  if (this.isModified("completedHelpCount")) {
    this.helpedCount = this.completedHelpCount;
  }
  // Keep avatar in sync with profileImage
  if (this.isModified("profileImage") && !this.isModified("avatar")) {
    this.avatar = this.profileImage;
  }
});

module.exports = mongoose.model("User", userSchema);
