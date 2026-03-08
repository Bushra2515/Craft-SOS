// Backend/controllers/postEditController.js
// ONE export only: getPostForEdit
// updatePost / deletePost / incrementViews already exist in postController.js
const mongoose = require("mongoose");
const Post = require("../models/Post");

/* ─────────────────────────────────────────────────────────
   GET /api/posts/:id/edit
   Load the full post for the edit form — author only.

   BUG FIXED: original code called post.toPublic() which does
   not exist on the Post model → 500 crash. Now shapes the
   response manually (same pattern as postDetailController).
───────────────────────────────────────────────────────── */
const getPostForEdit = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid post ID." });
    }

    // ⚠️  Do NOT use .lean() here — we need the Mongoose doc to access
    //     subdocument helpers. But we shape the response ourselves.
    const post = await Post.findById(id).populate(
      "author",
      "name handle avatar points badges",
    );

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found." });
    }

    // req.user.userId set by authMiddleware.js
    if (post.author._id.toString() !== req.user.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorised to edit this post.",
      });
    }

    // ── Shape the response ───────────────────────────────
    // Matches exactly what populateForm() in edit-post.js expects:
    //   post.type, .title, .body, .tags[], .status, .createdAt, .author
    const userId = req.user.userId.toString();

    const shaped = {
      id: post._id,
      type: post.type,
      title: post.title,
      body: post.body,
      tags: post.tags || [],
      status: post.status,
      views: post.views || 0,
      saveCount: (post.saves || []).length,
      isSaved: (post.saves || []).some((s) => s?.toString() === userId),
      createdAt: post.createdAt,
      author: {
        id: post.author._id,
        name: post.author.name,
        handle: post.author.handle,
        avatar: post.author.avatar,
        points: post.author.points || 0,
        badges: post.author.badges || [],
      },
    };

    return res.status(200).json({ success: true, data: shaped });
  } catch (err) {
    console.error("[getPostForEdit]", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// Export ONLY getPostForEdit.
// DO NOT export updatePost / deletePost / incrementViews — they already
// exist in postController.js. Re-exporting them here causes
// "Identifier already declared" SyntaxError in postRoutes.js.
module.exports = { getPostForEdit };
