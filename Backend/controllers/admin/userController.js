// // All admin user-management actions.
// // REAL FIELD MAP (User.js final):
// //   identity   → handle (unique), firstName, lastName, name, email
// //   account    → role("user"|"admin"|"moderator"), isActive(bool), isEmailVerified(bool)
// //   profile    → avatar, bio, location, skills[], communityRole
// //   community  → points, helpedCount, resolvedCount, streakDays, badges(String[])
// //
// // NOTE: No "status" enum in real schema.
// //   "Active"    = isActive:true  && isEmailVerified:true
// //   "Pending"   = isActive:true  && isEmailVerified:false
// //   "Suspended" = isActive:false  (ban also sets isActive:false, differ only in log)
// const User = require("../../models/User");
// const AdminLog = require("../../models/AdminLog");

// const log = (admin, action, targetId, detail) =>
//   AdminLog.create({
//     admin,
//     action,
//     targetType: "user",
//     targetId: String(targetId),
//     detail,
//   }).catch((e) => console.error("[AdminLog]", e.message));

// // GET /api/admin/users
// const getUsers = async (req, res, next) => {
//   try {
//     const {
//       search,
//       role,
//       isActive,
//       isEmailVerified,
//       page = 1,
//       limit = 20,
//     } = req.query;
//     const filter = {};
//     if (role) filter.role = role;
//     if (isActive != null) filter.isActive = isActive === "true";
//     if (isEmailVerified != null)
//       filter.isEmailVerified = isEmailVerified === "true";
//     if (search) {
//       filter.$or = [
//         { handle: { $regex: search, $options: "i" } },
//         { firstName: { $regex: search, $options: "i" } },
//         { lastName: { $regex: search, $options: "i" } },
//         { email: { $regex: search, $options: "i" } },
//       ];
//     }

//     const [users, total] = await Promise.all([
//       User.find(filter)
//         .sort({ createdAt: -1 })
//         .skip((page - 1) * limit)
//         .limit(Number(limit))
//         .select("-password -resetPasswordToken -resetPasswordExpires"),
//       User.countDocuments(filter),
//     ]);

//     res.json({
//       success: true,
//       users,
//       total,
//       page: Number(page),
//       pages: Math.ceil(total / limit),
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// // GET /api/admin/users/verification-queue  (must be before /:id)
// const getVerificationQueue = async (req, res, next) => {
//   try {
//     const queue = await User.find({ isEmailVerified: false, isActive: true })
//       .sort({ createdAt: 1 })
//       .select(
//         "handle firstName lastName avatar skills communityRole location createdAt",
//       );
//     res.json({ success: true, queue, total: queue.length });
//   } catch (err) {
//     next(err);
//   }
// };

// // GET /api/admin/users/top-helpers
// const getTopHelpers = async (req, res, next) => {
//   try {
//     const helpers = await User.find({ isActive: true })
//       .sort({ helpedCount: -1 })
//       .limit(10)
//       .select(
//         "handle firstName lastName avatar points helpedCount resolvedCount streakDays badges",
//       );
//     res.json({ success: true, helpers });
//   } catch (err) {
//     next(err);
//   }
// };

// // GET /api/admin/users/:id
// const getUserById = async (req, res, next) => {
//   try {
//     const user = await User.findById(req.params.id).select(
//       "-password -resetPasswordToken -resetPasswordExpires",
//     );
//     if (!user)
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     res.json({ success: true, user });
//   } catch (err) {
//     next(err);
//   }
// };

