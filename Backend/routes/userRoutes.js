const express = require("express");
const protect = require("../Middleware/authMiddleware");
const {
  getMyProfile,
  updateProfile,
  // getUserById,
} = require("../controllers/userController");

const router = express.Router();

router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateProfile);
// router.get("/:id", getUserById);

module.exports = router;
