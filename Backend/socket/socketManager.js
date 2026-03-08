// Backend/socket/socketManager.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Central hub for ALL real-time features. Called once in server.js with the
//   socket.io Server instance.
//
//   Three feature areas handled here:
//
//   1. POST COMMENTS (room: post:{postId})
//      - Client emits post:join   → socket joins the room
//      - Client emits post:leave  → socket leaves the room
//      - Server emits comment:new → when any client in the room posts a reply
//        (triggered by postDetailController via req.app.get("io"))
//      - Server emits comment:helpful → when helpful vote changes
//
//   2. NOTIFICATIONS (room: user:{userId})
//      - Every authenticated socket automatically joins its own room on connect
//      - notifyHelper.js emits notif:new + notif:count to this room
//      - Client emits notif:read  → marks all notifications read
//
//   3. PRIVATE CHAT (room: chat:{roomId})
//      Friend gating enforced in TWO places:
//        a) chat:join  — user must be in both friends arrays
//        b) chat:message — re-checked before saving/broadcasting
//      Events:
//        chat:join     → verify friendship, join room, load last 30 messages
//        chat:message  → save to DB, broadcast to room
//        chat:typing   → forward typing indicator (not saved)
//        chat:read     → mark messages as read, emit chat:read to sender
//        chat:leave    → leave room
// ─────────────────────────────────────────────────────────────────────────────
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Notification = require("../models/Notification");

// ── Auth helper: verify JWT from socket handshake ─────────
function verifySocketToken(socket) {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.replace("Bearer ", "");

  if (!token) throw new Error("No token");
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  return payload.userId || payload.id; // match your authMiddleware shape
}

// ── Friend check helper ────────────────────────────────────
async function areFriends(userIdA, userIdB) {
  const user = await User.findById(userIdA).select("friends").lean();
  return (
    user?.friends?.some((id) => id.toString() === userIdB.toString()) ?? false
  );
}

// ── Shape a Message doc for the wire ──────────────────────
function shapeMessage(msg, senderId) {
  return {
    id: msg._id,
    roomId: msg.roomId,
    sender: msg.sender,
    recipient: msg.recipient,
    body: msg.body,
    imageUrl: msg.imageUrl || null,
    isRead: msg.isRead,
    createdAt: msg.createdAt,
    isMine: msg.sender.toString() === senderId.toString(),
  };
}

