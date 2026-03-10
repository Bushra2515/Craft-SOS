// Backend/controllers/settingsController.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Handles the Edit Profile / Settings page API.
//   Five functions, all JWT-protected:
//
//   getSettings      GET  /api/settings
//     → Returns the full editable profile object for populating the form.
//
//   updateSettings   PATCH /api/settings
//     → Saves all editable fields (basic info, contact, social, craft, role,
//       notification prefs). Avatar / banner images handled by uploadController.
//
//   changePassword   PATCH /api/settings/password
//     → Verifies current password, hashes and saves new one.
//
//   checkHandle      GET  /api/settings/handle-check?handle=xxx
//     → Returns { available: true/false } — used by the live handle checker.
//
//   deactivateAccount PATCH /api/settings/deactivate
//     → Sets user.isActive = false (soft delete — user can re-login to restore).
//
//   deleteAccount    DELETE /api/settings/account
//     → Permanently deletes user document + their posts.
//       (Requires password confirmation in body.)
// ─────────────────────────────────────────────────────────────────────────────
const User = require("../models/User");
const Post = require("../models/Post");
const bcrypt = require("bcryptjs");

// ── Helper: fields allowed to be updated (whitelist) ─────
const EDITABLE_FIELDS = [
  "firstName",
  "lastName",
  "bio",
  "location",
  "website",
  "instagram",
  "etsy",
  "ravelry",
  "pinterest",
  "contact",
  "businessType",
  "communityRole",
  "experience",
  "skills",
  "hobbies",
  "email",
];

