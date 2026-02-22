// const Post = require("../models/Post");

// // ================= CREATE POST =================
// exports.createPost = async (req, res) => {
//   try {
//     const { type, title, body, tags } = req.body;

//     // 1️⃣ Validate
//     if (!type || !title || !body) {
//       return res.status(400).json({
//         message: "Type, title and body are required",
//       });
//     }

//     // 2️⃣ Create Post
//     const post = await Post.create({
//       author: req.userId,
//       type,
//       title,
//       body,
//       tags: tags || [],
//     });

//     res.status(201).json(post.toPublic(req.userId));
//   } catch (error) {
//     console.error("Create Post Error:", error);
//     res.status(500).json({
//       message: "Server error",
//     });
//   }
// };

// // ================= GET FEED =================
// exports.getFeed = async (req, res) => {
//   try {
//     const posts = await Post.find({ status: "active" })
//       .populate("author", "name")
//       .sort({ createdAt: -1 });

//     const formatted = posts.map((post) => post.toPublic(req.userId));

//     res.status(200).json(formatted);
//   } catch (error) {
//     res.status(500).json({
//       message: "Server error",
//     });
//   }
// };

// // ================= ADD REPLY =================
// exports.addReply = async (req, res) => {
//   try {
//     const { body } = req.body;
//     const { postId } = req.params;

//     if (!body) {
//       return res.status(400).json({
//         message: "Reply body required",
//       });
//     }

//     const post = await Post.findById(postId);

//     if (!post) {
//       return res.status(404).json({
//         message: "Post not found",
//       });
//     }

//     post.replies.push({
//       author: req.userId,
//       body,
//     });

//     post.replyCount = post.replies.length;

//     await post.save();

//     res.status(200).json(post.toPublic(req.userId));
//   } catch (error) {
//     res.status(500).json({
//       message: "Server error",
//     });
//   }
// };

// Backend/controllers/postController.js
const Post = require("../models/Post");
const User = require("../models/User");

/* ─────────────────────────────────────────────────────────────
   TYPE MAP
   HTML form values  →  Post model enum values
   "tutorial"  → "tut"
   "community" → "com"
   "resource"  → "res"
   "sos"       → "sos"
───────────────────────────────────────────────────────────── */
const TYPE_MAP = {
  sos: "sos",
  tutorial: "tut",
  community: "com",
  resource: "res",
  // accept shorthand too (for API clients)
  tut: "tut",
  com: "com",
  res: "res",
};

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

/** Normalise and deduplicate a tags value coming from the form.
 *  Accepts a comma-separated string OR an array.            */
