const User = require("../models/User");

// ================= GET PROFILE =================
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
};

// ================= UPDATE PROFILE =================
exports.updateProfile = async (req, res) => {
  try {
    const { name, bio, hobbies } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      {
        name,
        bio,
        hobbies,
      },
      { new: true, runValidators: true },
    ).select("-password");

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({
      message: "Server error",
    });
  }
};