/* ═══════════════════════════════════════════════════════════
   MAIN EXPORT — called once in server.js: initSocket(io)
═══════════════════════════════════════════════════════════ */
function initSocket(io) {
  // ── Per-connection auth middleware ────────────────────
  io.use((socket, next) => {
    try {
      socket.userId = verifySocketToken(socket);
      next();
    } catch {
      next(
        new Error(
          "Authentication failed — provide a valid JWT in socket.auth.token",
        ),
      );
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    console.log(`[socket] connected  userId=${userId}  socketId=${socket.id}`);

    // ── Auto-join personal notification room ────────────
    socket.join(`user:${userId}`);

    // ── Send current unread count on connect ────────────
    Notification.countDocuments({ recipient: userId, isRead: false })
      .then((count) => socket.emit("notif:count", { count }))
      .catch(() => {});

    /* ══════════════════════════════════════════════════
       FEATURE 1 — POST COMMENTS
    ══════════════════════════════════════════════════ */

    // Join a post room to receive live comments
    socket.on("post:join", ({ postId }) => {
      if (!postId) return;
      socket.join(`post:${postId}`);
    });

    // Leave a post room (e.g. navigating away)
    socket.on("post:leave", ({ postId }) => {
      if (!postId) return;
      socket.leave(`post:${postId}`);
    });

    // ── comment:new and comment:helpful are emitted by
    //    postDetailController via io.to("post:"+id).emit(…)
    //    Nothing extra needed here.

    /* ══════════════════════════════════════════════════
       FEATURE 2 — NOTIFICATIONS
    ══════════════════════════════════════════════════ */

    // Client marks all notifications as read
    socket.on("notif:read", async () => {
      try {
        await Notification.updateMany(
          { recipient: userId, isRead: false },
          { $set: { isRead: true } },
        );
        socket.emit("notif:count", { count: 0 });
      } catch (err) {
        console.error("[socket notif:read]", err.message);
      }
    });

    /* ══════════════════════════════════════════════════
       FEATURE 3 — PRIVATE CHAT  (friend-gated)
    ══════════════════════════════════════════════════ */

    // ── chat:join ──────────────────────────────────────
    // Payload: { friendId }
    // Gate: both users must be friends.
    // On success: join room, emit last 30 messages.
    socket.on("chat:join", async ({ friendId }) => {
      try {
        if (!friendId) return;

        // ── FRIEND GATE ────────────────────────────────
        const ok = await areFriends(userId, friendId);
        if (!ok) {
          socket.emit("chat:error", {
            code: "NOT_FRIENDS",
            message: "You must be friends with this user to start a chat.",
          });
          return;
        }

        const roomId = Message.roomId(userId, friendId);
        socket.join(`chat:${roomId}`);

        // Load the last 30 messages for this room
        const history = await Message.find({ roomId })
          .sort({ createdAt: -1 })
          .limit(30)
          .lean();

        history.reverse(); // chronological order

        socket.emit("chat:history", {
          roomId,
          messages: history.map((m) => shapeMessage(m, userId)),
        });
      } catch (err) {
        console.error("[socket chat:join]", err.message);
        socket.emit("chat:error", { message: "Could not join chat." });
      }
    });

    // ── chat:message ───────────────────────────────────
    // Payload: { friendId, body, imageUrl? }
    // Gate: re-checked on every message (not just join).
    socket.on("chat:message", async ({ friendId, body, imageUrl }) => {
      try {
        if (!friendId || !body?.trim()) return;

        // ── FRIEND GATE (re-checked) ───────────────────
        const ok = await areFriends(userId, friendId);
        if (!ok) {
          socket.emit("chat:error", {
            code: "NOT_FRIENDS",
            message: "You are no longer friends. Message not sent.",
          });
          return;
        }

        const roomId = Message.roomId(userId, friendId);

        // ── Sanitise body ──────────────────────────────
        const cleanBody = body.trim().slice(0, 2000);

        // ── Save to MongoDB ────────────────────────────
        const msg = await Message.create({
          roomId,
          sender: userId,
          recipient: friendId,
          body: cleanBody,
          imageUrl: imageUrl || null,
        });

        const shaped = shapeMessage(msg, userId);

        // ── Broadcast to both users in room ───────────
        io.to(`chat:${roomId}`).emit("chat:message", shaped);

        // ── Notify recipient if not in the chat room ──
        // (they get a notif bubble even if the chat page isn't open)
        const senderUser = await User.findById(userId).select("name").lean();
        const senderName = senderUser?.name ?? "Someone";

        const recipientSockets = await io.in(`user:${friendId}`).fetchSockets();
        const recipientInChat = await io
          .in(`chat:${roomId}`)
          .fetchSockets()
          .then((socks) => socks.some((s) => s.userId === friendId));

        if (!recipientInChat) {
          io.to(`user:${friendId}`).emit("notif:new", {
            type: "message",
            message: `${senderName} sent you a message`,
            from: userId,
          });
        }
      } catch (err) {
        console.error("[socket chat:message]", err.message);
        socket.emit("chat:error", { message: "Message could not be sent." });
      }
    });

    // ── chat:typing ────────────────────────────────────
    // Payload: { friendId, isTyping }
    // Just forwards — not saved to DB.
    socket.on("chat:typing", ({ friendId, isTyping }) => {
      if (!friendId) return;
      const roomId = Message.roomId(userId, friendId);
      // Broadcast to the OTHER user in the room only
      socket.to(`chat:${roomId}`).emit("chat:typing", {
        from: userId,
        isTyping: !!isTyping,
      });
    });

    // ── chat:read ──────────────────────────────────────
    // Payload: { friendId }
    // Marks all unread messages from friendId to userId as read.
    socket.on("chat:read", async ({ friendId }) => {
      try {
        if (!friendId) return;
        const roomId = Message.roomId(userId, friendId);

        await Message.updateMany(
          { roomId, recipient: userId, isRead: false },
          { $set: { isRead: true } },
        );

        // Tell the sender their messages were read
        io.to(`user:${friendId}`).emit("chat:read", {
          roomId,
          readBy: userId,
        });
      } catch (err) {
        console.error("[socket chat:read]", err.message);
      }
    });

    // ── chat:leave ─────────────────────────────────────
    socket.on("chat:leave", ({ friendId }) => {
      if (!friendId) return;
      const roomId = Message.roomId(userId, friendId);
      socket.leave(`chat:${roomId}`);
    });

    /* ══════════════════════════════════════════════════
       DISCONNECT
    ══════════════════════════════════════════════════ */
    socket.on("disconnect", (reason) => {
      console.log(`[socket] disconnected userId=${userId} reason=${reason}`);
    });
  });
}

module.exports = { initSocket };
