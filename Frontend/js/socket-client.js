// // Frontend/js/socket-client.js
// // ─────────────────────────────────────────────────────────────────────────────
// // What this file does:
// //   A shared Socket.io singleton used by every page that needs real-time.
// //   Import / include this BEFORE page-specific scripts.
// //
// //   Features:
// //   • Auto-connects with JWT from localStorage
// //   • Reconnect with exponential back-off (handled by socket.io client)
// //   • Exposes global `window.craftSocket` for page scripts to use
// //   • Updates notification badge automatically on notif:count
// //   • Shows toast on notif:new
// //   • Updates Messages badge on chat:message when chat page is not open
// //
// //   Usage in another JS file:
// //     const socket = window.craftSocket;
// //     socket.emit("post:join", { postId: "abc123" });
// //     socket.on("comment:new",  (data) => { ... });
// //
// //   CDN for socket.io client (added to HTML pages):
// //     <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
// //     <script src="../js/socket-client.js"></script>
// // ─────────────────────────────────────────────────────────────────────────────
// (function () {
//   "use strict";

//   const SERVER = "http://localhost:5000";
//   const token = localStorage.getItem("token");

//   // Don't connect if not logged in (login/register pages)
//   if (!token) return;

//   /* ─── Connect ─────────────────────────────────────── */
//   const socket = io(SERVER, {
//     auth: { token },
//     reconnection: true,
//     reconnectionDelay: 1000,
//     reconnectionDelayMax: 10000,
//     reconnectionAttempts: Infinity,
//   });

//   /* ─── Expose globally ─────────────────────────────── */
//   window.craftSocket = socket;

//   /* ─── Connection lifecycle ────────────────────────── */
//   socket.on("connect", () => {
//     console.log("[socket] connected:", socket.id);
//   });

//   socket.on("connect_error", (err) => {
//     console.warn("[socket] connection error:", err.message);
//   });

//   socket.on("disconnect", (reason) => {
//     console.log("[socket] disconnected:", reason);
//   });

//   /* ─── Notification badge ──────────────────────────── */
//   // notif:count → updates the red badge on the bell icon in every topbar
//   socket.on("notif:count", ({ count }) => {
//     const badge = document.getElementById("notif-badge");
//     if (!badge) return;
//     badge.textContent = count > 99 ? "99+" : count;
//     badge.style.display = count > 0 ? "flex" : "none";
//   });

//   /* ─── Toast on new notification ──────────────────── */
//   socket.on("notif:new", (notif) => {
//     showToast(notif.message, "notif");
//   });

//   /* ─── Chat unread badge ───────────────────────────── */
//   // When a chat:message arrives on the user's personal room
//   // and the chat page is NOT open, bump the Messages nav badge.
//   socket.on("chat:message", (msg) => {
//     // If the chat page is already open it handles this itself
//     if (window._chatPageActive) return;
//     if (msg.isMine) return;

//     const chatBadge = document.getElementById("chat-badge");
//     if (!chatBadge) return;
//     const cur = parseInt(chatBadge.textContent) || 0;
//     chatBadge.textContent = cur + 1;
//     chatBadge.style.display = "flex";
//   });

//   /* ─── Shared toast utility ────────────────────────── */
//   function showToast(message, type = "info") {
//     // Remove existing toast
//     document.getElementById("craft-toast")?.remove();

//     const colors = {
//       notif: "#7a8f52",
//       error: "#c0392b",
//       info: "#3d5a99",
//       success: "#27ae60",
//     };

//     const toast = document.createElement("div");
//     toast.id = "craft-toast";
//     toast.textContent = message;
//     toast.style.cssText = `
//       position:fixed;bottom:24px;right:24px;z-index:99999;
//       background:${colors[type] || colors.info};color:#fff;
//       padding:12px 20px;border-radius:12px;font-size:.88rem;font-family:sans-serif;
//       box-shadow:0 6px 24px rgba(0,0,0,.18);max-width:340px;
//       animation:slideUp .25s ease;cursor:pointer;`;

//     toast.onclick = () => toast.remove();
//     document.body.appendChild(toast);
//     setTimeout(() => toast?.remove(), 4500);
//   }

