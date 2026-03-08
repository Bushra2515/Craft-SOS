// Backend/routes/uploadRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Three upload routes, each with:
//     1. JWT guard (protect)
//     2. Multer middleware (handles multipart/form-data, validates, saves to disk)
//     3. Multer error handler (returns clean 400 instead of crashing)
//     4. Controller (builds URL, updates DB, returns URL to client)
//
//   Frontend usage (fetch with FormData):
//     const fd = new FormData();
//     fd.append("avatar", fileInput.files[0]);
//     fetch("/api/upload/avatar", { method:"POST", headers:{Authorization:"Bearer "+token}, body:fd })
//       .then(r => r.json())
//       .then(({ url }) => /* use url */);
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const protect = require("../Middleware/authMiddleware");
const {
  uploadAvatar,
  uploadBanner,
  uploadPost,
  handleUploadError,
} = require("../Middleware/upload");
const {
  saveAvatar,
  saveBanner,
  savePostImage,
} = require("../controllers/uploadController");

const router = express.Router();
router.use(protect);

router.post(
  "/avatar",
  uploadAvatar.single("avatar"),
  handleUploadError,
  saveAvatar,
);
router.post(
  "/banner",
  uploadBanner.single("banner"),
  handleUploadError,
  saveBanner,
);
router.post(
  "/post-image",
  uploadPost.single("image"),
  handleUploadError,
  savePostImage,
);

module.exports = router;
