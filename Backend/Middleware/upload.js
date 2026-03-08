// Backend/middleware/upload.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Configures Multer for three upload types:
//     avatars  → max 2 MB, stored in uploads/avatars/
//     banners  → max 4 MB, stored in uploads/banners/
//     posts    → max 8 MB, stored in uploads/posts/
//
//   Each config validates:
//     • MIME type (jpeg, png, webp, gif only)
//     • File size limit (enforced by Multer limits)
//     • Filename sanitised + prefixed with userId + timestamp
//       so collisions are impossible
//
//   Usage in a route:
//     const { uploadAvatar } = require("../middleware/upload");
//     router.patch("/avatar", protect, uploadAvatar.single("avatar"), handler);
//
//   The file URL is then available as:
//     req.file.filename  → "avatar_userId_1719000000000.jpg"
//     Served at:         → http://localhost:5000/uploads/avatars/<filename>
// ─────────────────────────────────────────────────────────────────────────────
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ── Allowed MIME types ────────────────────────────────────
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function fileFilter(_req, file, cb) {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new multer.MulterError(
        "LIMIT_UNEXPECTED_FILE",
        "Only jpeg, png, webp, gif images are allowed.",
      ),
    );
  }
}

// ── Storage factory ───────────────────────────────────────
// Creates a diskStorage for the given sub-folder and file prefix.
function makeStorage(subDir, prefix) {
  const dest = path.join(__dirname, "..", "uploads", subDir);

  // Ensure the folder exists (safe on first run)
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const userId = req.user?.userId || "anon";
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      // e.g. "avatar_683abc_1719000000000.jpg"
      cb(null, `${prefix}_${userId}_${Date.now()}${ext}`);
    },
  });
}

// ── Three upload configs ──────────────────────────────────
const uploadAvatar = multer({
  storage: makeStorage("avatars", "avatar"),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

const uploadBanner = multer({
  storage: makeStorage("banners", "banner"),
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
});

const uploadPost = multer({
  storage: makeStorage("posts", "post"),
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

// ── Central error handler (use in route as 4th arg or middleware) ──
function handleUploadError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: "File is too large.",
      LIMIT_UNEXPECTED_FILE: err.message || "Invalid file type.",
    };
    return res.status(400).json({
      success: false,
      message: messages[err.code] || "Upload error.",
    });
  }
  next(err);
}

module.exports = { uploadAvatar, uploadBanner, uploadPost, handleUploadError };
