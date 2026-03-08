// // Backend/controllers/chatController.js
// // ─────────────────────────────────────────────────────────────────────────────
// // REST endpoints — called once on page load to hydrate the UI.
// // All real-time messaging is handled by socketManager.js.
// //
// // Routes (chatRoutes.js):
// //   GET  /api/chat/conversations  → sidebar conversation list
// //   GET  /api/chat/unread-total   → badge count for nav
// //   GET  /api/chat/:friendId      → paginated message history (friend-gated)
// // ─────────────────────────────────────────────────────────────────────────────
// const mongoose = require("mongoose");
// const Message = require("../models/Message");
// const User = require("../models/User");

// /* ─────────────────────────────────────────────────────────
//    GET /api/chat/conversations
//    Returns the most-recent message from every conversation
//    the current user is part of, sorted newest-first.
// ───────────────────────────────────────────────────────── */
// exports.getConversations = async (req, res) => {
//   try {
//     const uid = new mongoose.Types.ObjectId(req.user.userId);

//     const convos = await Message.aggregate([
//       // Only messages involving this user
//       { $match: { $or: [{ sender: uid }, { recipient: uid }] } },

//       { $sort: { createdAt: -1 } },

//       // One doc per conversation (latest message)
//       {
//         $group: {
//           _id: "$roomId",
//           lastMessage: { $first: "$$ROOT" },
//           unreadCount: {
//             $sum: {
//               $cond: [
//                 {
//                   $and: [
//                     { $eq: ["$isRead", false] },
//                     { $eq: ["$recipient", uid] },
//                   ],
//                 },
//                 1,
//                 0,
//               ],
//             },
//           },
//         },
//       },

//       { $sort: { "lastMessage.createdAt": -1 } },
//       { $limit: 50 },
//     ]);

//     // Populate the other user's info for each conversation
//     const shaped = await Promise.all(
//       convos.map(async (c) => {
//         const lm = c.lastMessage;
//         const otherId =
//           lm.sender.toString() === req.user.userId ? lm.recipient : lm.sender;

//         const other = await User.findById(otherId)
//           .select("name handle avatar")
//           .lean();

//         return {
//           roomId: c._id,
//           friendId: String(otherId),
//           friend: {
//             name: other?.name ?? "Unknown",
//             handle: other?.handle ?? "",
//             avatar: other?.avatar ?? null,
//           },
//           lastMessage: {
//             body: lm.body,
//             imageUrl: lm.imageUrl ?? null,
//             createdAt: lm.createdAt,
//             isMine: lm.sender.toString() === req.user.userId,
//           },
//           unreadCount: c.unreadCount,
//         };
//       }),
//     );

//     return res.status(200).json({ success: true, conversations: shaped });
//   } catch (err) {
//     console.error("[getConversations]", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/chat/unread-total
//    Total unread messages for the nav badge.
// ───────────────────────────────────────────────────────── */
// exports.getUnreadTotal = async (req, res) => {
//   try {
//     const count = await Message.countDocuments({
//       recipient: req.user.userId,
//       isRead: false,
//     });
//     return res.status(200).json({ success: true, count });
//   } catch (err) {
//     console.error("[getUnreadTotal]", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/chat/:friendId?page=1
//    Paginated history. Friend gate enforced here too.
// ───────────────────────────────────────────────────────── */
// exports.getHistory = async (req, res) => {
//   try {
//     const { userId } = req.user;
//     const { friendId } = req.params;
//     const page = Math.max(1, parseInt(req.query.page) || 1);
//     const limit = 40;

//     if (!mongoose.Types.ObjectId.isValid(friendId)) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid friend ID" });
//     }

//     // Friend gate
//     const me = await User.findById(userId).select("friends").lean();
//     const ok = me?.friends?.some((id) => id.toString() === friendId);
//     if (!ok) {
//       return res.status(403).json({
//         success: false,
//         message: "You must be friends to view this conversation.",
//       });
//     }

//     const roomId = Message.roomId(userId, friendId);
//     const total = await Message.countDocuments({ roomId });

//     const msgs = await Message.find({ roomId })
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(limit)
//       .lean();

//     msgs.reverse(); // chronological

//     return res.status(200).json({
//       success: true,
//       messages: msgs.map((m) => ({
//         id: m._id,
//         body: m.body,
//         imageUrl: m.imageUrl ?? null,
//         sender: m.sender,
//         recipient: m.recipient,
//         isRead: m.isRead,
//         createdAt: m.createdAt,
//         isMine: m.sender.toString() === userId,
//       })),
//       page,
//       hasMore: page * limit < total,
//       total,
//     });
//   } catch (err) {
//     console.error("[getHistory]", err);
//     return res.status(500).json({ success: false, message: "Server error" });
//   }
// };
// Backend/controllers/chatController.js
// ─────────────────────────────────────────────────────────────────────────────
// REST endpoints — called once on page load to hydrate the UI.
// All real-time messaging is handled by socketManager.js.
//
// Routes (chatRoutes.js):
//   GET  /api/chat/conversations  → sidebar conversation list
//   GET  /api/chat/unread-total   → badge count for nav
//   GET  /api/chat/:friendId      → paginated message history (friend-gated)
// ─────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");

