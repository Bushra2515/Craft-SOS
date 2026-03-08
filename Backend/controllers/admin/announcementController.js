const Announcement = require("../../models/Announcement");
const AdminLog = require("../../models/AdminLog");

const log = (admin, action, targetId, detail) =>
  AdminLog.create({
    admin,
    action,
    targetType: "announcement",
    targetId: String(targetId),
    detail,
  }).catch((e) => console.error("[AdminLog]", e.message));

const getAnnouncements = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const [anns, total] = await Promise.all([
      Announcement.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      Announcement.countDocuments(filter),
    ]);
    res.json({ success: true, announcements: anns, total, page: Number(page) });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/announcements/send-now — compose + send in one step
const sendNow = async (req, res, next) => {
  try {
    const {
      title,
      message,
      audience = "all",
      type = "announcement",
    } = req.body;
    if (!title || !message) {
      return res
        .status(400)
        .json({ success: false, message: "title and message are required" });
    }
    const ann = await Announcement.create({
      title,
      message,
      audience,
      type,
      status: "sent",
      sentAt: new Date(),
      createdBy: req.admin.handle,
    });
    await log(
      req.admin.handle,
      "send_announcement",
      ann._id,
      `Broadcast: "${ann.title}" → ${ann.audience}`,
    );
    res
      .status(201)
      .json({
        success: true,
        message: `"${ann.title}" sent to ${ann.audience}`,
        announcement: ann,
      });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAnnouncements, sendNow };
