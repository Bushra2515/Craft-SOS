// Backend/controllers/uploadController.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   After Multer saves the file to disk, these handlers:
//     1. Build the public URL  (http://localhost:5000/uploads/…/filename)
//     2. Update the relevant DB field  (user.avatar, user.bannerColor → bannerImg,
//        or return the URL for embedding in a post)
//     3. Delete the old file so disk doesn't fill up
//
//   Routes:
//     POST /api/upload/avatar      → uploadAvatar.single("avatar")  → saveAvatar
//     POST /api/upload/banner      → uploadBanner.single("banner")  → saveBanner
//     POST /api/upload/post-image  → uploadPost.single("image")     → savePostImage
// ─────────────────────────────────────────────────────────────────────────────
const path = require("path");
const fs = require("fs");
const User = require("../models/User");

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

// ── Helper: delete old file from disk ─────────────────────
function deleteOldFile(oldUrl, subDir) {
  if (!oldUrl || !oldUrl.includes(`/uploads/${subDir}/`)) return;
  const filename = path.basename(oldUrl);
  const filepath = path.join(__dirname, "..", "uploads", subDir, filename);
  fs.unlink(filepath, () => {}); // silent — file may already be gone
}

/* ─────────────────────────────────────────────────────────
   POST /api/upload/avatar
   Saves new avatar, updates User.avatar, deletes old file.
───────────────────────────────────────────────────────── */
exports.saveAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded." });
    }

    const userId = req.user.userId;
    const fileUrl = `${BASE_URL}/uploads/avatars/${req.file.filename}`;

    // Fetch old avatar URL to delete it
    const user = await User.findById(userId).select("avatar").lean();
    if (user?.avatar) deleteOldFile(user.avatar, "avatars");

    // Persist new URL
    await User.findByIdAndUpdate(userId, { $set: { avatar: fileUrl } });

    // Update localStorage-level user object hint for the frontend
    return res.status(200).json({ success: true, url: fileUrl });
  } catch (err) {
    console.error("[saveAvatar]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/upload/banner
   Saves profile banner image, stores URL in user.bannerImg.
───────────────────────────────────────────────────────── */
exports.saveBanner = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded." });
    }

    const userId = req.user.userId;
    const fileUrl = `${BASE_URL}/uploads/banners/${req.file.filename}`;

    const user = await User.findById(userId).select("bannerImg").lean();
    if (user?.bannerImg) deleteOldFile(user.bannerImg, "banners");

    await User.findByIdAndUpdate(userId, { $set: { bannerImg: fileUrl } });

    return res.status(200).json({ success: true, url: fileUrl });
  } catch (err) {
    console.error("[saveBanner]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/upload/post-image
   Saves an image for use inside a post body or as a cover.
   Does NOT update any model — returns the URL for the
   create-post form to embed in the post body / imageUrl field.
───────────────────────────────────────────────────────── */
exports.savePostImage = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded." });
    }

    const fileUrl = `${BASE_URL}/uploads/posts/${req.file.filename}`;

    return res.status(200).json({ success: true, url: fileUrl });
  } catch (err) {
    console.error("[savePostImage]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