/* ─────────────────────────────────────────────────────────
   GET /api/chat/conversations
   Returns the most-recent message from every conversation
   the current user is part of, sorted newest-first.
───────────────────────────────────────────────────────── */
exports.getConversations = async (req, res) => {
  try {
    const uid = new mongoose.Types.ObjectId(req.user.userId);

    const convos = await Message.aggregate([
      // Only messages involving this user
      { $match: { $or: [{ sender: uid }, { recipient: uid }] } },

      { $sort: { createdAt: -1 } },

      // One doc per conversation (latest message)
      {
        $group: {
          _id: "$roomId",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$isRead", false] },
                    { $eq: ["$recipient", uid] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },

      { $sort: { "lastMessage.createdAt": -1 } },
      { $limit: 50 },
    ]);

    // Populate the other user's info for each conversation
    const shaped = await Promise.all(
      convos.map(async (c) => {
        const lm = c.lastMessage;
        const otherId =
          lm.sender.toString() === req.user.userId ? lm.recipient : lm.sender;

        const other = await User.findById(otherId)
          .select("name handle avatar")
          .lean();

        return {
          roomId: c._id,
          friendId: String(otherId),
          friend: {
            name: other?.name ?? "Unknown",
            handle: other?.handle ?? "",
            avatar: other?.avatar ?? null,
          },
          lastMessage: {
            body: lm.body,
            imageUrl: lm.imageUrl ?? null,
            createdAt: lm.createdAt,
            isMine: lm.sender.toString() === req.user.userId,
          },
          unreadCount: c.unreadCount,
        };
      }),
    );

    return res.status(200).json({ success: true, conversations: shaped });
  } catch (err) {
    console.error("[getConversations]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/chat/unread-total
   Total unread messages for the nav badge.
───────────────────────────────────────────────────────── */
exports.getUnreadTotal = async (req, res) => {
  try {
    const count = await Message.countDocuments({
      recipient: req.user.userId,
      isRead: false,
    });
    return res.status(200).json({ success: true, count });
  } catch (err) {
    console.error("[getUnreadTotal]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/chat/:friendId?page=1
   Paginated history. Friend gate enforced here too.
───────────────────────────────────────────────────────── */
exports.getHistory = async (req, res) => {
  try {
    const { userId } = req.user;
    const { friendId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 40;

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid friend ID" });
    }

    // Friend gate — check and return rich info for the "not friends" card
    const [me, targetUser] = await Promise.all([
      User.findById(userId).select("friends friendRequests").lean(),
      User.findById(friendId)
        .select("name firstName lastName handle avatar friendRequests isActive")
        .lean(),
    ]);

    const isFriend = me?.friends?.some((id) => id.toString() === friendId);
    if (!isFriend) {
      // Compute friendship state so the chat page can show the right button
      const myFriends = (me?.friends || []).map(String);
      const myReqs = (me?.friendRequests || []).map(String);
      const theirReqs = (targetUser?.friendRequests || []).map(String);

      let friendStatus = "none";
      if (myFriends.includes(friendId))
        friendStatus = "friends"; // shouldn't reach, but safe
      else if (theirReqs.includes(userId)) friendStatus = "pending_sent";
      else if (myReqs.includes(friendId)) friendStatus = "pending_received";

      const targetName = targetUser
        ? targetUser.name ||
          `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim() ||
          targetUser.handle ||
          "Crafter"
        : "This user";

      return res.status(403).json({
        success: false,
        notFriends: true,
        friendStatus,
        message: "You must be friends with this user to start a chat.",
        user: targetUser
          ? {
              id: targetUser._id,
              name: targetName,
              handle: targetUser.handle || "",
              avatar: targetUser.avatar || "",
            }
          : null,
      });
    }

    const roomId = Message.roomId(userId, friendId);
    const total = await Message.countDocuments({ roomId });

    const msgs = await Message.find({ roomId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    msgs.reverse(); // chronological

    return res.status(200).json({
      success: true,
      messages: msgs.map((m) => ({
        id: m._id,
        body: m.body,
        imageUrl: m.imageUrl ?? null,
        sender: m.sender,
        recipient: m.recipient,
        isRead: m.isRead,
        createdAt: m.createdAt,
        isMine: m.sender.toString() === userId,
      })),
      page,
      hasMore: page * limit < total,
      total,
    });
  } catch (err) {
    console.error("[getHistory]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
