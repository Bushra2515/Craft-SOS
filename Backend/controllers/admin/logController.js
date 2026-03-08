const AdminLog = require("../../models/AdminLog");

const getLogs = async (req, res, next) => {
  try {
    const { action, admin, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (admin) filter.admin = { $regex: admin, $options: "i" };

    const [logs, total] = await Promise.all([
      AdminLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      AdminLog.countDocuments(filter),
    ]);
    res.json({ success: true, logs, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
};

const getLogSummary = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalActions, bansIssued, postsRemoved, usersVerified] =
      await Promise.all([
        AdminLog.countDocuments({ createdAt: { $gte: since } }),
        AdminLog.countDocuments({ action: "ban", createdAt: { $gte: since } }),
        AdminLog.countDocuments({
          action: "delete_post",
          createdAt: { $gte: since },
        }),
        AdminLog.countDocuments({
          action: "verify",
          createdAt: { $gte: since },
        }),
      ]);
    res.json({
      success: true,
      summary: { totalActions, bansIssued, postsRemoved, usersVerified },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLogs, getLogSummary };
