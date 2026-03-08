// Backend/controllers/postDetailController.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Handles all post-detail page operations:
//   - Load full post with author, replies, reactions, resources
//   - Increment view count (called on page load, once per session)
//   - Toggle reaction (🔥 Insightful, 💚 Helpful, etc.)
//   - Paginated/sorted replies
//   - Mark a reply as helpful
//   - Load related posts (same type, different post)
//
//   Note: toggleSave, addReply, and toggleFollow already exist in
//   postRoutes and dashboardRoutes — no need to duplicate them here.
// ─────────────────────────────────────────────────────────────────────────────
const Post = require("../models/Post");
const User = require("../models/User");

// Default reactions seeded when a post has none yet
const DEFAULT_REACTIONS = [
  { emoji: "🔥", label: "Insightful" },
  { emoji: "💚", label: "Helpful" },
  { emoji: "🙌", label: "Thank you" },
  { emoji: "💾", label: "Saving this" },
  { emoji: "🤯", label: "Mind blown" },
];

/* ─────────────────────────────────────────────────────────
   GET /api/post-detail/:id
   Returns the full post with populated author, shaped replies,
   reactions with reacted flag, resources, and save/follow state.
───────────────────────────────────────────────────────── */
exports.getPostDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId.toString();

    const post = await Post.findById(id)
      .populate(
        "author",
        "name firstName lastName handle avatar points badges bio location",
      )
      .lean();

    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    // ── Author stat: total post count ────────────────────
    const authorPostCount = await Post.countDocuments({
      author: post.author._id,
    });

    // ── Author stat: follower count ──────────────────────
    const authorUser = await User.findById(post.author._id)
      .select("followers friends")
      .lean();

    // ── Seed default reactions if post has none ───────────
    if (!post.reactions || post.reactions.length === 0) {
      post.reactions = DEFAULT_REACTIONS.map((r) => ({ ...r, users: [] }));
    }

    // ── Shape reactions ───────────────────────────────────
    const reactions = post.reactions.map((r) => ({
      emoji: r.emoji,
      label: r.label,
      count: r.users?.length ?? 0,
      reacted:
        Array.isArray(r.users) && r.users.some((u) => u?.toString() === userId),
    }));

    // ── Shape replies (newest first by default) ───────────
    const replies = (post.replies || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((r) => ({
        id: r._id,
        body: r.body,
        isHelpful: r.isHelpful,
        helpfulCount: r.helpfulVotes?.length ?? 0,
        hasVoted:
          Array.isArray(r.helpfulVotes) &&
          r.helpfulVotes.some((u) => u?.toString() === userId),
        createdAt: r.createdAt,
        // author populated separately below
      }));

    // ── Shape post ────────────────────────────────────────
    const shaped = {
      id: post._id,
      type: post.type,
      status: post.status,
      title: post.title,
      body: post.body,
      tags: post.tags,
      views: post.views,
      replyCount: post.replyCount,
      saveCount: post.saves?.length ?? 0,
      isSaved:
        Array.isArray(post.saves) &&
        post.saves.some((s) => s?.toString() === userId),
      reactions,
      resources: post.resources || [],
      replies,
      author: {
        id: post.author._id,
        name:
          post.author.name ||
          `${post.author.firstName} ${post.author.lastName}`.trim(),
        handle: post.author.handle,
        avatar: post.author.avatar,
        points: post.author.points,
        badges: post.author.badges,
        bio: post.author.bio,
        location: post.author.location,
        postCount: authorPostCount,
        friendCount: authorUser?.friends?.length ?? 0,
        followerCount: authorUser?.followers?.length ?? 0,
        isFollowed:
          Array.isArray(authorUser?.followers) &&
          authorUser.followers.some((f) => f?.toString() === userId),
      },
      createdAt: post.createdAt,
    };

    return res.status(200).json({ success: true, post: shaped });
  } catch (err) {
    console.error("[getPostDetail]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/post-detail/:id/views
   Increments the view counter. Called once on page load.
   A real implementation would use a session cookie or Redis
   to prevent double-counting; here we increment on every call.
───────────────────────────────────────────────────────── */
exports.incrementViews = async (req, res) => {
  try {
    await Post.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    // Broadcast updated view count to all users in the post room
    const io = req.app.get("io");
    if (io) {
      const post = await Post.findById(req.params.id).select("views").lean();
      if (post)
        io.to(`post:${req.params.id}`).emit("post:views", {
          views: post.views,
        });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[incrementViews]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/post-detail/:id/reactions
   Body: { emoji }
   Toggles the current user's reaction on the given emoji.
   Adds the user to that reaction's users[] or removes them.
───────────────────────────────────────────────────────── */
exports.toggleReaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user.userId;

    if (!emoji)
      return res
        .status(400)
        .json({ success: false, message: "emoji required" });

    const post = await Post.findById(id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    // Seed default reactions if missing
    if (!post.reactions || post.reactions.length === 0) {
      post.reactions = DEFAULT_REACTIONS.map((r) => ({ ...r, users: [] }));
    }

    const reaction = post.reactions.find((r) => r.emoji === emoji);
    if (!reaction) {
      // Add new reaction type (in case frontend sends a custom one)
      post.reactions.push({ emoji, label: emoji, users: [userId] });
    } else {
      const idx = reaction.users.findIndex(
        (u) => u?.toString() === userId.toString(),
      );
      if (idx === -1) {
        reaction.users.push(userId); // react
      } else {
        reaction.users.splice(idx, 1); // un-react
      }
    }

    await post.save();

    // Return updated reaction counts
    const updated = post.reactions.map((r) => ({
      emoji: r.emoji,
      label: r.label,
      count: r.users.length,
      reacted: r.users.some((u) => u?.toString() === userId.toString()),
    }));

    return res.status(200).json({ success: true, reactions: updated });
  } catch (err) {
    console.error("[toggleReaction]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/post-detail/:id/replies
   Query: sort ("top"|"recent"|"oldest"), page, limit
   Returns paginated replies with author info populated.
───────────────────────────────────────────────────────── */
exports.getReplies = async (req, res) => {
  try {
    const { id } = req.params;
    const { sort = "top", page = 1, limit = 10 } = req.query;
    const userId = req.user.userId.toString();

    const post = await Post.findById(id)
      .populate(
        "replies.author",
        "name firstName lastName handle avatar points badges",
      )
      .lean();

    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    let replies = post.replies || [];

    // ── Sort ──────────────────────────────────────────────
    if (sort === "top")
      replies = replies.sort(
        (a, b) => (b.helpfulVotes?.length ?? 0) - (a.helpfulVotes?.length ?? 0),
      );
    if (sort === "recent")
      replies = replies.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
    if (sort === "oldest")
      replies = replies.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      );

    // ── Paginate ──────────────────────────────────────────
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)));
    const total = replies.length;
    const paged = replies.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    const shaped = paged.map((r) => ({
      id: r._id,
      body: r.body,
      isHelpful: r.isHelpful,
      helpfulCount: r.helpfulVotes?.length ?? 0,
      hasVoted:
        Array.isArray(r.helpfulVotes) &&
        r.helpfulVotes.some((u) => u?.toString() === userId),
      createdAt: r.createdAt,
      author: r.author
        ? {
            id: r.author._id,
            name:
              r.author.name ||
              `${r.author.firstName} ${r.author.lastName}`.trim(),
            handle: r.author.handle,
            avatar: r.author.avatar,
            points: r.author.points,
            badges: r.author.badges,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      replies: shaped,
      total,
      page: pageNum,
      hasMore: pageNum * limitNum < total,
    });
  } catch (err) {
    console.error("[getReplies]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   PATCH /api/post-detail/:id/replies/:replyId/helpful
   Toggles the helpful vote on a single reply.
   Uses $addToSet / $pull on helpfulVotes[].
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

    const alreadyVoted = reply.helpfulVotes.some(
      (u) => u?.toString() === userId.toString(),
    );
    if (alreadyVoted) {
      reply.helpfulVotes.pull(userId);
      reply.isHelpful = reply.helpfulVotes.length > 0;
    } else {
      reply.helpfulVotes.push(userId);
      reply.isHelpful = true;
    }

    await post.save();

    return res.status(200).json({
      success: true,
      helpfulCount: reply.helpfulVotes.length,
      hasVoted: !alreadyVoted,
      isHelpful: reply.isHelpful,
    });
  } catch (err) {
    console.error("[toggleReplyHelpful]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/post-detail/:id/related
   Returns up to 3 posts with the same type, excluding this post.
   Used for the "Related Posts" sidebar widget.
───────────────────────────────────────────────────────── */
exports.getRelated = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).lean();
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    const related = await Post.find({
      _id: { $ne: post._id },
      type: post.type,
      status: "active",
    })
      .sort({ replyCount: -1 })
      .limit(3)
      .populate("author", "name firstName lastName handle")
      .lean();

    const shaped = related.map((p) => ({
      id: p._id,
      title: p.title,
      type: p.type,
      meta: `${p.author?.name || p.author?.firstName || "Unknown"} · ${_timeAgo(p.createdAt)}`,
    }));

    return res.status(200).json({ success: true, related: shaped });
  } catch (err) {
    console.error("[getRelated]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Helper used server-side to format dates for related posts
function _timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d < 1) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return `${Math.floor(d / 7)} week${Math.floor(d / 7) !== 1 ? "s" : ""} ago`;
}
