// Side-effects use real field names: User.isActive (not status enum)
const Report = require("../../models/Report");
const Post = require("../../models/Post");
const User = require("../../models/User");
const AdminLog = require("../../models/AdminLog");

const log = (admin, action, targetId, detail) =>
  AdminLog.create({
    admin,
    action,
    targetType: "report",
    targetId: String(targetId),
    detail,
  }).catch((e) => console.error("[AdminLog]", e.message));

// GET /api/admin/reports?status=&reason=&page=&limit=
const getReports = async (req, res, next) => {
  try {
    const { status = "pending", reason, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (reason) filter.reason = reason;

    const [reports, total, counts] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("reportedBy", "handle avatar"),
      Report.countDocuments(filter),
      Report.aggregate([
        { $match: { status: "pending" } },
        { $group: { _id: "$reason", count: { $sum: 1 } } },
      ]),
    ]);

    const countMap = {};
    counts.forEach(({ _id, count }) => {
      countMap[_id] = count;
    });

    res.json({
      success: true,
      reports,
      total,
      counts: countMap,
      page: Number(page),
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/reports/:id/resolve
// Body: { action: "remove_post" | "warn_user" | "ban_user" | "dismiss" }
const resolveReport = async (req, res, next) => {
  try {
    const { action = "dismiss" } = req.body;
    const report = await Report.findById(req.params.id);
    if (!report)
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });

    if (action === "remove_post") {
      await Post.findByIdAndDelete(report.targetId);
      await log(
        req.admin.handle,
        "delete_post",
        report.targetId,
        "Removed via report",
      );
    }
    if (action === "ban_user") {
      // Real schema: isActive:false (no status enum on User)
      await User.findByIdAndUpdate(report.targetId, { isActive: false });
      await log(req.admin.handle, "ban", report.targetId, "Banned via report");
    }
    if (action === "warn_user") {
      await log(
        req.admin.handle,
        "warn_user",
        report.targetId,
        `Warning via report #${report._id}`,
      );
    }

    const newStatus = action === "dismiss" ? "dismissed" : "resolved";
    await Report.findByIdAndUpdate(req.params.id, {
      status: newStatus,
      action,
      resolvedAt: new Date(),
      resolvedBy: req.admin.handle,
    });

    res.json({ success: true, message: `Report ${newStatus}` });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/reports/dismiss-all
const dismissAll = async (req, res, next) => {
  try {
    const { modifiedCount } = await Report.updateMany(
      { status: "pending" },
      {
        status: "dismissed",
        action: "dismissed",
        resolvedAt: new Date(),
        resolvedBy: req.admin.handle,
      },
    );
    await log(
      req.admin.handle,
      "dismiss_all_reports",
      "bulk",
      `Dismissed ${modifiedCount} reports`,
    );
    res.json({ success: true, message: `${modifiedCount} reports dismissed` });
  } catch (err) {
    next(err);
  }
};

module.exports = { getReports, resolveReport, dismissAll };
