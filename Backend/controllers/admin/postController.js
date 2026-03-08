// REAL FIELD MAP (Post.js final):
//   status  → "active" | "resolved" | "closed"   (NOT open/pinned/flagged)
//   type    → "sos" | "tut" | "com" | "res"
//   replies → embedded subdocs  { author, body, isHelpful, helpfulVotes[] }
//   saves   → [ObjectId],  views, replyCount, author, reactions[], resources[]
const Post = require("../../models/Post");
const AdminLog = require("../../models/AdminLog");

const log = (admin, action, targetId, detail) =>
  AdminLog.create({
    admin,
    action,
    targetType: "post",
    targetId: String(targetId),
    detail,
  }).catch((e) => console.error("[AdminLog]", e.message));

// GET /api/admin/posts?status=&type=&search=&page=&limit=
const getPosts = async (req, res, next) => {
  try {
    const { status, type, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (search) filter.title = { $regex: search, $options: "i" };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("author", "handle firstName avatar")
        .select("title type status replyCount views saves tags createdAt"),
      Post.countDocuments(filter),
    ]);
    res.json({
      success: true,
      posts,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/posts/stats
const getPostStats = async (req, res, next) => {
  try {
    const [active, resolved, closed, zeroReply] = await Promise.all([
      Post.countDocuments({ status: "active" }),
      Post.countDocuments({ status: "resolved" }),
      Post.countDocuments({ status: "closed" }),
      Post.countDocuments({ status: "active", replyCount: 0 }),
    ]);
    res.json({ success: true, active, resolved, closed, zeroReply });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/posts/:id/close
const closePost = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { status: "closed" },
      { new: true, select: "title status" },
    );
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    await log(
      req.admin.handle,
      "close_post",
      post._id,
      `Closed: "${post.title.slice(0, 80)}"`,
    );
    res.json({ success: true, message: "Post closed" });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/posts/:id/resolve
const resolvePost = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { status: "resolved", resolvedAt: new Date(), resolvedBy: req.admin.id },
      { new: true, select: "title status" },
    );
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    await log(
      req.admin.handle,
      "resolve_post",
      post._id,
      `Resolved: "${post.title.slice(0, 80)}"`,
    );
    res.json({ success: true, message: "Post marked as resolved" });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/posts/:id/reopen
const reopenPost = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { status: "active", $unset: { resolvedAt: 1, resolvedBy: 1 } },
      { new: true, select: "title status" },
    );
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    await log(
      req.admin.handle,
      "reopen_post",
      post._id,
      `Reopened: "${post.title.slice(0, 80)}"`,
    );
    res.json({ success: true, message: "Post reopened as active" });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/posts/:id
const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).select("title");
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    await log(
      req.admin.handle,
      "delete_post",
      post._id,
      `Deleted: "${post.title.slice(0, 80)}"`,
    );
    await Post.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Post deleted permanently" });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/posts/:postId/replies/:replyId
const deleteReply = async (req, res, next) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.postId,
      {
        $pull: { replies: { _id: req.params.replyId } },
        $inc: { replyCount: -1 },
      },
      { new: true, select: "title" },
    );
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    await log(
      req.admin.handle,
      "delete_reply",
      req.params.postId,
      `Removed reply from "${post.title.slice(0, 60)}"`,
    );
    res.json({ success: true, message: "Reply removed" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPosts,
  getPostStats,
  closePost,
  resolvePost,
  reopenPost,
  deletePost,
  deleteReply,
};
