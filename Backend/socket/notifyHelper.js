// Backend/socket/notifyHelper.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   A tiny helper that other controllers import to emit a real-time notification
//   and persist it to MongoDB in one call.
//
//   Usage example (from postDetailController when a reply is posted):
//     const { emitNotification } = require("../socket/notifyHelper");
//     await emitNotification(io, {
//       recipient: post.author,
//       actor:     req.user.userId,
//       type:      "reply",
//       refPost:   post._id,
//       message:   `${actorName} replied to your post "${post.title}"`,
//     });
//
//   The io instance is attached to app in server.js:
//     app.set("io", io)  →  req.app.get("io")  or imported directly
// ─────────────────────────────────────────────────────────────────────────────
const Notification = require("../models/Notification");

/**
 * Persists a notification to MongoDB and emits it in real-time
 * to the recipient's personal socket room (user:{recipientId}).
 *
 * @param {import("socket.io").Server} io
 * @param {{ recipient, actor, type, refPost, message }} data
 */
async function emitNotification(
  io,
  { recipient, actor, type, refPost = null, message },
) {
  try {
    // ── Persist ──────────────────────────────────────────
    const notif = await Notification.create({
      recipient,
      actor: actor || null,
      type,
      refPost: refPost || null,
      message,
    });

    // ── Unread count for badge ────────────────────────────
    const unreadCount = await Notification.countDocuments({
      recipient,
      isRead: false,
    });

    const recipientRoom = `user:${recipient.toString()}`;

    // ── Emit new notification object ─────────────────────
    io.to(recipientRoom).emit("notif:new", {
      id: notif._id,
      type: notif.type,
      message: notif.message,
      refPost: notif.refPost,
      createdAt: notif.createdAt,
    });

    // ── Emit updated unread badge count ──────────────────
    io.to(recipientRoom).emit("notif:count", { count: unreadCount });
  } catch (err) {
    // Never crash the calling controller
    console.error("[emitNotification]", err.message);
  }
}

module.exports = { emitNotification };