//   // Expose toast globally (pages can call it)
//   window.craftToast = showToast;
// })();
// Frontend/js/socket-client.js
// Shared Socket.io singleton — include BEFORE page-specific scripts.
(function () {
  "use strict";

  const SERVER = "http://localhost:5000";
  const API_BASE = "http://localhost:5000/api";
  const token = localStorage.getItem("token");
  if (!token) return;

  /* ─── Connect ─────────────────────────────────────── */
  const socket = io(SERVER, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity,
  });
  window.craftSocket = socket;

  socket.on("connect", () => console.log("[socket] connected:", socket.id));
  socket.on("connect_error", (err) =>
    console.warn("[socket] error:", err.message),
  );
  socket.on("disconnect", (r) => console.log("[socket] disconnected:", r));

  /* ─── Notification badge ──────────────────────────── */
  socket.on("notif:count", ({ count }) => {
    document
      .querySelectorAll("#notif-badge, .notif-badge-live")
      .forEach((b) => {
        b.textContent = count > 99 ? "99+" : count;
        b.style.display = count > 0 ? "flex" : "none";
      });
    const dot = document.getElementById("topbar-notif-dot");
    if (dot) dot.style.display = count > 0 ? "block" : "none";
    if (window._notifPanelOpen && window._refreshNotifPanel)
      window._refreshNotifPanel();
  });

  /* ─── New notification ────────────────────────────── */
  socket.on("notif:new", (notif) => {
    if (notif.type === "friend_request") {
      showFriendRequestToast(notif);
    } else {
      showToast(notif.message, "notif");
    }
    if (window._notifPanelOpen && window._refreshNotifPanel)
      window._refreshNotifPanel();
  });

  /* ─── Chat badge (other pages) ────────────────────── */
  socket.on("chat:message", (msg) => {
    if (window._chatPageActive) return;
    if (msg.isMine) return;
    document.querySelectorAll("#chat-badge").forEach((b) => {
      const cur = parseInt(b.textContent) || 0;
      b.textContent = cur + 1;
      b.style.display = "flex";
    });
  });

  /* ═══════════════════════════════════════════════════
     FRIEND-REQUEST RICH TOAST
  ═══════════════════════════════════════════════════ */
  function showFriendRequestToast(notif) {
    const actor = notif.actor || {};
    const name = actor.name || actor.handle || "Someone";
    const actorId = String(actor._id || actor.id || "");

    document.getElementById("craft-freq-toast")?.remove();

    const COLORS = [
      "#b5c98a",
      "#a8c4d8",
      "#d4b8e0",
      "#f0c07a",
      "#c8a98a",
      "#9ec4a0",
      "#f7b8a2",
      "#c9d8b6",
    ];
    function colorFor(id) {
      let h = 0;
      for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
      return COLORS[h % COLORS.length];
    }
    function initials(n) {
      return (
        n
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2) || "?"
      ).toUpperCase();
    }

    const avStyle = actor.avatar
      ? "background:url(" + actor.avatar + ") center/cover no-repeat;"
      : "background:" +
        colorFor(actorId) +
        ";display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem;";

    const card = document.createElement("div");
    card.id = "craft-freq-toast";
    card.style.cssText = [
      "position:fixed;bottom:28px;right:24px;z-index:99999;",
      "background:#fff;border-radius:16px;",
      "box-shadow:0 8px 32px rgba(0,0,0,.18),0 1px 6px rgba(0,0,0,.08);",
      "padding:16px 18px;min-width:300px;max-width:340px;",
      "font-family:inherit;animation:_freqSlide .28s cubic-bezier(.34,1.4,.64,1) both;",
    ].join("");

    card.innerHTML = [
      "<style>",
      "@keyframes _freqSlide{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}",
      "#craft-freq-toast .ft-av{width:44px;height:44px;border-radius:50%;flex-shrink:0;}",
      "#craft-freq-toast .ft-btn{padding:7px 16px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer;border:none;transition:opacity .15s;}",
      "#craft-freq-toast .ft-btn:hover{opacity:.85;}",
      "#craft-freq-toast .ft-btn.accept{background:#7a8f52;color:#fff;}",
      "#craft-freq-toast .ft-btn.decline{background:none;color:#c0392b;border:1.5px solid #e0b0a8;}",
      "#craft-freq-toast .ft-close{position:absolute;top:10px;right:12px;background:none;border:none;cursor:pointer;font-size:1rem;color:#aaa;line-height:1;padding:2px 4px;}",
      "#craft-freq-toast .ft-close:hover{color:#555;}",
      "</style>",
      "<div style='position:relative;'>",
      "<button class='ft-close' id='_freq_close'>✕</button>",
      "<div style='display:flex;align-items:center;gap:12px;margin-bottom:12px;'>",
      "<div class='ft-av' style='" +
        avStyle +
        "'>" +
        (actor.avatar ? "" : initials(name)) +
        "</div>",
      "<div>",
      "<div style='font-size:.8rem;color:#9a9a7a;margin-bottom:1px;'>👋 Friend Request</div>",
      "<div style='font-weight:700;font-size:.95rem;color:#2d3520;line-height:1.3;'>" +
        _esc(name) +
        "</div>",
      actor.handle
        ? "<div style='font-size:.77rem;color:#8fa45a;'>@" +
          _esc(actor.handle.replace(/^@+/, "")) +
          "</div>"
        : "",
      "</div>",
      "</div>",
      "<div style='display:flex;gap:8px;align-items:center;'>",
      "<button class='ft-btn accept' id='_freq_accept'>Accept</button>",
      "<button class='ft-btn decline' id='_freq_decline'>Decline</button>",
      actorId
        ? "<a href='pages/crafter-profile.html?id=" +
          actorId +
          "' style='margin-left:auto;font-size:.76rem;color:#8fa45a;text-decoration:none;white-space:nowrap;'>View →</a>"
        : "",
      "</div>",
      "</div>",
    ].join("");

    document.body.appendChild(card);
    const autoDismiss = setTimeout(() => card?.remove(), 12000);

    card.querySelector("#_freq_close")?.addEventListener("click", () => {
      clearTimeout(autoDismiss);
      card.remove();
    });

    card.querySelector("#_freq_accept")?.addEventListener("click", async () => {
      if (!actorId) return;
      const btn = card.querySelector("#_freq_accept");
      btn.textContent = "…";
      btn.disabled = true;
      try {
        await _apiPost("/crafter/" + actorId + "/accept");
        clearTimeout(autoDismiss);
        card.innerHTML =
          "<div style='text-align:center;padding:10px 4px;color:#5a6e2a;font-size:.9rem;font-weight:600;'>✓ Now friends with " +
          _esc(name) +
          "! 🎉</div>";
        setTimeout(() => card?.remove(), 2200);
        if (typeof loadFriendRequests === "function") loadFriendRequests();
        showToast("You and " + name + " are now friends!", "success");
      } catch (e) {
        btn.textContent = "Accept";
        btn.disabled = false;
        showToast(e.message || "Could not accept", "error");
      }
    });

    card
      .querySelector("#_freq_decline")
      ?.addEventListener("click", async () => {
        if (!actorId) return;
        const btn = card.querySelector("#_freq_decline");
        btn.disabled = true;
        try {
          await _apiPost("/crafter/" + actorId + "/decline");
          clearTimeout(autoDismiss);
          card.remove();
        } catch (e) {
          btn.disabled = false;
        }
      });
  }

  /* ─── Internal helpers ────────────────────────────── */
  function _esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  async function _apiPost(path) {
    const r = await fetch(API_BASE + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || "Request failed");
    return d;
  }

  /* ─── Shared toast ────────────────────────────────── */
  function showToast(message, type) {
    document.getElementById("craft-toast")?.remove();
    const CLRS = {
      notif: "#7a8f52",
      error: "#c0392b",
      info: "#3d5a99",
      success: "#27ae60",
    };
    const t = document.createElement("div");
    t.id = "craft-toast";
    t.style.cssText =
      "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99998;background:" +
      (CLRS[type] || CLRS.info) +
      ";color:#fff;padding:11px 22px;border-radius:14px;font-size:.88rem;font-weight:600;font-family:inherit;box-shadow:0 6px 24px rgba(0,0,0,.18);max-width:360px;text-align:center;cursor:pointer;";
    t.textContent = message;
    t.onclick = () => t.remove();
    document.body.appendChild(t);
    setTimeout(() => t?.remove(), 4000);
  }
  window.craftToast = showToast;
})();
