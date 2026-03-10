const express = require("express");
const router = express.Router();
const Report = require("../models/Report");
const { protect } = require("../Middleware/authMiddleware"); // use your actual middleware name

// targetType → targetModel map (matches schema enums exactly)
const TARGET_MODEL_MAP = {
  post: "Post",
  user: "User",
  comment: "Post", // comments live inside Post — no separate model
};

// POST /api/reports
router.post("/", protect, async (req, res, next) => {
  try {
    const { targetId, targetType, reason, detail } = req.body;

    // Validate required fields
    if (!targetId || !targetType || !reason) {
      return res.status(400).json({
        message: "targetId, targetType, and reason are required",
      });
    }

    // Validate against schema enums
    if (!["post", "user", "comment"].includes(targetType)) {
      return res.status(400).json({ message: "Invalid targetType" });
    }
    if (
      !["spam", "harassment", "scam", "misleading", "other"].includes(reason)
    ) {
      return res.status(400).json({ message: "Invalid reason" });
    }

    const userId = req.user.userId;

    // Check if this user already reported this exact target
    const existing = await Report.findOne({
      targetId,
      targetType,
      reportedBy: userId, // works because reportedBy is an array — Mongo checks if userId is IN the array
      status: "pending",
    });
    if (existing) {
      return res.status(409).json({ message: "You already reported this" });
    }

    // Check if a pending report for this target already exists (from anyone)
    // If yes, just add this user to reportedBy instead of creating a duplicate
    const existingReport = await Report.findOne({
      targetId,
      targetType,
      reason,
      status: "pending",
    });

    if (existingReport) {
      // Add this user to the reporters array
      await Report.findByIdAndUpdate(existingReport._id, {
        $addToSet: { reportedBy: userId },
      });
      return res.status(200).json({
        success: true,
        message: "Report recorded",
        report: existingReport,
      });
    }

    // Create new report
    const report = await Report.create({
      targetId,
      targetType,
      targetModel: TARGET_MODEL_MAP[targetType],
      reason,
      detail: detail || "",
      reportedBy: [userId], // array — wrap in array
      status: "pending",
    });

    res.status(201).json({ success: true, report });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