function parseTags(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : raw.split(",");
  return [...new Set(arr.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/** Parse a repeated FormData key that express sends as array or single value */
function parseArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

/* ─────────────────────────────────────────────────────────────
   CREATE POST
   POST /api/posts
   Body: { type, title, body, tags, priority?, categories? }
   Auth: required  →  req.userId must be set by auth middleware
───────────────────────────────────────────────────────────── */
const createPost = async (req, res) => {
  try {
    const { type, title, body, tags, priority, categories } = req.body;

    // ── Validate type ─────────────────────────────────────
    const mappedType = TYPE_MAP[type];
    if (!mappedType) {
      return res.status(400).json({
        success: false,
        message: `Invalid post type "${type}". Allowed: sos, tutorial, community, resource`,
      });
    }

    const post = await Post.create({
      author: req.userId, // set by auth middleware
      type: mappedType,
      title: title?.trim(),
      body: body?.trim(),
      tags: parseTags(tags),
      // priority & categories are UI-only metadata not in the Post schema.
      // Store them inside the body or extend the schema later if needed.
    });

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      data: post.toPublic(req.userId),
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, errors });
    }
    console.error("[createPost]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET ALL POSTS  (feed)
   GET /api/posts?type=sos&status=active&tag=wool&search=text
   Auth: required
───────────────────────────────────────────────────────────── */
const getPosts = async (req, res) => {
  try {
    const { type, status, tag, search, page = 1, limit = 20 } = req.query;

    const filter = {};

    if (type) filter.type = TYPE_MAP[type] || type;
    if (status) filter.status = status;
    if (tag) filter.tags = { $in: [tag.toLowerCase()] };
    if (search)
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];

    const skip = (Number(page) - 1) * Number(limit);

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("author", "username handle avatar"),
      Post.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: posts.map((p) => p.toPublic(req.userId)),
    });
  } catch (err) {
    console.error("[getPosts]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET SINGLE POST
   GET /api/posts/:id
   Auth: required  —  also increments view count
───────────────────────────────────────────────────────────── */
const getPostById = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true },
    )
      .populate("author", "name handle avatar")
      .populate("replies.author", "name handle avatar");

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    return res.status(200).json({
      success: true,
      data: post.toPublic(req.userId),
    });
  } catch (err) {
    console.error("[getPostById]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────
   UPDATE POST
   PUT /api/posts/:id
   Auth: required  +  must be post owner
───────────────────────────────────────────────────────────── */
const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    // Only the author may edit
    if (post.author.toString() !== req.userId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorised" });
    }

    const { title, body, tags, type } = req.body;

    if (title) post.title = title.trim();
    if (body) post.body = body.trim();
    if (tags) post.tags = parseTags(tags);
    if (type) {
      const mapped = TYPE_MAP[type];
      if (!mapped)
        return res
          .status(400)
          .json({ success: false, message: "Invalid type" });
      post.type = mapped;
    }

    await post.save();

    return res.status(200).json({
      success: true,
      message: "Post updated",
      data: post.toPublic(req.userId),
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, errors });
    }
    console.error("[updatePost]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────
   DELETE POST
   DELETE /api/posts/:id
   Auth: required  +  must be post owner
───────────────────────────────────────────────────────────── */
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    if (post.author.toString() !== req.userId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorised" });
    }

    await post.deleteOne();

    return res.status(200).json({ success: true, message: "Post deleted" });
  } catch (err) {
    console.error("[deletePost]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────
   MARK RESOLVED
   PATCH /api/posts/:id/resolve
   Auth: required  +  must be post owner
───────────────────────────────────────────────────────────── */
const resolvePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    if (post.author.toString() !== req.userId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorised" });
    }

    post.status = "resolved";
    post.resolvedAt = new Date();
    post.resolvedBy = req.userId;
    await post.save();

    return res.status(200).json({
      success: true,
      message: "Post marked as resolved",
      data: post.toPublic(req.userId),
    });
  } catch (err) {
    console.error("[resolvePost]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────
   SAVE / UNSAVE  (bookmark toggle)
   PATCH /api/posts/:id/save
   Auth: required
───────────────────────────────────────────────────────────── */
const toggleSave = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    const userId = req.userId;
    const alreadySaved = post.saves.some(
      (id) => id.toString() === userId.toString(),
    );

    if (alreadySaved) {
      post.saves = post.saves.filter(
        (id) => id.toString() !== userId.toString(),
      );
    } else {
      post.saves.push(userId);
    }

    await post.save();

    return res.status(200).json({
      success: true,
      saved: !alreadySaved,
      saveCount: post.saves.length,
    });
  } catch (err) {
    console.error("[toggleSave]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────────
   ADD REPLY
   POST /api/posts/:id/replies
   Body: { body }
   Auth: required
───────────────────────────────────────────────────────────── */
const addReply = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    if (!req.body.body?.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Reply body is required" });
    }

    post.replies.push({
      author: req.userId,
      body: req.body.body.trim(),
    });
    post.replyCount = post.replies.length; // keep denormalised count in sync
    await post.save();

    const newReply = post.replies[post.replies.length - 1];

    return res.status(201).json({
      success: true,
      message: "Reply added",
      data: newReply,
    });
  } catch (err) {
    console.error("[addReply]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "firstName lastName handle avatar username",
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    console.error("[getCurrentUser]", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  resolvePost,
  toggleSave,
  addReply,
  getCurrentUser,
};
