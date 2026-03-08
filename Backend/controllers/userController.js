// Backend/controllers/userController.js
const User = require("../models/User");

// ── GET /api/users/me ──────────────────────────────────────
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, user, data: user }); // both keys for compatibility
  } catch (err) {
    console.error("[getMyProfile]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── PUT /api/users/me ──────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    // ✅ bio and hobbies now exist in the User model
    const { name, bio, hobbies, handle } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { name, bio, hobbies, handle },
      { new: true, runValidators: true },
    ).select("-password");

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: updatedUser });
  } catch (err) {
    console.error("[updateProfile]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── GET /api/users/:id ─────────────────────────────────────
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name handle avatar bio hobbies points helpedCount badges followers following",
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, user, data: user }); // both keys for compatibility
  } catch (err) {
    console.error("[getUserById]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