// // PATCH /api/admin/users/:id/verify
// const verifyUser = async (req, res, next) => {
//   try {
//     const user = await User.findByIdAndUpdate(
//       req.params.id,
//       { isEmailVerified: true, isActive: true },
//       { new: true, select: "handle firstName isEmailVerified" },
//     );
//     if (!user)
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     await log(req.admin.handle, "verify", user._id, `Verified @${user.handle}`);
//     res.json({
//       success: true,
//       message: `@${user.handle} verified successfully`,
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// // PATCH /api/admin/users/:id/suspend
// const suspendUser = async (req, res, next) => {
//   try {
//     const { reason = "" } = req.body;
//     const user = await User.findByIdAndUpdate(
//       req.params.id,
//       { isActive: false },
//       { new: true, select: "handle" },
//     );
//     if (!user)
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     await log(
//       req.admin.handle,
//       "suspend",
//       user._id,
//       `Suspended @${user.handle}. Reason: ${reason}`,
//     );
//     res.json({ success: true, message: `@${user.handle} suspended` });
//   } catch (err) {
//     next(err);
//   }
// };

// // PATCH /api/admin/users/:id/ban   (requireRole("admin") enforced in route)
// const banUser = async (req, res, next) => {
//   try {
//     const { reason = "" } = req.body;
//     const user = await User.findByIdAndUpdate(
//       req.params.id,
//       { isActive: false },
//       { new: true, select: "handle" },
//     );
//     if (!user)
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     await log(
//       req.admin.handle,
//       "ban",
//       user._id,
//       `Banned @${user.handle}. Reason: ${reason}`,
//     );
//     res.json({ success: true, message: `@${user.handle} banned` });
//   } catch (err) {
//     next(err);
//   }
// };

// // PATCH /api/admin/users/:id/reinstate
// const reinstateUser = async (req, res, next) => {
//   try {
//     const user = await User.findByIdAndUpdate(
//       req.params.id,
//       { isActive: true },
//       { new: true, select: "handle" },
//     );
//     if (!user)
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     await log(
//       req.admin.handle,
//       "reinstate",
//       user._id,
//       `Reinstated @${user.handle}`,
//     );
//     res.json({ success: true, message: `@${user.handle} reinstated` });
//   } catch (err) {
//     next(err);
//   }
// };

// // PATCH /api/admin/users/:id/promote  (requireRole("admin") enforced in route)
// const promoteUser = async (req, res, next) => {
//   try {
//     const { role } = req.body;
//     if (!["user", "moderator", "admin"].includes(role)) {
//       return res.status(400).json({ success: false, message: "Invalid role" });
//     }
//     const user = await User.findByIdAndUpdate(
//       req.params.id,
//       { role },
//       { new: true, select: "handle role" },
//     );
//     if (!user)
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     await log(
//       req.admin.handle,
//       "promote",
//       user._id,
//       `@${user.handle} → ${role}`,
//     );
//     res.json({ success: true, message: `@${user.handle} is now ${role}` });
//   } catch (err) {
//     next(err);
//   }
// };

// // PATCH /api/admin/users/:id/reject-verification
// const rejectVerification = async (req, res, next) => {
//   try {
//     const { note = "" } = req.body;
//     const user = await User.findByIdAndUpdate(
//       req.params.id,
//       { isActive: false },
//       { new: true, select: "handle" },
//     );
//     if (!user)
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found" });
//     await log(
//       req.admin.handle,
//       "reject_verification",
//       user._id,
//       `Rejected verification for @${user.handle}. Note: ${note}`,
//     );
//     res.json({
//       success: true,
//       message: `Verification rejected for @${user.handle}`,
//     });
//   } catch (err) {
//     next(err);
//   }
// };

// module.exports = {
//   getUsers,
//   getUserById,
//   getVerificationQueue,
//   getTopHelpers,
//   verifyUser,
//   suspendUser,
//   banUser,
//   reinstateUser,
//   promoteUser,
//   rejectVerification,
// };
// Backend/controllers/admin/userController.js
// ─────────────────────────────────────────────────────────────────────────────
// All admin user-management actions.
//
// REAL FIELD MAP (User.js):
//   identity   → handle, firstName, lastName, name, email
//   account    → role ("user"|"admin"|"moderator"), isActive (bool), isEmailVerified (bool)
//   community  → points, helpedCount, resolvedCount, streakDays, badges (String[])
//
// MIGRATION NOTE:
//   Old documents may NOT have isActive / isEmailVerified fields at all.
//   We treat missing isActive as `true` (active) throughout.
//
// STATUS DERIVATION (no status enum in real schema):
//   active    = isActive !== false  &&  isEmailVerified === true
//   pending   = isActive !== false  &&  isEmailVerified !== true
//   suspended = isActive === false
// ─────────────────────────────────────────────────────────────────────────────
const User = require("../../models/User");
const AdminLog = require("../../models/AdminLog");

/* ── Audit log helper (never throws) ─────────────────────── */
const log = (admin, action, targetId, detail) =>
  AdminLog.create({
    admin,
    action,
    targetType: "user",
    targetId: String(targetId),
    detail,
  }).catch((e) => console.error("[AdminLog]", e.message));

/* ── Migration-safe "active user" filter ─────────────────── */
const activeFilter = {
  $or: [{ isActive: true }, { isActive: { $exists: false } }],
};

/* ── GET /api/admin/users ───────────────────────────────────
   Query params: search, role, status, page, limit           */
const getUsers = async (req, res, next) => {
  try {
    const {
      search,
      role,
      status, // "active" | "pending" | "suspended"
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // ── Role filter ──────────────────────────────────────
    if (role) filter.role = role;

    // ── Status filter (derived, not a real field) ────────
    if (status === "suspended") {
      filter.isActive = false;
    } else if (status === "pending") {
      filter.$and = [
        activeFilter.$or
          ? { $or: activeFilter.$or }
          : { isActive: { $ne: false } },
        { isEmailVerified: { $ne: true } },
      ];
    } else if (status === "active") {
      filter.$and = [
        { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
        { isEmailVerified: true },
      ];
    }

    // ── Search (handle / email / name) ───────────────────
    if (search) {
      const re = { $regex: search, $options: "i" };
      const searchFilter = {
        $or: [
          { handle: re },
          { email: re },
          { firstName: re },
          { lastName: re },
        ],
      };
      if (filter.$and) {
        filter.$and.push(searchFilter);
      } else if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, searchFilter];
        delete filter.$or;
      } else {
        Object.assign(filter, searchFilter);
      }
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .select("-password -resetPasswordToken -resetPasswordExpires"),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      users,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[Admin/users]", err);
    next(err);
  }
};

/* ── GET /api/admin/users/verification-queue ────────────────
   Users with active accounts but not yet email-verified.
   Must be registered BEFORE /:id route.                     */
const getVerificationQueue = async (req, res, next) => {
  try {
    const queue = await User.find({
      $and: [
        { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
        { isEmailVerified: { $ne: true } },
      ],
    })
      .sort({ createdAt: 1 })
      .select(
        "handle firstName lastName avatar skills communityRole location createdAt isEmailVerified",
      );

    res.json({ success: true, queue, total: queue.length });
  } catch (err) {
    console.error("[Admin/users/verification-queue]", err);
    next(err);
  }
};

/* ── GET /api/admin/users/top-helpers ───────────────────── */
const getTopHelpers = async (req, res, next) => {
  try {
    const helpers = await User.find({
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    })
      .sort({ helpedCount: -1 })
      .limit(10)
      .select(
        "handle firstName lastName avatar points helpedCount resolvedCount streakDays badges",
      );

    res.json({ success: true, helpers });
  } catch (err) {
    console.error("[Admin/users/top-helpers]", err);
    next(err);
  }
};

/* ── GET /api/admin/users/:id ───────────────────────────── */
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -resetPasswordToken -resetPasswordExpires",
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error("[Admin/users/:id]", err);
    next(err);
  }
};

/* ── PATCH /api/admin/users/:id/verify ──────────────────── */
const verifyUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isEmailVerified: true, isActive: true },
      { new: true, select: "handle firstName isEmailVerified" },
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    await log(req.admin.handle, "verify", user._id, `Verified @${user.handle}`);
    res.json({
      success: true,
      message: `@${user.handle} verified successfully`,
    });
  } catch (err) {
    console.error("[Admin/users/verify]", err);
    next(err);
  }
};

/* ── PATCH /api/admin/users/:id/suspend ─────────────────── */
const suspendUser = async (req, res, next) => {
  try {
    const { reason = "" } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true, select: "handle" },
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    await log(
      req.admin.handle,
      "suspend",
      user._id,
      `Suspended @${user.handle}. Reason: ${reason || "no reason given"}`,
    );
    res.json({ success: true, message: `@${user.handle} suspended` });
  } catch (err) {
    console.error("[Admin/users/suspend]", err);
    next(err);
  }
};

