// Backend/controllers/postController.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Core post CRUD + social actions. All routes JWT-protected.
//
//   Endpoints (via postRoutes.js at /api/posts):
//     GET    /api/posts                  → getPosts   (feed with filters)
//     POST   /api/posts                  → createPost
//     GET    /api/posts/:id              → getPostById
//     PUT    /api/posts/:id              → updatePost  (author only)
//     DELETE /api/posts/:id              → deletePost  (author only)
//     PATCH  /api/posts/:id/resolve      → resolvePost (author only)
//     PATCH  /api/posts/:id/save         → toggleSave
//     POST   /api/posts/:id/replies      → addReply   ← emits socket notif
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");

// ── Allowed post types ────────────────────────────────────
const VALID_TYPES = ["sos", "tut", "com", "res"];

// ── Tiny helper ───────────────────────────────────────────
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/* ─────────────────────────────────────────────────────────
   GET /api/posts
   Feed: paginated, filterable by type / status / tag / search.
   Query params: type, status, tag, search, page, limit
───────────────────────────────────────────────────────── */
exports.getPosts = async (req, res) => {
  try {
    const { type, status, tag, search, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (type && VALID_TYPES.includes(type)) filter.type = type;
    if (status && ["active", "resolved", "closed"].includes(status))
      filter.status = status;
    if (tag) filter.tags = { $regex: new RegExp(tag, "i") };
    if (search) filter.title = { $regex: new RegExp(search, "i") };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate("author", "name handle avatar points badges")
        .lean(),
      Post.countDocuments(filter),
    ]);

    const userId = req.user.userId.toString();
    const shaped = posts.map((p) => ({
      id: p._id,
      type: p.type,
      status: p.status,
      title: p.title,
      body: p.body?.slice(0, 300) || "",
      tags: p.tags || [],
      views: p.views || 0,
      replyCount: p.replyCount || 0,
      saveCount: (p.saves || []).length,
      isSaved: (p.saves || []).some((s) => s?.toString() === userId),
      author: {
        id: p.author?._id,
        name: p.author?.name,
        handle: p.author?.handle,
        avatar: p.author?.avatar,
        points: p.author?.points,
        badges: p.author?.badges,
      },
      createdAt: p.createdAt,
    }));

    return res.status(200).json({
      success: true,
      posts: shaped,
      total,
      page: pageNum,
      hasMore: pageNum * limitNum < total,
    });
  } catch (err) {
    console.error("[getPosts]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/posts
   Create a new post.
   Body: { type, title, body, tags[], resources[] }
───────────────────────────────────────────────────────── */
exports.createPost = async (req, res) => {
  try {
    const { type, title, body, tags = [], resources = [] } = req.body;

    if (!type || !VALID_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post type" });
    }
    if (!title?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Title is required" });
    }
    if (!body?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Body is required" });
    }

    const post = await Post.create({
      author: req.user.userId,
      type: type.trim(),
      title: title.trim(),
      body: body.trim(),
      tags: tags
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 10),
      resources,
    });

    return res
      .status(201)
      .json({ success: true, post: { id: post._id, ...post.toObject() } });
  } catch (err) {
    console.error("[createPost]", err);
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Duplicate post" });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/posts/:id
   Full single post — also increments view counter.
───────────────────────────────────────────────────────── */
exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post ID" });
    }

    const post = await Post.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true },
    )
      .populate("author", "name handle avatar points badges bio location")
      .lean();

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    return res.status(200).json({ success: true, post });
  } catch (err) {
    console.error("[getPostById]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PUT /api/posts/:id
   Edit title/body/tags — author only.
───────────────────────────────────────────────────────── */
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post ID" });
    }

    const post = await Post.findById(id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    if (post.author.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorised" });
    }

    // BUG FIX: original only read { title, body, tags } — edit-post.js
    // also sends type and status from the edit form; they were silently ignored.
    const { title, body, tags, type, status } = req.body;

    if (title) post.title = title.trim();
    if (body) post.body = body.trim();
    if (tags)
      post.tags = tags
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 10);

    // ── Type ────────────────────────────────────────────
    const VALID_TYPES = ["sos", "tut", "com", "res"];
    if (type && VALID_TYPES.includes(type)) {
      post.type = type;
    }

    // ── Status / Mark as Solved ─────────────────────────
    if (status === "resolved") {
      post.status = "resolved";
      if (!post.resolvedAt) {
        post.resolvedAt = new Date();
        post.resolvedBy = req.user.userId;
      }
    } else if (status === "active") {
      post.status = "active";
      post.resolvedAt = null;
      post.resolvedBy = null;
    } else if (status === "closed") {
      post.status = "closed";
    }

    await post.save();
    return res.status(200).json({ success: true, post });
  } catch (err) {
    console.error("[updatePost]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   DELETE /api/posts/:id
   Delete a post and all its replies — author only.
───────────────────────────────────────────────────────── */
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post ID" });
    }

    const post = await Post.findById(id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    if (post.author.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorised" });
    }

    await Post.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Post deleted" });
  } catch (err) {
    console.error("[deletePost]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/posts/:id/resolve
   Mark a post as resolved — author only.
───────────────────────────────────────────────────────── */
exports.resolvePost = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post ID" });
    }

    const post = await Post.findById(id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    if (post.author.toString() !== req.user.userId) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorised" });
    }
    if (post.status === "resolved") {
      return res
        .status(400)
        .json({ success: false, message: "Already resolved" });
    }

    post.status = "resolved";
    post.resolvedAt = new Date();
    post.resolvedBy = req.user.userId;
    await post.save();

    // Emit real-time event to all users viewing this post room
    const io = req.app.get("io");
    if (io) {
      io.to(`post:${id}`).emit("post:resolved", {
        postId: id,
        resolvedAt: post.resolvedAt,
      });
    }

    return res.status(200).json({ success: true, post });
  } catch (err) {
    console.error("[resolvePost]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/posts/:id/save
   Bookmark toggle — adds/removes current user from saves[].
───────────────────────────────────────────────────────── */
exports.toggleSave = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post ID" });
    }

    const post = await Post.findById(id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    const userId = req.user.userId;
    const alreadySaved = post.saves.some(
      (s) => s?.toString() === userId.toString(),
    );

    if (alreadySaved) {
      post.saves.pull(userId);
    } else {
      post.saves.addToSet(userId);
    }
    await post.save();

    return res.status(200).json({
      success: true,
      isSaved: !alreadySaved,
      saveCount: post.saves.length,
    });
  } catch (err) {
    console.error("[toggleSave]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/posts/:id/replies
   Add a reply to a post.

   Body: { body }

   Socket events emitted (req.app.get("io")):
     • "comment:new" → broadcast to post:ID room so all viewers
       see the new reply appear without refreshing.
     • "notification:new" → sent only to the post author's socket
       room so they get a badge/toast alert.

   Returns the shaped reply with author data.
───────────────────────────────────────────────────────── */
exports.addReply = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post ID" });
    }

    const { body } = req.body;
    if (!body?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Reply body is required" });
    }
    if (body.trim().length > 5000) {
      return res
        .status(400)
        .json({ success: false, message: "Reply too long (max 5000 chars)" });
    }

    // Find post + author in parallel
    const [post, viewer] = await Promise.all([
      Post.findById(id),
      User.findById(req.user.userId)
        .select("name handle avatar points badges")
        .lean(),
    ]);

    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    // Add reply subdoc
    post.replies.push({
      author: req.user.userId,
      body: body.trim(),
    });
    post.replyCount = post.replies.length;
    await post.save();

    // ── Shape the new reply for the response ─────────────
    const newReply = post.replies[post.replies.length - 1];
    const shaped = {
      id: newReply._id,
      body: newReply.body,
      isHelpful: false,
      helpfulCount: 0,
      hasVoted: false,
      createdAt: newReply.createdAt,
      author: {
        id: viewer._id,
        name: viewer.name,
        handle: viewer.handle,
        avatar: viewer.avatar || "",
        points: viewer.points || 0,
        badges: viewer.badges || [],
      },
    };

    // ── Socket: broadcast new reply to all post viewers ──
    const io = req.app.get("io");
    if (io) {
      io.to(`post:${id}`).emit("comment:new", shaped);

      // Notify the post author if they're not the one replying
      const authorId = post.author.toString();
      if (authorId !== req.user.userId.toString()) {
        io.to(`user:${authorId}`).emit("notif:new", {
          type: "reply",
          message: `${viewer.name} replied to your post`,
          postId: id,
          actorId: req.user.userId,
        });
      }
    }

    // ── Update helper's helpedCount stat ─────────────────
    await User.findByIdAndUpdate(req.user.userId, { $inc: { helpedCount: 1 } });

    return res
      .status(201)
      .json({ success: true, reply: shaped, replyCount: post.replyCount });
  } catch (err) {
    console.error("[addReply]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/posts/:id/replies
   Paginated replies — included here so postRoutes.js can
   reference it instead of (or alongside) postDetailController.
───────────────────────────────────────────────────────── */
exports.getReplies = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post ID" });
    }

    const { sort = "top", page = 1 } = req.query;
    const userId = req.user.userId;
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = 10;

    const post = await Post.findById(id)
      .populate("replies.author", "name handle avatar points badges")
      .lean();
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    let replies = [...(post.replies || [])];
    if (sort === "top") {
      replies.sort(
        (a, b) => (b.helpfulVotes?.length || 0) - (a.helpfulVotes?.length || 0),
      );
    } else {
      replies.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const total = replies.length;
    const paged = replies.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    const shaped = paged.map((r) => ({
      id: r._id,
      body: r.body,
      helpfulCount: (r.helpfulVotes || []).length,
      hasVoted: (r.helpfulVotes || []).some(
        (v) => v?.toString() === userId.toString(),
      ),
      isHelpful: r.isHelpful || false,
      createdAt: r.createdAt,
      author: {
        id: r.author?._id,
        name: r.author?.name,
        handle: r.author?.handle,
        avatar: r.author?.avatar || "",
        points: r.author?.points || 0,
        badges: r.author?.badges || [],
      },
    }));

    return res.status(200).json({
      success: true,
      replies: shaped,
      total,
      page: pageNum,
      hasMore: pageNum * pageSize < total,
    });
  } catch (err) {
    console.error("[getReplies]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/posts/:id/replies/:replyId/helpful
   Toggle helpful vote on a specific reply.
───────────────────────────────────────────────────────── */
exports.toggleReplyHelpful = async (req, res) => {
  try {
    const { id, replyId } = req.params;
    const userId = req.user.userId;

    const post = await Post.findById(id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    const reply = post.replies.id(replyId);
    if (!reply)
      return res
        .status(404)
        .json({ success: false, message: "Reply not found" });

    const hasVoted = (reply.helpfulVotes || []).some(
      (v) => v?.toString() === userId.toString(),
    );
    if (hasVoted) {
      reply.helpfulVotes.pull(userId);
    } else {
      reply.helpfulVotes.addToSet(userId);
    }
    await post.save();

    return res.status(200).json({
      success: true,
      hasVoted: !hasVoted,
      helpfulCount: reply.helpfulVotes.length,
    });
  } catch (err) {
    console.error("[toggleReplyHelpful]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/posts/:id/reactions
   Toggle an emoji reaction on a post.
───────────────────────────────────────────────────────── */
exports.toggleReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user.userId;

    if (!isValidId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post ID" });
    }
    if (!emoji) {
      return res
        .status(400)
        .json({ success: false, message: "Emoji is required" });
    }

    const post = await Post.findById(id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    let reaction = (post.reactions || []).find((r) => r.emoji === emoji);
    if (!reaction) {
      post.reactions.push({ emoji, label: emoji, count: 0, users: [] });
      reaction = post.reactions[post.reactions.length - 1];
    }

    const already = (reaction.users || []).some(
      (u) => u?.toString() === userId.toString(),
    );
    if (already) {
      reaction.users.pull(userId);
    } else {
      reaction.users.addToSet(userId);
    }
    // Do NOT manually track count — not in schema, silently dropped by Mongoose.
    // Derive from users.length instead (consistent with postDetailController).

    await post.save();

    return res.status(200).json({
      success: true,
      reactions: post.reactions.map((r) => ({
        emoji: r.emoji,
        label: r.label,
        count: r.count || 0,
        reacted: (r.users || []).some(
          (u) => u?.toString() === userId.toString(),
        ),
      })),
    });
  } catch (err) {
    console.error("[toggleReaction]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/posts/:id/related
   Related posts by same type (used if postRoutes.js has this).
───────────────────────────────────────────────────────── */
exports.getRelatedPosts = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post ID" });
    }

    const post = await Post.findById(id).lean();
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    const related = await Post.find({
      _id: { $ne: id },
      type: post.type,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .populate("author", "name handle avatar")
      .lean();

    return res.status(200).json({
      success: true,
      related: related.map((r) => ({
        id: r._id,
        type: r.type,
        title: r.title,
        meta: `${r.replyCount || 0} replies · ${r.author?.name || "Unknown"}`,
      })),
    });
  } catch (err) {
    console.error("[getRelatedPosts]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/posts/:id/views
   Increment view counter (fire-and-forget endpoint).
───────────────────────────────────────────────────────── */
exports.incrementViews = async (req, res) => {
  try {
    await Post.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[incrementViews]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