/* ─────────────────────────────────────────────────────────
   GET /api/settings
   Returns the current user's editable profile data.
   Used to pre-fill the form on page load.
───────────────────────────────────────────────────────── */
exports.getSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("-password") // never return the hashed password
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      settings: {
        // Identity
        firstName: user.firstName,
        lastName: user.lastName,
        handle: user.handle,
        email: user.email,
        // Profile visuals
        avatar: user.avatar || "",
        bannerImg: user.bannerImg || "",
        bannerColor: user.bannerColor || "#7a8f52",
        // Bio & location
        bio: user.bio || "",
        location: user.location || "",
        website: user.website || "",
        // Social
        instagram: user.instagram || "",
        etsy: user.etsy || "",
        ravelry: user.ravelry || "",
        pinterest: user.pinterest || "",
        contact: user.contact || "",
        // Craft profile
        businessType: user.businessType || "",
        communityRole: user.communityRole || "both",
        experience: user.experience ?? 0,
        skills: user.skills || [],
        hobbies: user.hobbies || [],
        // Notification prefs
        notifPreferences: user.notifPreferences || {
          push: true,
          newResponses: true,
          friendRequests: true,
          communityHighlights: false,
        },
      },
    });
  } catch (err) {
    console.error("[getSettings]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/settings
   Updates all non-password, non-handle fields.
   Handle is excluded here — it has its own availability
   check and is updated only if explicitly confirmed.
───────────────────────────────────────────────────────── */
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const updates = {};

    // ── Whitelist: only allow known fields ────────────────
    EDITABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    // ── Derive name if first/last changed ─────────────────
    if (updates.firstName || updates.lastName) {
      const user = await User.findById(userId)
        .select("firstName lastName")
        .lean();
      updates.name =
        `${updates.firstName ?? user.firstName} ${updates.lastName ?? user.lastName}`.trim();
    }

    // ── Handle update (only if explicitly passed) ─────────
    if (req.body.handle) {
      const newHandle = req.body.handle.trim().toLowerCase();
      // Validate format
      if (!/^[a-z0-9_]{3,30}$/.test(newHandle)) {
        return res.status(400).json({
          success: false,
          message: "Handle: 3-30 chars, letters/numbers/underscore only",
        });
      }
      // Check uniqueness (exclude own handle)
      const taken = await User.findOne({
        handle: newHandle,
        _id: { $ne: userId },
      }).lean();
      if (taken) {
        return res
          .status(400)
          .json({ success: false, message: "That handle is already taken." });
      }
      updates.handle = newHandle;
    }

    // ── Sanitise tag arrays ───────────────────────────────
    if (Array.isArray(updates.skills)) {
      updates.skills = [
        ...new Set(updates.skills.map((s) => s.trim()).filter(Boolean)),
      ].slice(0, 20);
    }
    if (Array.isArray(updates.hobbies)) {
      updates.hobbies = [
        ...new Set(updates.hobbies.map((h) => h.trim()).filter(Boolean)),
      ].slice(0, 20);
    }

    // ── Notification preferences (nested object) ──────────
    if (
      req.body.notifPreferences &&
      typeof req.body.notifPreferences === "object"
    ) {
      const allowed = [
        "push",
        "newResponses",
        "friendRequests",
        "communityHighlights",
        "email",
        "inApp",
      ];
      const prefs = {};
      allowed.forEach((k) => {
        if (req.body.notifPreferences[k] !== undefined) {
          prefs[`notifPreferences.${k}`] = Boolean(
            req.body.notifPreferences[k],
          );
        }
      });
      Object.assign(updates, prefs);
    }

    // ── Clamp experience ──────────────────────────────────
    if (updates.experience !== undefined) {
      updates.experience = Math.min(
        20,
        Math.max(0, Number(updates.experience) || 0),
      );
    }
    // ── Avatar removal ────────────────────────────────────
    // Frontend sends removeAvatar:true when the user clicks Remove.
    // avatar is intentionally excluded from EDITABLE_FIELDS to prevent
    // accidental overwrites on normal saves, so we handle the explicit
    // removal flag separately here.
    if (req.body.removeAvatar === true) {
      updates.avatar = "";
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true },
    )
      .select("-password")
      .lean();

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      // Return only the fields the frontend cares about for localStorage refresh
      user: {
        name: updated.name,
        handle: updated.handle,
        avatar: updated.avatar,
        email: updated.email,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res
        .status(400)
        .json({ success: false, message: `That ${field} is already taken.` });
    }
    console.error("[updateSettings]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/settings/password
   Body: { currentPassword, newPassword }
───────────────────────────────────────────────────────── */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Both passwords are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    // Must select password since it's select:false in schema
    const user = await User.findById(req.user.userId).select("+password");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    // pre-save hook hashes it automatically
    user.password = newPassword;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    console.error("[changePassword]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/settings/handle-check?handle=xxx
   Returns { available: true/false, handle: "..." }
   Used by the real-time handle availability checker.
───────────────────────────────────────────────────────── */
exports.checkHandle = async (req, res) => {
  try {
    const handle = (req.query.handle || "").trim().toLowerCase();

    if (!handle || !/^[a-z0-9_]{3,30}$/.test(handle)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid handle format" });
    }

    const existing = await User.findOne({
      handle,
      _id: { $ne: req.user.userId }, // allow own current handle
    }).lean();

    return res.status(200).json({
      success: true,
      handle,
      available: !existing,
    });
  } catch (err) {
    console.error("[checkHandle]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/settings/deactivate
   Soft-deletes: sets isActive=false.
   User can re-activate by logging in again (set isActive=true
   in authController on successful login).
───────────────────────────────────────────────────────── */
exports.deactivateAccount = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, {
      $set: { isActive: false },
    });
    return res
      .status(200)
      .json({ success: true, message: "Account deactivated" });
  } catch (err) {
    console.error("[deactivateAccount]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   DELETE /api/settings/account
   Body: { password } — required for confirmation.
   Permanently removes user + their posts.
───────────────────────────────────────────────────────── */
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res
        .status(400)
        .json({ success: false, message: "Password confirmation required" });
    }

    const user = await User.findById(req.user.userId).select("+password");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Password is incorrect" });
    }

    // Delete the user's posts
    await Post.deleteMany({ author: req.user.userId });

    // Delete the user
    await User.findByIdAndDelete(req.user.userId);

    return res
      .status(200)
      .json({ success: true, message: "Account permanently deleted" });
  } catch (err) {
    console.error("[deleteAccount]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