/* ── PATCH /api/admin/users/:id/ban   (admin-only) ──────── */
const banUser = async (req, res, next) => {
  try {
    const { reason = "" } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true, select: "handle" },
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    await log(
      req.admin.handle,
      "ban",
      user._id,
      `Banned @${user.handle}. Reason: ${reason || "no reason given"}`,
    );
    res.json({ success: true, message: `@${user.handle} has been banned` });
  } catch (err) {
    console.error("[Admin/users/ban]", err);
    next(err);
  }
};

/* ── PATCH /api/admin/users/:id/reinstate ───────────────── */
const reinstateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: true },
      { new: true, select: "handle" },
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    await log(
      req.admin.handle,
      "reinstate",
      user._id,
      `Reinstated @${user.handle}`,
    );
    res.json({ success: true, message: `@${user.handle} reinstated` });
  } catch (err) {
    console.error("[Admin/users/reinstate]", err);
    next(err);
  }
};

/* ── PATCH /api/admin/users/:id/promote  (admin-only) ────── */
const promoteUser = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["user", "moderator", "admin"].includes(role)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid role. Use: user | moderator | admin",
        });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, select: "handle role" },
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    await log(
      req.admin.handle,
      "promote",
      user._id,
      `@${user.handle} → role: ${role}`,
    );
    res.json({ success: true, message: `@${user.handle} is now ${role}` });
  } catch (err) {
    console.error("[Admin/users/promote]", err);
    next(err);
  }
};

/* ── PATCH /api/admin/users/:id/reject-verification ─────── */
const rejectVerification = async (req, res, next) => {
  try {
    const { note = "" } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true, select: "handle" },
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    await log(
      req.admin.handle,
      "reject_verification",
      user._id,
      `Rejected verification for @${user.handle}. Note: ${note}`,
    );
    res.json({
      success: true,
      message: `Verification rejected for @${user.handle}`,
    });
  } catch (err) {
    console.error("[Admin/users/reject-verification]", err);
    next(err);
  }
};

module.exports = {
  getUsers,
  getUserById,
  getVerificationQueue,
  getTopHelpers,
  verifyUser,
  suspendUser,
  banUser,
  reinstateUser,
  promoteUser,
  rejectVerification,
};
