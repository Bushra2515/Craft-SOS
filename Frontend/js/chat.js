// // // Frontend/js/chat.js
// // // ─────────────────────────────────────────────────────────────────────────────
// // // Replaces the entire inline <script> from the original chat HTML.
// // // Works with the EXISTING HTML structure — every CSS class is preserved.
// // //
// // // Flow:
// // //   1. DOMContentLoaded → auth guard → populate sidebar user → loadConversations()
// // //   2. loadConversations() → GET /api/chat/conversations → renderConvList()
// // //   3. openConv(friendId)  → GET /api/chat/:friendId → renderMessages()
// // //                          → socket.emit("chat:join") for live updates
// // //   4. sendMsg()           → socket.emit("chat:message")  (NOT a fetch — socket only)
// // //   5. Socket events bound in bindSocketEvents():
// // //        chat:history  → replace shimmer with real messages
// // //        chat:message  → appendBubble()
// // //        chat:typing   → show/hide typing indicator
// // //        chat:read     → mark read ticks
// // //        chat:error    → show not-friends banner
// // // ─────────────────────────────────────────────────────────────────────────────
// // "use strict";

// // /* ── Config ──────────────────────────────────────────── */
// // const API_BASE = "http://localhost:5000/api";
// // const token = localStorage.getItem("token");
// // const _me = (() => {
// //   try {
// //     return JSON.parse(localStorage.getItem("user") || "{}");
// //   } catch {
// //     return {};
// //   }
// // })();

// // // Auth guard
// // if (!token) window.location.href = "login.html";

// // // Tell socket-client.js we are on the chat page (suppresses double badge bump)
// // window._chatPageActive = true;

// // /* ── State ───────────────────────────────────────────── */
// // let _activeConv = null; // { friendId, friend, roomId, messages:[] }
// // let _convos = []; // all loaded conversations
// // let _typingTimer = null;
// // let _historyPage = 1;
// // let _historyHasMore = false;
// // let _loadingMore = false;
// // let _pendingImgUrl = null;

// // /* ═══════════════════════════════════════════════════════
// //    UTILITIES
// // ═══════════════════════════════════════════════════════ */
// // const api = async (path, opts = {}) => {
// //   const r = await fetch(`${API_BASE}${path}`, {
// //     ...opts,
// //     headers: {
// //       "Content-Type": "application/json",
// //       Authorization: `Bearer ${token}`,
// //       ...(opts.headers || {}),
// //     },
// //   });
// //   const d = await r.json();
// //   if (!r.ok) throw new Error(d.message || "Request failed");
// //   return d;
// // };

// // function initials(name = "") {
// //   return (
// //     name
// //       .trim()
// //       .split(/\s+/)
// //       .map((w) => w[0])
// //       .join("")
// //       .slice(0, 2) || "?"
// //   ).toUpperCase();
// // }

// // const COLORS = [
// //   "#b5c98a",
// //   "#a8c4d8",
// //   "#d4b8e0",
// //   "#f0c07a",
// //   "#c8a98a",
// //   "#9ec4a0",
// //   "#f7b8a2",
// //   "#c9d8b6",
// // ];
// // function colorFor(id = "") {
// //   let h = 0;
// //   for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) & 0xffffff;
// //   return COLORS[h % COLORS.length];
// // }

// // function timeAgo(iso) {
// //   if (!iso) return "";
// //   const d = Date.now() - new Date(iso).getTime();
// //   const m = Math.floor(d / 60000);
// //   if (m < 1) return "Just now";
// //   if (m < 60) return `${m}m ago`;
// //   const h = Math.floor(m / 60);
// //   if (h < 24) return `${h}h ago`;
// //   const days = Math.floor(h / 24);
// //   if (days === 1) return "Yesterday";
// //   if (days < 7)
// //     return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
// //       new Date(iso).getDay()
// //     ];
// //   return new Date(iso).toLocaleDateString();
// // }

// // function fmtTime(iso) {
// //   if (!iso) return "";
// //   return new Date(iso).toLocaleTimeString([], {
// //     hour: "2-digit",
// //     minute: "2-digit",
// //   });
// // }

// // function escHTML(s = "") {
// //   return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// // }

// // /* ═══════════════════════════════════════════════════════
// //    SIDEBAR USER INFO
// // ═══════════════════════════════════════════════════════ */
// // // function populateSidebarUser() {
// // //   const nameEl = document.querySelector(".sb-prof-name");
// // //   const subEl = document.querySelector(".sb-prof-sub");
// // //   const avEl = document.querySelector(".sb-prof-av");
// // //   const topAv = document.querySelector(".profile-avatar");

// // //   if (nameEl) nameEl.textContent = _me?.name || "You";
// // //   if (subEl) subEl.textContent = _me?.handle ? `@${_me.handle}` : "";

// // //   [avEl, topAv].forEach((el) => {
// // //     if (!el) return;
// // //     if (_me?.avatar) {
// // //       el.style.cssText += `background-image:url(${_me.avatar});background-size:cover;background-position:center;`;
// // //     } else {
// // //       el.textContent = initials(_me?.name);
// // //       el.style.background = colorFor(_me?._id || _me?.id || "me");
// // //       el.style.color = "#fff";
// // //       el.style.display = "flex";
// // //       el.style.alignItems = "center";
// // //       el.style.justifyContent = "center";
// // //       el.style.fontWeight = "700";
// // //       el.style.fontSize = ".9rem";
// // //     }
// // //   });
// // // }

// // /* ═══════════════════════════════════════════════════════
// //    LOAD CONVERSATIONS
// // ═══════════════════════════════════════════════════════ */
// // async function loadConversations() {
// //   try {
// //     const { conversations } = await api("/chat/conversations");
// //     _convos = conversations;
// //     renderConvList();

// //     // Auto-open if ?friend= in URL
// //     const urlFriend = new URLSearchParams(window.location.search).get("friend");
// //     if (urlFriend && /^[a-f\d]{24}$/i.test(urlFriend)) {
// //       const existing = _convos.find((c) => c.friendId === urlFriend);
// //       if (existing) {
// //         openConv(existing.friendId);
// //       } else {
// //         // New conversation — fetch the friend's info first
// //         try {
// //           const res = await api(`/users/${urlFriend}`);
// //           // userController returns { data: user } or { user: user } — handle both
// //           const user = res.data || res.user || res;
// //           if (!user?.name) throw new Error("User not found");
// //           _convos.unshift({
// //             friendId: urlFriend,
// //             roomId: null,
// //             friend: {
// //               name: user.name,
// //               handle: user.handle || "",
// //               avatar: user.avatar || null,
// //             },
// //             lastMessage: null,
// //             unreadCount: 0,
// //           });
// //           renderConvList();
// //           openConv(urlFriend);
// //         } catch {
// //           /* silently skip */
// //         }
// //       }
// //     } else if (_convos.length) {
// //       // Default: open first conversation
// //       openConv(_convos[0].friendId);
// //     }
// //   } catch (err) {
// //     document.getElementById("conv-list").innerHTML =
// //       `<div style="text-align:center;padding:32px 16px;color:var(--text-light);font-size:.86rem;">
// //         Could not load conversations.<br>Please refresh.
// //       </div>`;
// //   }
// // }

// // /* ═══════════════════════════════════════════════════════
// //    RENDER CONVERSATION LIST  (preserves original layout)
// // ═══════════════════════════════════════════════════════ */
// // function renderConvList(filter = "") {
// //   const list = document.getElementById("conv-list");

// //   const q = filter.toLowerCase();
// //   const filtered = _convos.filter(
// //     (c) =>
// //       (c.friend?.name || "").toLowerCase().includes(q) ||
// //       (c.lastMessage?.body || "").toLowerCase().includes(q),
// //   );

// //   const unread = filtered.filter((c) => c.unreadCount > 0);
// //   const rest = filtered.filter((c) => !c.unreadCount);

// //   let html = "";
// //   if (unread.length) {
// //     html += `<div class="conv-divider">Unread</div>`;
// //     unread.forEach((c) => (html += convItemHTML(c)));
// //   }
// //   if (rest.length) {
// //     if (unread.length) html += `<div class="conv-divider">All Messages</div>`;
// //     rest.forEach((c) => (html += convItemHTML(c)));
// //   }
// //   if (!filtered.length) {
// //     html = `<div style="text-align:center;padding:32px 16px;color:var(--text-light);font-size:.86rem;">No conversations found</div>`;
// //   }

// //   list.innerHTML = html;

// //   // Re-mark active
// //   if (_activeConv) {
// //     list
// //       .querySelector(`[data-id="${_activeConv.friendId}"]`)
// //       ?.classList.add("active");
// //   }
// // }

// // function convItemHTML(c) {
// //   const bg = c.friend?.avatar
// //     ? `background-image:url(${c.friend.avatar});background-size:cover;background-position:center;`
// //     : `background:${colorFor(c.friendId)};`;
// //   const avInner = c.friend?.avatar ? "" : initials(c.friend?.name || "?");
// //   const preview = c.lastMessage
// //     ? `${c.lastMessage.isMine ? "You: " : ""}${escHTML(c.lastMessage.body?.slice(0, 45) || "")}${(c.lastMessage.body?.length || 0) > 45 ? "…" : ""}`
// //     : "No messages yet";
// //   const timeStr = c.lastMessage ? timeAgo(c.lastMessage.createdAt) : "";

// //   return `
// //   <div class="conv-item" data-id="${c.friendId}" onclick="openConv('${c.friendId}')">
// //     <div class="conv-av-wrap">
// //       <div class="conv-av has-color" style="${bg}color:#fff;font-weight:700;">${avInner}</div>
// //     </div>
// //     <div class="conv-body">
// //       <div class="conv-name">
// //         <span>${escHTML(c.friend.name)}</span>
// //         <span class="conv-time">${timeStr}</span>
// //       </div>
// //       <div class="conv-preview">
// //         <span>${preview}</span>
// //         ${c.unreadCount ? `<span class="conv-unread">${c.unreadCount}</span>` : ""}
// //       </div>
// //     </div>
// //   </div>`;
// // }

// // function filterConvs(val) {
// //   renderConvList(val);
// // }

// // /* ═══════════════════════════════════════════════════════
// //    OPEN CONVERSATION
// // ═══════════════════════════════════════════════════════ */
// // async function openConv(friendId) {
// //   // Leave previous room
// //   if (_activeConv && window.craftSocket) {
// //     window.craftSocket.emit("chat:leave", { friendId: _activeConv.friendId });
// //   }

// //   const convo = _convos.find((c) => c.friendId === friendId);
// //   if (!convo) return;

// //   _activeConv = { ...convo, messages: [] };
// //   _historyPage = 1;
// //   _historyHasMore = false;

// //   // Mark as read in local state
// //   convo.unreadCount = 0;

// //   // Highlight in list
// //   document
// //     .querySelectorAll(".conv-item")
// //     .forEach((el) => el.classList.toggle("active", el.dataset.id === friendId));

// //   // ── Update chat header ────────────────────────────
// //   const f = convo.friend;
// //   const av = document.getElementById("chat-av");
// //   av.textContent = f.avatar ? "" : initials(f.name);
// //   av.style.background = f.avatar ? "transparent" : colorFor(friendId);
// //   if (f.avatar) {
// //     av.style.backgroundImage = `url(${f.avatar})`;
// //     av.style.backgroundSize = "cover";
// //     av.style.backgroundPosition = "center";
// //   }

// //   document.getElementById("chat-name").textContent = f.name;
// //   document.getElementById("chat-status").textContent = `@${f.handle || ""}`;
// //   document.getElementById("chat-status").className = "chat-header-status";

// //   // Online dot — we don't have real presence yet, hide it
// //   document.getElementById("chat-dot").style.display = "none";

// //   // Clear distress tag
// //   document.getElementById("chat-distress-wrap").innerHTML = "";

// //   // Show shimmer while loading
// //   const area = document.getElementById("messages-area");
// //   area.innerHTML = `
// //     <div style="padding:24px;display:flex;flex-direction:column;gap:10px;">
// //       <div style="height:44px;width:58%;border-radius:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-left:auto;"></div>
// //       <div style="height:44px;width:65%;border-radius:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;"></div>
// //       <div style="height:44px;width:44%;border-radius:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-left:auto;"></div>
// //     </div>`;

// //   // Mobile — switch panels
// //   if (window.innerWidth <= 640) {
// //     document.getElementById("conv-panel").classList.add("hidden");
// //     document.getElementById("chat-panel").classList.add("visible");
// //   }

// //   document.getElementById("chat-textarea")?.focus();

// //   // ── Fetch history (REST) ──────────────────────────
// //   try {
// //     const { messages, hasMore } = await api(`/chat/${friendId}?page=1`);
// //     _activeConv.messages = messages;
// //     _historyHasMore = hasMore;
// //     renderMessages(messages);
// //   } catch (err) {
// //     // Not friends or first conversation
// //     area.innerHTML = `
// //       <div style="text-align:center;padding:48px 24px;color:#aaa;font-size:.88rem;">
// //         ${
// //           err.message.includes("friends")
// //             ? "🚫 You must be friends to chat with this person."
// //             : "Start the conversation!"
// //         }
// //       </div>`;
// //   }

// //   // ── Join socket room ──────────────────────────────
// //   if (window.craftSocket) {
// //     window.craftSocket.emit("chat:join", { friendId });
// //     window.craftSocket.emit("chat:read", { friendId });
// //   }

// //   // Clear unread badge in list
// //   renderConvList(document.querySelector(".conv-search")?.value || "");
// // }

// // /* ═══════════════════════════════════════════════════════
// //    RENDER MESSAGES  (preserves original bubble markup)
// // ═══════════════════════════════════════════════════════ */
// // function renderMessages(messages, prepend = false) {
// //   const area = document.getElementById("messages-area");

// //   if (!prepend) {
// //     area.innerHTML = "";

// //     if (!messages.length) {
// //       area.innerHTML = `
// //         <div class="sys-msg" style="margin-top:24px;">
// //           No messages yet — say hello! 👋
// //         </div>`;
// //       return;
// //     }

// //     area.innerHTML += `<div class="day-sep"><span>Today</span></div>`;
// //   }

// //   const frag = document.createDocumentFragment();

// //   messages.forEach((msg, i) => {
// //     const nextSame =
// //       i < messages.length - 1 && messages[i + 1].isMine === msg.isMine;
// //     frag.appendChild(buildBubbleDom(msg, nextSame));
// //   });

// //   if (prepend) {
// //     area.insertBefore(frag, area.firstChild);
// //   } else {
// //     area.appendChild(frag);
// //     scrollToBottom();
// //   }
// // }

// // function buildBubbleDom(msg, nextSame = false) {
// //   const isOut = msg.isMine;
// //   const f = _activeConv?.friend ?? {};

// //   const row = document.createElement("div");
// //   row.className = `bubble-row ${isOut ? "out" : ""}`;
// //   row.id = `msg-${msg.id}`;

// //   if (!isOut) {
// //     const avEl = document.createElement("div");
// //     avEl.className = nextSame ? "bubble-av ghost" : "bubble-av";
// //     if (!nextSame) {
// //       if (f.avatar) {
// //         avEl.style.cssText = `background-image:url(${f.avatar});background-size:cover;background-position:center;`;
// //       } else {
// //         avEl.style.background = colorFor(_activeConv?.friendId || "");
// //         avEl.style.color = "#fff";
// //         avEl.textContent = initials(f.name);
// //       }
// //     }
// //     row.appendChild(avEl);
// //   }

// //   const col = document.createElement("div");
// //   col.className = "bubble-col";

// //   const bubble = document.createElement("div");
// //   bubble.className = `bubble ${isOut ? "out" : "in"}`;

// //   if (msg.imageUrl) {
// //     const img = document.createElement("img");
// //     img.src = msg.imageUrl;
// //     img.alt = "attachment";
// //     img.style.cssText =
// //       "max-width:220px;border-radius:10px;display:block;margin-bottom:4px;cursor:pointer;";
// //     img.onclick = () => window.open(msg.imageUrl, "_blank");
// //     bubble.appendChild(img);
// //   }

// //   if (msg.body) {
// //     const span = document.createElement("span");
// //     span.textContent = msg.body;
// //     bubble.appendChild(span);
// //   }

// //   col.appendChild(bubble);

// //   if (!nextSame) {
// //     const meta = document.createElement("div");
// //     meta.className = "bubble-meta";
// //     meta.textContent = fmtTime(msg.createdAt);

// //     if (isOut) {
// //       const tick = document.createElement("span");
// //       tick.className = "read-tick";
// //       tick.id = `tick-${msg.id}`;
// //       tick.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
// //       tick.style.color = msg.isRead ? "#7a8f52" : "inherit";
// //       meta.appendChild(tick);
// //     }

// //     col.appendChild(meta);
// //   }

// //   row.appendChild(col);
// //   return row;
// // }

// // function appendBubble(msg) {
// //   const area = document.getElementById("messages-area");
// //   area.querySelector("[style*='say hello']")?.remove();
// //   area.querySelector("[style*='No messages']")?.remove();
// //   area.appendChild(buildBubbleDom(msg, false));
// //   scrollToBottom();
// // }

// // function scrollToBottom() {
// //   const area = document.getElementById("messages-area");
// //   area.scrollTop = area.scrollHeight;
// // }

// // /* ═══════════════════════════════════════════════════════
// //    LOAD MORE (scroll to top)
// // ═══════════════════════════════════════════════════════ */
// // async function loadMoreHistory() {
// //   if (_loadingMore || !_historyHasMore || !_activeConv) return;
// //   _loadingMore = true;
// //   _historyPage++;
// //   try {
// //     const { messages, hasMore } = await api(
// //       `/chat/${_activeConv.friendId}?page=${_historyPage}`,
// //     );
// //     _historyHasMore = hasMore;
// //     if (messages.length) renderMessages(messages, true);
// //   } catch {
// //     /* silent */
// //   } finally {
// //     _loadingMore = false;
// //   }
// // }

// // document
// //   .getElementById("messages-area")
// //   ?.addEventListener("scroll", function () {
// //     if (this.scrollTop < 60) loadMoreHistory();
// //   });

// // /* ═══════════════════════════════════════════════════════
// //    SEND MESSAGE
// // ═══════════════════════════════════════════════════════ */
// // function sendMsg() {
// //   const ta = document.getElementById("chat-textarea");
// //   const body = ta.value.trim();
// //   if (!body && !_pendingImgUrl) return;
// //   if (!_activeConv || !window.craftSocket) return;

// //   window.craftSocket.emit("chat:message", {
// //     friendId: _activeConv.friendId,
// //     body: body,
// //     imageUrl: _pendingImgUrl || null,
// //   });

// //   ta.value = "";
// //   ta.style.height = "auto";
// //   clearAttach();
// // }

// // function handleKey(e) {
// //   if (e.key === "Enter" && !e.shiftKey) {
// //     e.preventDefault();
// //     sendMsg();
// //   }
// // }

// // function autoResize(el) {
// //   el.style.height = "auto";
// //   el.style.height = Math.min(el.scrollHeight, 120) + "px";

// //   // Emit typing
// //   if (_activeConv && window.craftSocket) {
// //     window.craftSocket.emit("chat:typing", {
// //       friendId: _activeConv.friendId,
// //       isTyping: true,
// //     });
// //     clearTimeout(_typingTimer);
// //     _typingTimer = setTimeout(
// //       () =>
// //         window.craftSocket.emit("chat:typing", {
// //           friendId: _activeConv.friendId,
// //           isTyping: false,
// //         }),
// //       2000,
// //     );
// //   }
// // }

// // function insertEmoji() {
// //   const ta = document.getElementById("chat-textarea");
// //   ta.value += "😊";
// //   ta.focus();
// //   autoResize(ta);
// // }

// // /* ═══════════════════════════════════════════════════════
// //    IMAGE ATTACHMENT  (uses existing .input-attach button)
// // ═══════════════════════════════════════════════════════ */
// // function wireAttachButton() {
// //   const btn = document.querySelector(".input-attach");
// //   if (!btn) return;

// //   const fi = document.createElement("input");
// //   fi.type = "file";
// //   fi.accept = "image/*";
// //   fi.style.display = "none";
// //   document.body.appendChild(fi);

// //   btn.onclick = () => fi.click();

// //   fi.onchange = async () => {
// //     const file = fi.files[0];
// //     if (!file) return;
// //     const fd = new FormData();
// //     fd.append("image", file);
// //     try {
// //       const r = await fetch(`${API_BASE}/upload/post-image`, {
// //         method: "POST",
// //         headers: { Authorization: `Bearer ${token}` },
// //         body: fd,
// //       });
// //       const { url } = await r.json();
// //       _pendingImgUrl = url;

// //       // Show a tiny preview above the textarea
// //       let preview = document.getElementById("_attach-preview");
// //       if (!preview) {
// //         preview = document.createElement("div");
// //         preview.id = "_attach-preview";
// //         preview.style.cssText =
// //           "display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--panel);border-top:1px solid var(--border);";
// //         document
// //           .getElementById("chat-input-bar")
// //           .insertAdjacentElement("beforebegin", preview);
// //       }
// //       preview.innerHTML = `
// //         <img src="${url}" style="height:40px;border-radius:6px;"/>
// //         <span style="font-size:.8rem;color:var(--text-light);">Image attached</span>
// //         <button onclick="clearAttach()" style="background:none;border:none;cursor:pointer;color:#c0392b;font-size:.9rem;">✕</button>`;
// //     } catch {
// //       window.craftToast?.("Image upload failed", "error");
// //     }
// //   };
// // }

// // function clearAttach() {
// //   _pendingImgUrl = null;
// //   document.getElementById("_attach-preview")?.remove();
// // }

// // /* ═══════════════════════════════════════════════════════
// //    SOCKET EVENTS
// // ═══════════════════════════════════════════════════════ */
// // function bindSocketEvents() {
// //   const s = window.craftSocket;
// //   if (!s) {
// //     // Retry — socket might not have connected yet
// //     setTimeout(bindSocketEvents, 400);
// //     return;
// //   }

// //   // History (replaces shimmers on join)
// //   s.on("chat:history", ({ roomId, messages, hasMore }) => {
// //     if (!_activeConv) return;
// //     const myRoomId = [_me?._id || _me?.id, _activeConv.friendId]
// //       .sort()
// //       .join("_");
// //     if (roomId !== myRoomId) return;
// //     _activeConv.messages = messages;
// //     renderMessages(messages);
// //     // hasMore from server (or infer: if full page arrived, more may exist)
// //     _historyHasMore = hasMore ?? messages.length >= 30;
// //   });

// //   // New message (mine or theirs)
// //   s.on("chat:message", (msg) => {
// //     const myRoomId = _activeConv
// //       ? [_me?._id || _me?.id, _activeConv.friendId].sort().join("_")
// //       : null;

// //     if (msg.roomId === myRoomId) {
// //       // Active conversation — append bubble
// //       appendBubble(msg);
// //       if (!msg.isMine) {
// //         s.emit("chat:read", { friendId: _activeConv.friendId });
// //       }
// //       // Update preview in list
// //       const c = _convos.find((c) => c.friendId === _activeConv.friendId);
// //       if (c) {
// //         c.lastMessage = {
// //           body: msg.body,
// //           createdAt: msg.createdAt,
// //           isMine: msg.isMine,
// //         };
// //       }
// //     } else {
// //       // Different conversation — bump unread badge
// //       const senderId = String(msg.sender);
// //       const c = _convos.find((c) => c.friendId === senderId);
// //       if (c) {
// //         c.unreadCount = (c.unreadCount || 0) + 1;
// //         c.lastMessage = {
// //           body: msg.body,
// //           createdAt: msg.createdAt,
// //           isMine: false,
// //         };
// //       }
// //       renderConvList(document.querySelector(".conv-search")?.value || "");

// //       // Update Messages nav badge
// //       const chatBadge = document.getElementById("chat-badge");
// //       if (chatBadge) {
// //         const cur = parseInt(chatBadge.textContent) || 0;
// //         chatBadge.textContent = cur + 1;
// //         chatBadge.style.display = "flex";
// //       }
// //     }
// //   });

// //   // Typing indicator
// //   s.on("chat:typing", ({ isTyping }) => {
// //     if (!_activeConv) return;
// //     const ti = document.getElementById("typing-indicator");
// //     const tav = document.getElementById("typing-av");
// //     if (!ti) return;
// //     const f = _activeConv.friend;
// //     if (tav) {
// //       tav.textContent = initials(f.name);
// //       tav.style.background = colorFor(_activeConv.friendId);
// //     }
// //     ti.style.display = isTyping ? "flex" : "none";
// //     if (isTyping) scrollToBottom();
// //   });

// //   // Read receipts — green-tick sent messages
// //   s.on("chat:read", ({ roomId }) => {
// //     if (!_activeConv) return;
// //     const myRoomId = [_me?._id || _me?.id, _activeConv.friendId]
// //       .sort()
// //       .join("_");
// //     if (roomId !== myRoomId) return;
// //     document.querySelectorAll(".read-tick").forEach((el) => {
// //       el.style.color = "#7a8f52";
// //     });
// //   });

// //   // Friend gate error
// //   s.on("chat:error", ({ code, message }) => {
// //     const area = document.getElementById("messages-area");
// //     area.innerHTML = `
// //       <div style="text-align:center;padding:48px 24px;color:#c0392b;font-size:.88rem;">
// //         🚫 ${escHTML(message)}
// //       </div>`;
// //     // Disable input
// //     document.getElementById("chat-textarea").disabled = true;
// //     document.getElementById("send-btn").disabled = true;
// //   });
// // }

// // /* ═══════════════════════════════════════════════════════
// //    NAV  (unchanged from original)
// // ═══════════════════════════════════════════════════════ */
// // function pickNav(el) {
// //   document
// //     .querySelectorAll(".nav-item")
// //     .forEach((i) => i.classList.remove("active"));
// //   el.classList.add("active");
// //   if (window.innerWidth <= 640) closeSidebar();
// // }

// // function syncNav(el) {
// //   const label = el.textContent.trim();
// //   document
// //     .querySelectorAll(".tnav,.snav")
// //     .forEach((l) =>
// //       l.classList.toggle("active", l.textContent.trim() === label),
// //     );
// // }

// // function toggleSidebar() {
// //   const open = document.getElementById("sidebar").classList.toggle("open");
// //   document.getElementById("overlay").classList.toggle("on", open);
// // }

// // function closeSidebar() {
// //   document.getElementById("sidebar").classList.remove("open");
// //   document.getElementById("overlay").classList.remove("on");
// // }

// // function goBack() {
// //   document.getElementById("conv-panel").classList.remove("hidden");
// //   document.getElementById("chat-panel").classList.remove("visible");
// // }

// // window.addEventListener("resize", () => {
// //   if (window.innerWidth > 640) {
// //     closeSidebar();
// //     document.getElementById("conv-panel").classList.remove("hidden");
// //     if (_activeConv)
// //       document.getElementById("chat-panel").classList.add("visible");
// //   }
// // });

// // /* ═══════════════════════════════════════════════════════
// //    INIT
// // ═══════════════════════════════════════════════════════ */
// // document.addEventListener("DOMContentLoaded", () => {
// //   // populateSidebarUser();
// //   wireAttachButton();
// //   bindSocketEvents();
// //   loadConversations();
// //   // After loading the user from localStorage or the API:
// //   initSidebar(_me); // or initSidebar(userData), initSidebar(w) — whatever the variable is called

// //   // // Wire nav item hrefs
// //   // const navItems = document.querySelectorAll(".nav-item");
// //   // const navRoutes = {
// //   //   Home: "../index.html",
// //   //   Explore: "explore.html",
// //   //   Search: "explore.html",
// //   //   Notifications: "dashboard.html",
// //   //   Messages: "chat.html",
// //   //   Profile: "profile.html",
// //   //   Settings: "settings.html",
// //   // };
// //   // navItems.forEach((el) => {
// //   //   const label = el.querySelector(".nav-label")?.textContent?.trim();
// //   //   if (label && navRoutes[label] && label !== "Messages") {
// //   //     el.addEventListener("click", () => {
// //   //       window.location.href = navRoutes[label];
// //   //     });
// //   //   }
// //   //   if (label === "Messages") el.classList.add("active");
// //   // });

// //   // // Wire distress button
// //   // document.querySelector(".distress-btn")?.addEventListener("click", () => {
// //   //   window.location.href = "create-post.html";
// //   // });
// // });
// // Frontend/js/chat.js
// // ─────────────────────────────────────────────────────────────────────────────
// // Replaces the entire inline <script> from the original chat HTML.
// // Works with the EXISTING HTML structure — every CSS class is preserved.
// //
// // Flow:
// //   1. DOMContentLoaded → auth guard → populate sidebar user → loadConversations()
// //   2. loadConversations() → GET /api/chat/conversations → renderConvList()
// //   3. openConv(friendId)  → GET /api/chat/:friendId → renderMessages()
// //                          → socket.emit("chat:join") for live updates
// //   4. sendMsg()           → socket.emit("chat:message")  (NOT a fetch — socket only)
// //   5. Socket events bound in bindSocketEvents():
// //        chat:history  → replace shimmer with real messages
// //        chat:message  → appendBubble()
// //        chat:typing   → show/hide typing indicator
// //        chat:read     → mark read ticks
// //        chat:error    → show not-friends banner
// // ─────────────────────────────────────────────────────────────────────────────
// "use strict";

// /* ── Config ──────────────────────────────────────────── */
// const API_BASE = "http://localhost:5000/api";
// const token = localStorage.getItem("token");
// const _me = (() => {
//   try {
//     return JSON.parse(localStorage.getItem("user") || "{}");
//   } catch {
//     return {};
//   }
// })();

// // Auth guard
// if (!token) window.location.href = "login.html";

// // Tell socket-client.js we are on the chat page (suppresses double badge bump)
// window._chatPageActive = true;

// /* ── State ───────────────────────────────────────────── */
// let _activeConv = null; // { friendId, friend, roomId, messages:[] }
// let _convos = []; // all loaded conversations
// let _typingTimer = null;
// let _historyPage = 1;
// let _historyHasMore = false;
// let _loadingMore = false;
// let _pendingImgUrl = null;

// /* ═══════════════════════════════════════════════════════
//    UTILITIES
// ═══════════════════════════════════════════════════════ */
// const api = async (path, opts = {}) => {
//   const r = await fetch(`${API_BASE}${path}`, {
//     ...opts,
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${token}`,
//       ...(opts.headers || {}),
//     },
//   });
//   const text = await r.text();
//   let d;
//   try {
//     d = JSON.parse(text);
//   } catch {
//     d = { message: text };
//   }
//   if (!r.ok) {
//     const err = new Error(d.message || "Request failed");
//     err._raw = text; // preserve full body so callers can read friendStatus etc.
//     err._data = d;
//     throw err;
//   }
//   return d;
// };

// function initials(name = "") {
//   return (
//     name
//       .trim()
//       .split(/\s+/)
//       .map((w) => w[0])
//       .join("")
//       .slice(0, 2) || "?"
//   ).toUpperCase();
// }

// const COLORS = [
//   "#b5c98a",
//   "#a8c4d8",
//   "#d4b8e0",
//   "#f0c07a",
//   "#c8a98a",
//   "#9ec4a0",
//   "#f7b8a2",
//   "#c9d8b6",
// ];
// function colorFor(id = "") {
//   let h = 0;
//   for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) & 0xffffff;
//   return COLORS[h % COLORS.length];
// }

// function timeAgo(iso) {
//   if (!iso) return "";
//   const d = Date.now() - new Date(iso).getTime();
//   const m = Math.floor(d / 60000);
//   if (m < 1) return "Just now";
//   if (m < 60) return `${m}m ago`;
//   const h = Math.floor(m / 60);
//   if (h < 24) return `${h}h ago`;
//   const days = Math.floor(h / 24);
//   if (days === 1) return "Yesterday";
//   if (days < 7)
//     return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
//       new Date(iso).getDay()
//     ];
//   return new Date(iso).toLocaleDateString();
// }

// function fmtTime(iso) {
//   if (!iso) return "";
//   return new Date(iso).toLocaleTimeString([], {
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// }

// function escHTML(s = "") {
//   return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// }

// /* ═══════════════════════════════════════════════════════
//    SIDEBAR USER INFO
// ═══════════════════════════════════════════════════════ */
// function populateSidebarUser() {
//   const nameEl = document.querySelector(".sb-prof-name");
//   const subEl = document.querySelector(".sb-prof-sub");
//   const avEl = document.querySelector(".sb-prof-av");
//   const topAv = document.querySelector(".profile-avatar");

//   if (nameEl) nameEl.textContent = _me?.name || "You";
//   if (subEl) subEl.textContent = _me?.handle ? `@${_me.handle}` : "";

//   [avEl, topAv].forEach((el) => {
//     if (!el) return;
//     if (_me?.avatar) {
//       el.style.cssText += `background-image:url(${_me.avatar});background-size:cover;background-position:center;`;
//     } else {
//       el.textContent = initials(_me?.name);
//       el.style.background = colorFor(_me?._id || _me?.id || "me");
//       el.style.color = "#fff";
//       el.style.display = "flex";
//       el.style.alignItems = "center";
//       el.style.justifyContent = "center";
//       el.style.fontWeight = "700";
//       el.style.fontSize = ".9rem";
//     }
//   });
// }

// /* ═══════════════════════════════════════════════════════
//    LOAD CONVERSATIONS
// ═══════════════════════════════════════════════════════ */
// async function loadConversations() {
//   try {
//     const { conversations } = await api("/chat/conversations");
//     _convos = conversations;
//     renderConvList();

//     // Auto-open if ?friend= in URL
//     const urlFriend = new URLSearchParams(window.location.search).get("friend");
//     if (urlFriend && /^[a-f\d]{24}$/i.test(urlFriend)) {
//       const existing = _convos.find((c) => c.friendId === urlFriend);
//       if (existing) {
//         openConv(existing.friendId);
//       } else {
//         // New conversation — fetch the friend's info first
//         try {
//           const res = await api(`/users/${urlFriend}`);
//           // userController returns { data: user } or { user: user } — handle both
//           const user = res.data || res.user || res;
//           if (!user?.name) throw new Error("User not found");
//           _convos.unshift({
//             friendId: urlFriend,
//             roomId: null,
//             friend: {
//               name: user.name,
//               handle: user.handle || "",
//               avatar: user.avatar || null,
//             },
//             lastMessage: null,
//             unreadCount: 0,
//           });
//           renderConvList();
//           openConv(urlFriend);
//         } catch {
//           /* silently skip */
//         }
//       }
//     } else if (_convos.length) {
//       // Default: open first conversation
//       openConv(_convos[0].friendId);
//     }
//   } catch (err) {
//     document.getElementById("conv-list").innerHTML =
//       `<div style="text-align:center;padding:32px 16px;color:var(--text-light);font-size:.86rem;">
//         Could not load conversations.<br>Please refresh.
//       </div>`;
//   }
// }

// /* ═══════════════════════════════════════════════════════
//    NOT-FRIENDS CARD
//    Shown in the messages area when the two users aren't friends.
//    Displays user info + a status-aware friend request button.
// ═══════════════════════════════════════════════════════ */
// function renderNotFriendsCard(area, friendId, payload = {}) {
//   const u = payload.user || {};
//   const fs = payload.friendStatus || "none";

//   const av = u.avatar
//     ? `<div style="width:72px;height:72px;border-radius:50%;background:url(${u.avatar}) center/cover no-repeat;flex-shrink:0;"></div>`
//     : `<div style="width:72px;height:72px;border-radius:50%;background:${colorFor(friendId)};display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700;color:#fff;flex-shrink:0;">${initials(u.name || "?")}</div>`;

//   const handle = u.handle
//     ? `<div style="color:#8fa45a;font-size:.84rem;">@${u.handle.replace(/^@+/, "")}</div>`
//     : "";

//   const { btnLabel, btnStyle, btnId } = (() => {
//     switch (fs) {
//       case "pending_sent":
//         return {
//           btnLabel: "⏳ Request Pending",
//           btnStyle:
//             "background:#d4dcc2;color:#5a6b35;border:1.5px solid #b8c98a;",
//           btnId: "nf-follow-btn",
//         };
//       case "pending_received":
//         return {
//           btnLabel: "✓ Accept Request",
//           btnStyle: "background:#7a8f52;color:#fff;border:1.5px solid #5e6e3b;",
//           btnId: "nf-follow-btn",
//         };
//       case "friends":
//         return {
//           btnLabel: "✓ Friends",
//           btnStyle:
//             "background:#d4dcc2;color:#5a6b35;border:1.5px solid #b8c98a;",
//           btnId: "nf-follow-btn",
//         };
//       default:
//         return {
//           btnLabel: "＋ Send Friend Request",
//           btnStyle: "background:#7a8f52;color:#fff;border:1.5px solid #5e6e3b;",
//           btnId: "nf-follow-btn",
//         };
//     }
//   })();

//   const declineBtn =
//     fs === "pending_received"
//       ? `<button id="nf-decline-btn" onclick="chatDeclineRequest('${friendId}')"
//          style="padding:10px 18px;border-radius:8px;font-size:.84rem;cursor:pointer;background:none;color:#c0392b;border:1.5px solid #c0392b;font-weight:600;">
//          Decline
//        </button>`
//       : "";

//   const cancelNote =
//     fs === "pending_sent"
//       ? `<div style="font-size:.76rem;color:#9aaa7a;margin-top:4px;">Click to cancel request</div>`
//       : "";

//   area.innerHTML = `
//     <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:40px 24px;text-align:center;">
//       ${av}
//       <div>
//         <div style="font-size:1.1rem;font-weight:700;color:#3d4a2a;">${escHTML(u.name || "This crafter")}</div>
//         ${handle}
//       </div>
//       <div style="font-size:.85rem;color:#7a8a6a;max-width:280px;line-height:1.5;">
//         You need to be friends to start a conversation.
//       </div>
//       <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;">
//         <button id="${btnId}" onclick="chatToggleFollow('${friendId}')"
//           style="padding:10px 20px;border-radius:8px;font-size:.85rem;cursor:pointer;font-weight:600;${btnStyle}">
//           ${btnLabel}
//         </button>
//         ${declineBtn}
//         ${
//           u.id
//             ? `<a href="crafter-profile.html?id=${friendId}"
//           style="padding:10px 18px;border-radius:8px;font-size:.84rem;cursor:pointer;background:none;color:#7a8f52;border:1.5px solid #b8c98a;font-weight:600;text-decoration:none;display:inline-block;">
//           View Profile
//         </a>`
//             : ""
//         }
//       </div>
//       ${cancelNote}
//     </div>`;

//   // Store current status on the area so button clicks can update it
//   area.dataset.friendId = friendId;
//   area.dataset.friendStatus = fs;
// }

// /** Send/cancel request from inside the chat not-friends card */
// async function chatToggleFollow(friendId) {
//   const area = document.getElementById("messages-area");
//   const btn = document.getElementById("nf-follow-btn");
//   if (btn) {
//     btn.disabled = true;
//     btn.textContent = "…";
//   }

//   try {
//     const currentStatus = area?.dataset.friendStatus || "none";
//     let endpoint, resData;

//     if (currentStatus === "pending_received") {
//       resData = await api(`/crafter/${friendId}/accept`, { method: "POST" });
//     } else {
//       resData = await api(`/crafter/${friendId}/follow`, { method: "POST" });
//     }

//     const newStatus = resData.friendStatus || "none";
//     if (area) area.dataset.friendStatus = newStatus;

//     // Re-render the card with updated state
//     const u = {
//       id: friendId,
//       name: btn?.dataset.name,
//       handle: btn?.dataset.handle,
//       avatar: btn?.dataset.avatar,
//     };
//     renderNotFriendsCard(area, friendId, { friendStatus: newStatus, user: u });

//     // If now friends, re-open conversation to load messages
//     if (newStatus === "friends") {
//       setTimeout(() => openConv(friendId), 600);
//     }
//   } catch (err) {
//     if (btn) {
//       btn.disabled = false;
//       btn.textContent = "Try again";
//     }
//   }
// }

// /** Decline a request from inside the chat not-friends card */
// async function chatDeclineRequest(friendId) {
//   const area = document.getElementById("messages-area");
//   try {
//     const resData = await api(`/crafter/${friendId}/decline`, {
//       method: "POST",
//     });
//     if (area) area.dataset.friendStatus = resData.friendStatus || "none";
//     const u = { id: friendId };
//     renderNotFriendsCard(area, friendId, { friendStatus: "none", user: u });
//   } catch {
//     /* silent */
//   }
// }

// /* ═══════════════════════════════════════════════════════
//    RENDER CONVERSATION LIST  (preserves original layout)
// ═══════════════════════════════════════════════════════ */
// function renderConvList(filter = "") {
//   const list = document.getElementById("conv-list");

//   const q = filter.toLowerCase();
//   const filtered = _convos.filter(
//     (c) =>
//       (c.friend?.name || "").toLowerCase().includes(q) ||
//       (c.lastMessage?.body || "").toLowerCase().includes(q),
//   );

//   const unread = filtered.filter((c) => c.unreadCount > 0);
//   const rest = filtered.filter((c) => !c.unreadCount);

//   let html = "";
//   if (unread.length) {
//     html += `<div class="conv-divider">Unread</div>`;
//     unread.forEach((c) => (html += convItemHTML(c)));
//   }
//   if (rest.length) {
//     if (unread.length) html += `<div class="conv-divider">All Messages</div>`;
//     rest.forEach((c) => (html += convItemHTML(c)));
//   }
//   if (!filtered.length) {
//     html = `<div style="text-align:center;padding:32px 16px;color:var(--text-light);font-size:.86rem;">No conversations found</div>`;
//   }

//   list.innerHTML = html;

//   // Re-mark active
//   if (_activeConv) {
//     list
//       .querySelector(`[data-id="${_activeConv.friendId}"]`)
//       ?.classList.add("active");
//   }
// }

// function convItemHTML(c) {
//   const bg = c.friend?.avatar
//     ? `background-image:url(${c.friend.avatar});background-size:cover;background-position:center;`
//     : `background:${colorFor(c.friendId)};`;
//   const avInner = c.friend?.avatar ? "" : initials(c.friend?.name || "?");
//   const preview = c.lastMessage
//     ? `${c.lastMessage.isMine ? "You: " : ""}${escHTML(c.lastMessage.body?.slice(0, 45) || "")}${(c.lastMessage.body?.length || 0) > 45 ? "…" : ""}`
//     : "No messages yet";
//   const timeStr = c.lastMessage ? timeAgo(c.lastMessage.createdAt) : "";

//   return `
//   <div class="conv-item" data-id="${c.friendId}" onclick="openConv('${c.friendId}')">
//     <div class="conv-av-wrap">
//       <div class="conv-av has-color" style="${bg}color:#fff;font-weight:700;">${avInner}</div>
//     </div>
//     <div class="conv-body">
//       <div class="conv-name">
//         <span>${escHTML(c.friend.name)}</span>
//         <span class="conv-time">${timeStr}</span>
//       </div>
//       <div class="conv-preview">
//         <span>${preview}</span>
//         ${c.unreadCount ? `<span class="conv-unread">${c.unreadCount}</span>` : ""}
//       </div>
//     </div>
//   </div>`;
// }

// function filterConvs(val) {
//   renderConvList(val);
// }

// /* ═══════════════════════════════════════════════════════
//    OPEN CONVERSATION
// ═══════════════════════════════════════════════════════ */
// async function openConv(friendId) {
//   // Leave previous room
//   if (_activeConv && window.craftSocket) {
//     window.craftSocket.emit("chat:leave", { friendId: _activeConv.friendId });
//   }

//   const convo = _convos.find((c) => c.friendId === friendId);
//   if (!convo) return;

//   _activeConv = { ...convo, messages: [] };
//   _historyPage = 1;
//   _historyHasMore = false;

//   // Mark as read in local state
//   convo.unreadCount = 0;

//   // Highlight in list
//   document
//     .querySelectorAll(".conv-item")
//     .forEach((el) => el.classList.toggle("active", el.dataset.id === friendId));

//   // ── Update chat header ────────────────────────────
//   const f = convo.friend;
//   const av = document.getElementById("chat-av");
//   av.textContent = f.avatar ? "" : initials(f.name);
//   av.style.background = f.avatar ? "transparent" : colorFor(friendId);
//   if (f.avatar) {
//     av.style.backgroundImage = `url(${f.avatar})`;
//     av.style.backgroundSize = "cover";
//     av.style.backgroundPosition = "center";
//   }

//   document.getElementById("chat-name").textContent = f.name;
//   document.getElementById("chat-status").textContent = `@${f.handle || ""}`;
//   document.getElementById("chat-status").className = "chat-header-status";

//   // Online dot — we don't have real presence yet, hide it
//   document.getElementById("chat-dot").style.display = "none";

//   // Clear distress tag
//   document.getElementById("chat-distress-wrap").innerHTML = "";

//   // Show shimmer while loading
//   const area = document.getElementById("messages-area");
//   area.innerHTML = `
//     <div style="padding:24px;display:flex;flex-direction:column;gap:10px;">
//       <div style="height:44px;width:58%;border-radius:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-left:auto;"></div>
//       <div style="height:44px;width:65%;border-radius:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;"></div>
//       <div style="height:44px;width:44%;border-radius:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-left:auto;"></div>
//     </div>`;

//   // Mobile — switch panels
//   if (window.innerWidth <= 640) {
//     document.getElementById("conv-panel").classList.add("hidden");
//     document.getElementById("chat-panel").classList.add("visible");
//   }

//   document.getElementById("chat-textarea")?.focus();

//   // ── Fetch history (REST) ──────────────────────────
//   try {
//     const { messages, hasMore } = await api(`/chat/${friendId}?page=1`);
//     _activeConv.messages = messages;
//     _historyHasMore = hasMore;
//     renderMessages(messages);
//   } catch (err) {
//     // Parse 403 not-friends response (enriched by chatController)
//     let payload = {};
//     try {
//       payload = JSON.parse(err._raw || "{}");
//     } catch {
//       /* ignore */
//     }

//     if (err.message.includes("friends") || payload.notFriends) {
//       renderNotFriendsCard(area, friendId, payload);
//       // Disable textarea + send
//       const ta = document.getElementById("chat-textarea");
//       const sb = document.getElementById("send-btn");
//       if (ta) {
//         ta.disabled = true;
//         ta.placeholder = "Add this person as a friend to chat";
//       }
//       if (sb) sb.disabled = true;
//     } else {
//       area.innerHTML = `<div style="text-align:center;padding:48px 24px;color:#aaa;font-size:.88rem;">Start the conversation!</div>`;
//     }
//   }

//   // ── Join socket room ──────────────────────────────
//   if (window.craftSocket) {
//     window.craftSocket.emit("chat:join", { friendId });
//     window.craftSocket.emit("chat:read", { friendId });
//   }

//   // Clear unread badge in list
//   renderConvList(document.querySelector(".conv-search")?.value || "");
// }

// /* ═══════════════════════════════════════════════════════
//    RENDER MESSAGES  (preserves original bubble markup)
// ═══════════════════════════════════════════════════════ */
// function renderMessages(messages, prepend = false) {
//   const area = document.getElementById("messages-area");

//   if (!prepend) {
//     area.innerHTML = "";

//     if (!messages.length) {
//       area.innerHTML = `
//         <div class="sys-msg" style="margin-top:24px;">
//           No messages yet — say hello! 👋
//         </div>`;
//       return;
//     }

//     area.innerHTML += `<div class="day-sep"><span>Today</span></div>`;
//   }

//   const frag = document.createDocumentFragment();

//   messages.forEach((msg, i) => {
//     const nextSame =
//       i < messages.length - 1 && messages[i + 1].isMine === msg.isMine;
//     frag.appendChild(buildBubbleDom(msg, nextSame));
//   });

//   if (prepend) {
//     area.insertBefore(frag, area.firstChild);
//   } else {
//     area.appendChild(frag);
//     scrollToBottom();
//   }
// }

// function buildBubbleDom(msg, nextSame = false) {
//   const isOut = msg.isMine;
//   const f = _activeConv?.friend ?? {};

//   const row = document.createElement("div");
//   row.className = `bubble-row ${isOut ? "out" : ""}`;
//   row.id = `msg-${msg.id}`;

//   if (!isOut) {
//     const avEl = document.createElement("div");
//     avEl.className = nextSame ? "bubble-av ghost" : "bubble-av";
//     if (!nextSame) {
//       if (f.avatar) {
//         avEl.style.cssText = `background-image:url(${f.avatar});background-size:cover;background-position:center;`;
//       } else {
//         avEl.style.background = colorFor(_activeConv?.friendId || "");
//         avEl.style.color = "#fff";
//         avEl.textContent = initials(f.name);
//       }
//     }
//     row.appendChild(avEl);
//   }

//   const col = document.createElement("div");
//   col.className = "bubble-col";

//   const bubble = document.createElement("div");
//   bubble.className = `bubble ${isOut ? "out" : "in"}`;

//   if (msg.imageUrl) {
//     const img = document.createElement("img");
//     img.src = msg.imageUrl;
//     img.alt = "attachment";
//     img.style.cssText =
//       "max-width:220px;border-radius:10px;display:block;margin-bottom:4px;cursor:pointer;";
//     img.onclick = () => window.open(msg.imageUrl, "_blank");
//     bubble.appendChild(img);
//   }

//   if (msg.body) {
//     const span = document.createElement("span");
//     span.textContent = msg.body;
//     bubble.appendChild(span);
//   }

//   col.appendChild(bubble);

//   if (!nextSame) {
//     const meta = document.createElement("div");
//     meta.className = "bubble-meta";
//     meta.textContent = fmtTime(msg.createdAt);

//     if (isOut) {
//       const tick = document.createElement("span");
//       tick.className = "read-tick";
//       tick.id = `tick-${msg.id}`;
//       tick.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
//       tick.style.color = msg.isRead ? "#7a8f52" : "inherit";
//       meta.appendChild(tick);
//     }

//     col.appendChild(meta);
//   }

//   row.appendChild(col);
//   return row;
// }

// function appendBubble(msg) {
//   const area = document.getElementById("messages-area");
//   area.querySelector("[style*='say hello']")?.remove();
//   area.querySelector("[style*='No messages']")?.remove();
//   area.appendChild(buildBubbleDom(msg, false));
//   scrollToBottom();
// }

// function scrollToBottom() {
//   const area = document.getElementById("messages-area");
//   area.scrollTop = area.scrollHeight;
// }

// /* ═══════════════════════════════════════════════════════
//    LOAD MORE (scroll to top)
// ═══════════════════════════════════════════════════════ */
// async function loadMoreHistory() {
//   if (_loadingMore || !_historyHasMore || !_activeConv) return;
//   _loadingMore = true;
//   _historyPage++;
//   try {
//     const { messages, hasMore } = await api(
//       `/chat/${_activeConv.friendId}?page=${_historyPage}`,
//     );
//     _historyHasMore = hasMore;
//     if (messages.length) renderMessages(messages, true);
//   } catch {
//     /* silent */
//   } finally {
//     _loadingMore = false;
//   }
// }

// document
//   .getElementById("messages-area")
//   ?.addEventListener("scroll", function () {
//     if (this.scrollTop < 60) loadMoreHistory();
//   });

// /* ═══════════════════════════════════════════════════════
//    SEND MESSAGE
// ═══════════════════════════════════════════════════════ */
// function sendMsg() {
//   const ta = document.getElementById("chat-textarea");
//   const body = ta.value.trim();
//   if (!body && !_pendingImgUrl) return;
//   if (!_activeConv || !window.craftSocket) return;

//   window.craftSocket.emit("chat:message", {
//     friendId: _activeConv.friendId,
//     body: body,
//     imageUrl: _pendingImgUrl || null,
//   });

//   ta.value = "";
//   ta.style.height = "auto";
//   clearAttach();
// }

// function handleKey(e) {
//   if (e.key === "Enter" && !e.shiftKey) {
//     e.preventDefault();
//     sendMsg();
//   }
// }

// function autoResize(el) {
//   el.style.height = "auto";
//   el.style.height = Math.min(el.scrollHeight, 120) + "px";

//   // Emit typing
//   if (_activeConv && window.craftSocket) {
//     window.craftSocket.emit("chat:typing", {
//       friendId: _activeConv.friendId,
//       isTyping: true,
//     });
//     clearTimeout(_typingTimer);
//     _typingTimer = setTimeout(
//       () =>
//         window.craftSocket.emit("chat:typing", {
//           friendId: _activeConv.friendId,
//           isTyping: false,
//         }),
//       2000,
//     );
//   }
// }

// function insertEmoji() {
//   const ta = document.getElementById("chat-textarea");
//   ta.value += "😊";
//   ta.focus();
//   autoResize(ta);
// }

// /* ═══════════════════════════════════════════════════════
//    IMAGE ATTACHMENT  (uses existing .input-attach button)
// ═══════════════════════════════════════════════════════ */
// function wireAttachButton() {
//   const btn = document.querySelector(".input-attach");
//   if (!btn) return;

//   const fi = document.createElement("input");
//   fi.type = "file";
//   fi.accept = "image/*";
//   fi.style.display = "none";
//   document.body.appendChild(fi);

//   btn.onclick = () => fi.click();

//   fi.onchange = async () => {
//     const file = fi.files[0];
//     if (!file) return;
//     const fd = new FormData();
//     fd.append("image", file);
//     try {
//       const r = await fetch(`${API_BASE}/upload/post-image`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}` },
//         body: fd,
//       });
//       const { url } = await r.json();
//       _pendingImgUrl = url;

//       // Show a tiny preview above the textarea
//       let preview = document.getElementById("_attach-preview");
//       if (!preview) {
//         preview = document.createElement("div");
//         preview.id = "_attach-preview";
//         preview.style.cssText =
//           "display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--panel);border-top:1px solid var(--border);";
//         document
//           .getElementById("chat-input-bar")
//           .insertAdjacentElement("beforebegin", preview);
//       }
//       preview.innerHTML = `
//         <img src="${url}" style="height:40px;border-radius:6px;"/>
//         <span style="font-size:.8rem;color:var(--text-light);">Image attached</span>
//         <button onclick="clearAttach()" style="background:none;border:none;cursor:pointer;color:#c0392b;font-size:.9rem;">✕</button>`;
//     } catch {
//       window.craftToast?.("Image upload failed", "error");
//     }
//   };
// }

// function clearAttach() {
//   _pendingImgUrl = null;
//   document.getElementById("_attach-preview")?.remove();
// }

// /* ═══════════════════════════════════════════════════════
//    SOCKET EVENTS
// ═══════════════════════════════════════════════════════ */
// function bindSocketEvents() {
//   const s = window.craftSocket;
//   if (!s) {
//     // Retry — socket might not have connected yet
//     setTimeout(bindSocketEvents, 400);
//     return;
//   }

//   // History (replaces shimmers on join)
//   s.on("chat:history", ({ roomId, messages, hasMore }) => {
//     if (!_activeConv) return;
//     const myRoomId = [_me?._id || _me?.id, _activeConv.friendId]
//       .sort()
//       .join("_");
//     if (roomId !== myRoomId) return;
//     _activeConv.messages = messages;
//     renderMessages(messages);
//     // hasMore from server (or infer: if full page arrived, more may exist)
//     _historyHasMore = hasMore ?? messages.length >= 30;
//   });

//   // New message (mine or theirs)
//   s.on("chat:message", (msg) => {
//     const myRoomId = _activeConv
//       ? [_me?._id || _me?.id, _activeConv.friendId].sort().join("_")
//       : null;

//     if (msg.roomId === myRoomId) {
//       // Active conversation — append bubble
//       appendBubble(msg);
//       if (!msg.isMine) {
//         s.emit("chat:read", { friendId: _activeConv.friendId });
//       }
//       // Update preview in list
//       const c = _convos.find((c) => c.friendId === _activeConv.friendId);
//       if (c) {
//         c.lastMessage = {
//           body: msg.body,
//           createdAt: msg.createdAt,
//           isMine: msg.isMine,
//         };
//       }
//     } else {
//       // Different conversation — bump unread badge
//       const senderId = String(msg.sender);
//       const c = _convos.find((c) => c.friendId === senderId);
//       if (c) {
//         c.unreadCount = (c.unreadCount || 0) + 1;
//         c.lastMessage = {
//           body: msg.body,
//           createdAt: msg.createdAt,
//           isMine: false,
//         };
//       }
//       renderConvList(document.querySelector(".conv-search")?.value || "");

//       // Update Messages nav badge
//       const chatBadge = document.getElementById("chat-badge");
//       if (chatBadge) {
//         const cur = parseInt(chatBadge.textContent) || 0;
//         chatBadge.textContent = cur + 1;
//         chatBadge.style.display = "flex";
//       }
//     }
//   });

//   // Typing indicator
//   s.on("chat:typing", ({ isTyping }) => {
//     if (!_activeConv) return;
//     const ti = document.getElementById("typing-indicator");
//     const tav = document.getElementById("typing-av");
//     if (!ti) return;
//     const f = _activeConv.friend;
//     if (tav) {
//       tav.textContent = initials(f.name);
//       tav.style.background = colorFor(_activeConv.friendId);
//     }
//     ti.style.display = isTyping ? "flex" : "none";
//     if (isTyping) scrollToBottom();
//   });

//   // Read receipts — green-tick sent messages
//   s.on("chat:read", ({ roomId }) => {
//     if (!_activeConv) return;
//     const myRoomId = [_me?._id || _me?.id, _activeConv.friendId]
//       .sort()
//       .join("_");
//     if (roomId !== myRoomId) return;
//     document.querySelectorAll(".read-tick").forEach((el) => {
//       el.style.color = "#7a8f52";
//     });
//   });

//   // Friend gate error
//   s.on("chat:error", ({ code, message }) => {
//     const area = document.getElementById("messages-area");
//     area.innerHTML = `
//       <div style="text-align:center;padding:48px 24px;color:#c0392b;font-size:.88rem;">
//         🚫 ${escHTML(message)}
//       </div>`;
//     // Disable input
//     document.getElementById("chat-textarea").disabled = true;
//     document.getElementById("send-btn").disabled = true;
//   });
// }

// /* ═══════════════════════════════════════════════════════
//    NAV  (unchanged from original)
// ═══════════════════════════════════════════════════════ */
// function pickNav(el) {
//   document
//     .querySelectorAll(".nav-item")
//     .forEach((i) => i.classList.remove("active"));
//   el.classList.add("active");
//   if (window.innerWidth <= 640) closeSidebar();
// }

// function syncNav(el) {
//   const label = el.textContent.trim();
//   document
//     .querySelectorAll(".tnav,.snav")
//     .forEach((l) =>
//       l.classList.toggle("active", l.textContent.trim() === label),
//     );
// }

// function toggleSidebar() {
//   const open = document.getElementById("sidebar").classList.toggle("open");
//   document.getElementById("overlay").classList.toggle("on", open);
// }

// function closeSidebar() {
//   document.getElementById("sidebar").classList.remove("open");
//   document.getElementById("overlay").classList.remove("on");
// }

// function goBack() {
//   document.getElementById("conv-panel").classList.remove("hidden");
//   document.getElementById("chat-panel").classList.remove("visible");
// }

// window.addEventListener("resize", () => {
//   if (window.innerWidth > 640) {
//     closeSidebar();
//     document.getElementById("conv-panel").classList.remove("hidden");
//     if (_activeConv)
//       document.getElementById("chat-panel").classList.add("visible");
//   }
// });

// /* ═══════════════════════════════════════════════════════
//    INIT
// ═══════════════════════════════════════════════════════ */
// document.addEventListener("DOMContentLoaded", () => {
//   populateSidebarUser();
//   wireAttachButton();
//   bindSocketEvents();
//   loadConversations();

//   // Wire nav item hrefs
//   const navItems = document.querySelectorAll(".nav-item");
//   const navRoutes = {
//     Home: "../index.html",
//     Explore: "explore.html",
//     Search: "explore.html",
//     Notifications: "dashboard.html",
//     Messages: "chat.html",
//     Profile: "profile.html",
//     Settings: "settings.html",
//   };
//   navItems.forEach((el) => {
//     const label = el.querySelector(".nav-label")?.textContent?.trim();
//     if (label && navRoutes[label] && label !== "Messages") {
//       el.addEventListener("click", () => {
//         window.location.href = navRoutes[label];
//       });
//     }
//     if (label === "Messages") el.classList.add("active");
//   });

//   // Wire distress button
//   document.querySelector(".distress-btn")?.addEventListener("click", () => {
//     window.location.href = "create-post.html";
//   });
// });
// Frontend/js/chat.js
// ─────────────────────────────────────────────────────────────────────────────
// Replaces the entire inline <script> from the original chat HTML.
// Works with the EXISTING HTML structure — every CSS class is preserved.
//
// Flow:
//   1. DOMContentLoaded → auth guard → populate sidebar user → loadConversations()
//   2. loadConversations() → GET /api/chat/conversations → renderConvList()
//   3. openConv(friendId)  → GET /api/chat/:friendId → renderMessages()
//                          → socket.emit("chat:join") for live updates
//   4. sendMsg()           → socket.emit("chat:message")  (NOT a fetch — socket only)
//   5. Socket events bound in bindSocketEvents():
//        chat:history  → replace shimmer with real messages
//        chat:message  → appendBubble()
//        chat:typing   → show/hide typing indicator
//        chat:read     → mark read ticks
//        chat:error    → show not-friends banner
// ─────────────────────────────────────────────────────────────────────────────
"use strict";

/* ── Config ──────────────────────────────────────────── */
const API_BASE = "http://localhost:5000/api";
const token = localStorage.getItem("token");
const _me = (() => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
})();

// Auth guard
if (!token) window.location.href = "login.html";

// Tell socket-client.js we are on the chat page (suppresses double badge bump)
window._chatPageActive = true;

/* ── State ───────────────────────────────────────────── */
let _activeConv = null; // { friendId, friend, roomId, messages:[] }
let _convos = []; // all loaded conversations
let _typingTimer = null;
let _historyPage = 1;
let _historyHasMore = false;
let _loadingMore = false;
let _pendingImgUrl = null;

/* ═══════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════ */
const api = async (path, opts = {}) => {
  const r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let d;
  try {
    d = JSON.parse(text);
  } catch {
    d = { message: text };
  }
  if (!r.ok) {
    const err = new Error(d.message || "Request failed");
    err._raw = text; // preserve full body so callers can read friendStatus etc.
    err._data = d;
    throw err;
  }
  return d;
};

function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2) || "?"
  ).toUpperCase();
}

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
function colorFor(id = "") {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) & 0xffffff;
  return COLORS[h % COLORS.length];
}

function timeAgo(iso) {
  if (!iso) return "";
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "Yesterday";
  if (days < 7)
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
      new Date(iso).getDay()
    ];
  return new Date(iso).toLocaleDateString();
}

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escHTML(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ═══════════════════════════════════════════════════════
   SIDEBAR USER INFO
═══════════════════════════════════════════════════════ */
function populateSidebarUser() {
  const nameEl = document.querySelector(".sb-prof-name");
  const subEl = document.querySelector(".sb-prof-sub");
  const avEl = document.querySelector(".sb-prof-av");
  const topAv = document.querySelector(".profile-avatar");

  if (nameEl) nameEl.textContent = _me?.name || "You";
  if (subEl) subEl.textContent = _me?.handle ? `@${_me.handle}` : "";

  [avEl, topAv].forEach((el) => {
    if (!el) return;
    if (_me?.avatar) {
      el.style.cssText += `background-image:url(${_me.avatar});background-size:cover;background-position:center;`;
    } else {
      el.textContent = initials(_me?.name);
      el.style.background = colorFor(_me?._id || _me?.id || "me");
      el.style.color = "#fff";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.fontWeight = "700";
      el.style.fontSize = ".9rem";
    }
  });
}

/* ═══════════════════════════════════════════════════════
   LOAD CONVERSATIONS
═══════════════════════════════════════════════════════ */
async function loadConversations() {
  try {
    const { conversations } = await api("/chat/conversations");
    _convos = conversations;
    renderConvList();

    // Auto-open if ?friend= in URL
    const urlFriend = new URLSearchParams(window.location.search).get("friend");
    if (urlFriend && /^[a-f\d]{24}$/i.test(urlFriend)) {
      const existing = _convos.find((c) => c.friendId === urlFriend);
      if (existing) {
        openConv(existing.friendId);
      } else {
        // New conversation — fetch the friend's info first
        try {
          const res = await api(`/users/${urlFriend}`);
          // userController returns { data: user } or { user: user } — handle both
          const user = res.data || res.user || res;
          if (!user?.name) throw new Error("User not found");
          _convos.unshift({
            friendId: urlFriend,
            roomId: null,
            friend: {
              name: user.name,
              handle: user.handle || "",
              avatar: user.avatar || null,
            },
            lastMessage: null,
            unreadCount: 0,
          });
          renderConvList();
          openConv(urlFriend);
        } catch {
          /* silently skip */
        }
      }
    } else if (_convos.length) {
      // Default: open first conversation
      openConv(_convos[0].friendId);
    }
  } catch (err) {
    document.getElementById("conv-list").innerHTML =
      `<div style="text-align:center;padding:32px 16px;color:var(--text-light);font-size:.86rem;">
        Could not load conversations.<br>Please refresh.
      </div>`;
  }
}

/* ═══════════════════════════════════════════════════════
   NOT-FRIENDS CARD
   Shown in the messages area when the two users aren't friends.
   Displays user info + a status-aware friend request button.
═══════════════════════════════════════════════════════ */
function renderNotFriendsCard(area, friendId, payload = {}) {
  const u = payload.user || {};
  const fs = payload.friendStatus || "none";

  const av = u.avatar
    ? `<div style="width:72px;height:72px;border-radius:50%;background:url(${u.avatar}) center/cover no-repeat;flex-shrink:0;"></div>`
    : `<div style="width:72px;height:72px;border-radius:50%;background:${colorFor(friendId)};display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:700;color:#fff;flex-shrink:0;">${initials(u.name || "?")}</div>`;

  const handle = u.handle
    ? `<div style="color:#8fa45a;font-size:.84rem;">@${u.handle.replace(/^@+/, "")}</div>`
    : "";

  const { btnLabel, btnStyle, btnId } = (() => {
    switch (fs) {
      case "pending_sent":
        return {
          btnLabel: "⏳ Request Pending",
          btnStyle:
            "background:#d4dcc2;color:#5a6b35;border:1.5px solid #b8c98a;",
          btnId: "nf-follow-btn",
        };
      case "pending_received":
        return {
          btnLabel: "✓ Accept Request",
          btnStyle: "background:#7a8f52;color:#fff;border:1.5px solid #5e6e3b;",
          btnId: "nf-follow-btn",
        };
      case "friends":
        return {
          btnLabel: "✓ Friends",
          btnStyle:
            "background:#d4dcc2;color:#5a6b35;border:1.5px solid #b8c98a;",
          btnId: "nf-follow-btn",
        };
      default:
        return {
          btnLabel: "＋ Send Friend Request",
          btnStyle: "background:#7a8f52;color:#fff;border:1.5px solid #5e6e3b;",
          btnId: "nf-follow-btn",
        };
    }
  })();

  const declineBtn =
    fs === "pending_received"
      ? `<button id="nf-decline-btn" onclick="chatDeclineRequest('${friendId}')"
         style="padding:10px 18px;border-radius:8px;font-size:.84rem;cursor:pointer;background:none;color:#c0392b;border:1.5px solid #c0392b;font-weight:600;">
         Decline
       </button>`
      : "";

  const cancelNote =
    fs === "pending_sent"
      ? `<div style="font-size:.76rem;color:#9aaa7a;margin-top:4px;">Click to cancel request</div>`
      : "";

  area.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;padding:40px 24px;text-align:center;">
      ${av}
      <div>
        <div style="font-size:1.1rem;font-weight:700;color:#3d4a2a;">${escHTML(u.name || "This crafter")}</div>
        ${handle}
      </div>
      <div style="font-size:.85rem;color:#7a8a6a;max-width:280px;line-height:1.5;">
        You need to be friends to start a conversation.
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;">
        <button id="${btnId}" onclick="chatToggleFollow('${friendId}')"
          style="padding:10px 20px;border-radius:8px;font-size:.85rem;cursor:pointer;font-weight:600;${btnStyle}">
          ${btnLabel}
        </button>
        ${declineBtn}
        ${
          u.id
            ? `<a href="crafter-profile.html?id=${friendId}"
          style="padding:10px 18px;border-radius:8px;font-size:.84rem;cursor:pointer;background:none;color:#7a8f52;border:1.5px solid #b8c98a;font-weight:600;text-decoration:none;display:inline-block;">
          View Profile
        </a>`
            : ""
        }
      </div>
      ${cancelNote}
    </div>`;

  // Store current status on the area so button clicks can update it
  area.dataset.friendId = friendId;
  area.dataset.friendStatus = fs;
}

/** Send/cancel request from inside the chat not-friends card */
async function chatToggleFollow(friendId) {
  const area = document.getElementById("messages-area");
  const btn = document.getElementById("nf-follow-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "…";
  }

  try {
    const currentStatus = area?.dataset.friendStatus || "none";
    let endpoint, resData;

    if (currentStatus === "pending_received") {
      resData = await api(`/crafter/${friendId}/accept`, { method: "POST" });
    } else {
      resData = await api(`/crafter/${friendId}/follow`, { method: "POST" });
    }

    const newStatus = resData.friendStatus || "none";
    if (area) area.dataset.friendStatus = newStatus;

    // Re-render the card with updated state
    const u = {
      id: friendId,
      name: btn?.dataset.name,
      handle: btn?.dataset.handle,
      avatar: btn?.dataset.avatar,
    };
    renderNotFriendsCard(area, friendId, { friendStatus: newStatus, user: u });

    // If now friends, re-open conversation to load messages
    if (newStatus === "friends") {
      setTimeout(() => openConv(friendId), 600);
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Try again";
    }
  }
}

/** Decline a request from inside the chat not-friends card */
async function chatDeclineRequest(friendId) {
  const area = document.getElementById("messages-area");
  try {
    const resData = await api(`/crafter/${friendId}/decline`, {
      method: "POST",
    });
    if (area) area.dataset.friendStatus = resData.friendStatus || "none";
    const u = { id: friendId };
    renderNotFriendsCard(area, friendId, { friendStatus: "none", user: u });
  } catch {
    /* silent */
  }
}

/* ═══════════════════════════════════════════════════════
   RENDER CONVERSATION LIST  (preserves original layout)
═══════════════════════════════════════════════════════ */
function renderConvList(filter = "") {
  const list = document.getElementById("conv-list");

  const q = filter.toLowerCase();
  const filtered = _convos.filter(
    (c) =>
      (c.friend?.name || "").toLowerCase().includes(q) ||
      (c.lastMessage?.body || "").toLowerCase().includes(q),
  );

  const unread = filtered.filter((c) => c.unreadCount > 0);
  const rest = filtered.filter((c) => !c.unreadCount);

  let html = "";
  if (unread.length) {
    html += `<div class="conv-divider">Unread</div>`;
    unread.forEach((c) => (html += convItemHTML(c)));
  }
  if (rest.length) {
    if (unread.length) html += `<div class="conv-divider">All Messages</div>`;
    rest.forEach((c) => (html += convItemHTML(c)));
  }
  if (!filtered.length) {
    html = `<div style="text-align:center;padding:32px 16px;color:var(--text-light);font-size:.86rem;">No conversations found</div>`;
  }

  list.innerHTML = html;

  // Re-mark active
  if (_activeConv) {
    list
      .querySelector(`[data-id="${_activeConv.friendId}"]`)
      ?.classList.add("active");
  }
}

function convItemHTML(c) {
  const bg = c.friend?.avatar
    ? `background-image:url(${c.friend.avatar});background-size:cover;background-position:center;`
    : `background:${colorFor(c.friendId)};`;
  const avInner = c.friend?.avatar ? "" : initials(c.friend?.name || "?");
  const preview = c.lastMessage
    ? `${c.lastMessage.isMine ? "You: " : ""}${escHTML(c.lastMessage.body?.slice(0, 45) || "")}${(c.lastMessage.body?.length || 0) > 45 ? "…" : ""}`
    : "No messages yet";
  const timeStr = c.lastMessage ? timeAgo(c.lastMessage.createdAt) : "";

  return `
  <div class="conv-item" data-id="${c.friendId}" onclick="openConv('${c.friendId}')">
    <div class="conv-av-wrap">
      <div class="conv-av has-color" style="${bg}color:#fff;font-weight:700;">${avInner}</div>
    </div>
    <div class="conv-body">
      <div class="conv-name">
        <span>${escHTML(c.friend.name)}</span>
        <span class="conv-time">${timeStr}</span>
      </div>
      <div class="conv-preview">
        <span>${preview}</span>
        ${c.unreadCount ? `<span class="conv-unread">${c.unreadCount}</span>` : ""}
      </div>
    </div>
  </div>`;
}

function filterConvs(val) {
  renderConvList(val);
}

/* ═══════════════════════════════════════════════════════
   OPEN CONVERSATION
═══════════════════════════════════════════════════════ */
async function openConv(friendId) {
  // Leave previous room
  if (_activeConv && window.craftSocket) {
    window.craftSocket.emit("chat:leave", { friendId: _activeConv.friendId });
  }

  const convo = _convos.find((c) => c.friendId === friendId);
  if (!convo) return;

  _activeConv = { ...convo, messages: [] };
  _historyPage = 1;
  _historyHasMore = false;

  // Re-enable input in case a previous conversation had disabled it
  const _ta = document.getElementById("chat-textarea");
  const _sb = document.getElementById("send-btn");
  if (_ta) {
    _ta.disabled = false;
    _ta.placeholder = "Type a message…";
  }
  if (_sb) _sb.disabled = false;

  // Mark as read in local state
  convo.unreadCount = 0;

  // Highlight in list
  document
    .querySelectorAll(".conv-item")
    .forEach((el) => el.classList.toggle("active", el.dataset.id === friendId));

  // ── Update chat header ────────────────────────────
  const f = convo.friend;
  const av = document.getElementById("chat-av");
  av.textContent = f.avatar ? "" : initials(f.name);
  av.style.background = f.avatar ? "transparent" : colorFor(friendId);
  if (f.avatar) {
    av.style.backgroundImage = `url(${f.avatar})`;
    av.style.backgroundSize = "cover";
    av.style.backgroundPosition = "center";
  }

  document.getElementById("chat-name").textContent = f.name;
  document.getElementById("chat-status").textContent = `@${f.handle || ""}`;
  document.getElementById("chat-status").className = "chat-header-status";

  // Online dot — we don't have real presence yet, hide it
  document.getElementById("chat-dot").style.display = "none";

  // Clear distress tag
  document.getElementById("chat-distress-wrap").innerHTML = "";

  // Show shimmer while loading
  const area = document.getElementById("messages-area");
  area.innerHTML = `
    <div style="padding:24px;display:flex;flex-direction:column;gap:10px;">
      <div style="height:44px;width:58%;border-radius:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-left:auto;"></div>
      <div style="height:44px;width:65%;border-radius:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;"></div>
      <div style="height:44px;width:44%;border-radius:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-left:auto;"></div>
    </div>`;

  // Mobile — switch panels
  if (window.innerWidth <= 640) {
    document.getElementById("conv-panel").classList.add("hidden");
    document.getElementById("chat-panel").classList.add("visible");
  }

  document.getElementById("chat-textarea")?.focus();

  // ── Fetch history (REST) ──────────────────────────
  try {
    const { messages, hasMore } = await api(`/chat/${friendId}?page=1`);
    _activeConv.messages = messages;
    _historyHasMore = hasMore;
    renderMessages(messages);
  } catch (err) {
    // Parse 403 not-friends response (enriched by chatController)
    let payload = {};
    try {
      payload = JSON.parse(err._raw || "{}");
    } catch {
      /* ignore */
    }

    if (err.message.includes("friends") || payload.notFriends) {
      renderNotFriendsCard(area, friendId, payload);
      // Disable textarea + send
      const ta = document.getElementById("chat-textarea");
      const sb = document.getElementById("send-btn");
      if (ta) {
        ta.disabled = true;
        ta.placeholder = "Add this person as a friend to chat";
      }
      if (sb) sb.disabled = true;
      _activeConv._notFriends = true; // flag: skip socket join
    } else {
      area.innerHTML = `<div style="text-align:center;padding:48px 24px;color:#aaa;font-size:.88rem;">Start the conversation!</div>`;
    }
  }

  // ── Join socket room — only if we're actually friends ─
  if (window.craftSocket && !_activeConv?._notFriends) {
    window.craftSocket.emit("chat:join", { friendId });
    window.craftSocket.emit("chat:read", { friendId });
  }

  // Clear unread badge in list
  renderConvList(document.querySelector(".conv-search")?.value || "");
}

/* ═══════════════════════════════════════════════════════
   RENDER MESSAGES  (preserves original bubble markup)
═══════════════════════════════════════════════════════ */
function renderMessages(messages, prepend = false) {
  const area = document.getElementById("messages-area");

  if (!prepend) {
    area.innerHTML = "";

    if (!messages.length) {
      area.innerHTML = `
        <div class="sys-msg" style="margin-top:24px;">
          No messages yet — say hello! 👋
        </div>`;
      return;
    }

    area.innerHTML += `<div class="day-sep"><span>Today</span></div>`;
  }

  const frag = document.createDocumentFragment();

  messages.forEach((msg, i) => {
    const nextSame =
      i < messages.length - 1 && messages[i + 1].isMine === msg.isMine;
    frag.appendChild(buildBubbleDom(msg, nextSame));
  });

  if (prepend) {
    area.insertBefore(frag, area.firstChild);
  } else {
    area.appendChild(frag);
    scrollToBottom();
  }
}

function buildBubbleDom(msg, nextSame = false) {
  const isOut = msg.isMine;
  const f = _activeConv?.friend ?? {};

  const row = document.createElement("div");
  row.className = `bubble-row ${isOut ? "out" : ""}`;
  row.id = `msg-${msg.id}`;

  if (!isOut) {
    const avEl = document.createElement("div");
    avEl.className = nextSame ? "bubble-av ghost" : "bubble-av";
    if (!nextSame) {
      if (f.avatar) {
        avEl.style.cssText = `background-image:url(${f.avatar});background-size:cover;background-position:center;`;
      } else {
        avEl.style.background = colorFor(_activeConv?.friendId || "");
        avEl.style.color = "#fff";
        avEl.textContent = initials(f.name);
      }
    }
    row.appendChild(avEl);
  }

  const col = document.createElement("div");
  col.className = "bubble-col";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${isOut ? "out" : "in"}`;

  if (msg.imageUrl) {
    const img = document.createElement("img");
    img.src = msg.imageUrl;
    img.alt = "attachment";
    img.style.cssText =
      "max-width:220px;border-radius:10px;display:block;margin-bottom:4px;cursor:pointer;";
    img.onclick = () => window.open(msg.imageUrl, "_blank");
    bubble.appendChild(img);
  }

  if (msg.body) {
    const span = document.createElement("span");
    span.textContent = msg.body;
    bubble.appendChild(span);
  }

  col.appendChild(bubble);

  if (!nextSame) {
    const meta = document.createElement("div");
    meta.className = "bubble-meta";
    meta.textContent = fmtTime(msg.createdAt);

    if (isOut) {
      const tick = document.createElement("span");
      tick.className = "read-tick";
      tick.id = `tick-${msg.id}`;
      tick.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
      tick.style.color = msg.isRead ? "#7a8f52" : "inherit";
      meta.appendChild(tick);
    }

    col.appendChild(meta);
  }

  row.appendChild(col);
  return row;
}

function appendBubble(msg) {
  const area = document.getElementById("messages-area");
  area.querySelector("[style*='say hello']")?.remove();
  area.querySelector("[style*='No messages']")?.remove();
  area.appendChild(buildBubbleDom(msg, false));
  scrollToBottom();
}

function scrollToBottom() {
  const area = document.getElementById("messages-area");
  area.scrollTop = area.scrollHeight;
}

/* ═══════════════════════════════════════════════════════
   LOAD MORE (scroll to top)
═══════════════════════════════════════════════════════ */
async function loadMoreHistory() {
  if (_loadingMore || !_historyHasMore || !_activeConv) return;
  _loadingMore = true;
  _historyPage++;
  try {
    const { messages, hasMore } = await api(
      `/chat/${_activeConv.friendId}?page=${_historyPage}`,
    );
    _historyHasMore = hasMore;
    if (messages.length) renderMessages(messages, true);
  } catch {
    /* silent */
  } finally {
    _loadingMore = false;
  }
}

document
  .getElementById("messages-area")
  ?.addEventListener("scroll", function () {
    if (this.scrollTop < 60) loadMoreHistory();
  });

/* ═══════════════════════════════════════════════════════
   SEND MESSAGE
═══════════════════════════════════════════════════════ */
function sendMsg() {
  const ta = document.getElementById("chat-textarea");
  const body = ta.value.trim();
  if (!body && !_pendingImgUrl) return;
  if (!_activeConv || !window.craftSocket) return;

  window.craftSocket.emit("chat:message", {
    friendId: _activeConv.friendId,
    body: body,
    imageUrl: _pendingImgUrl || null,
  });

  ta.value = "";
  ta.style.height = "auto";
  clearAttach();
}

function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";

  // Emit typing
  if (_activeConv && window.craftSocket) {
    window.craftSocket.emit("chat:typing", {
      friendId: _activeConv.friendId,
      isTyping: true,
    });
    clearTimeout(_typingTimer);
    _typingTimer = setTimeout(
      () =>
        window.craftSocket.emit("chat:typing", {
          friendId: _activeConv.friendId,
          isTyping: false,
        }),
      2000,
    );
  }
}

function insertEmoji() {
  const ta = document.getElementById("chat-textarea");
  ta.value += "😊";
  ta.focus();
  autoResize(ta);
}

/* ═══════════════════════════════════════════════════════
   IMAGE ATTACHMENT  (uses existing .input-attach button)
═══════════════════════════════════════════════════════ */
function wireAttachButton() {
  const btn = document.querySelector(".input-attach");
  if (!btn) return;

  const fi = document.createElement("input");
  fi.type = "file";
  fi.accept = "image/*";
  fi.style.display = "none";
  document.body.appendChild(fi);

  btn.onclick = () => fi.click();

  fi.onchange = async () => {
    const file = fi.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("image", file);
    try {
      const r = await fetch(`${API_BASE}/upload/post-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const { url } = await r.json();
      _pendingImgUrl = url;

      // Show a tiny preview above the textarea
      let preview = document.getElementById("_attach-preview");
      if (!preview) {
        preview = document.createElement("div");
        preview.id = "_attach-preview";
        preview.style.cssText =
          "display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--panel);border-top:1px solid var(--border);";
        document
          .getElementById("chat-input-bar")
          .insertAdjacentElement("beforebegin", preview);
      }
      preview.innerHTML = `
        <img src="${url}" style="height:40px;border-radius:6px;"/>
        <span style="font-size:.8rem;color:var(--text-light);">Image attached</span>
        <button onclick="clearAttach()" style="background:none;border:none;cursor:pointer;color:#c0392b;font-size:.9rem;">✕</button>`;
    } catch {
      window.craftToast?.("Image upload failed", "error");
    }
  };
}

function clearAttach() {
  _pendingImgUrl = null;
  document.getElementById("_attach-preview")?.remove();
}

/* ═══════════════════════════════════════════════════════
   SOCKET EVENTS
═══════════════════════════════════════════════════════ */
function bindSocketEvents() {
  const s = window.craftSocket;
  if (!s) {
    // Retry — socket might not have connected yet
    setTimeout(bindSocketEvents, 400);
    return;
  }

  // History (replaces shimmers on join)
  s.on("chat:history", ({ roomId, messages, hasMore }) => {
    if (!_activeConv) return;
    const myRoomId = [_me?._id || _me?.id, _activeConv.friendId]
      .sort()
      .join("_");
    if (roomId !== myRoomId) return;
    _activeConv.messages = messages;
    renderMessages(messages);
    // hasMore from server (or infer: if full page arrived, more may exist)
    _historyHasMore = hasMore ?? messages.length >= 30;
  });

  // New message (mine or theirs)
  s.on("chat:message", (msg) => {
    const myRoomId = _activeConv
      ? [_me?._id || _me?.id, _activeConv.friendId].sort().join("_")
      : null;

    if (msg.roomId === myRoomId) {
      // Active conversation — append bubble
      appendBubble(msg);
      if (!msg.isMine) {
        s.emit("chat:read", { friendId: _activeConv.friendId });
      }
      // Update preview in list
      const c = _convos.find((c) => c.friendId === _activeConv.friendId);
      if (c) {
        c.lastMessage = {
          body: msg.body,
          createdAt: msg.createdAt,
          isMine: msg.isMine,
        };
      }
    } else {
      // Different conversation — bump unread badge
      const senderId = String(msg.sender);
      const c = _convos.find((c) => c.friendId === senderId);
      if (c) {
        c.unreadCount = (c.unreadCount || 0) + 1;
        c.lastMessage = {
          body: msg.body,
          createdAt: msg.createdAt,
          isMine: false,
        };
      }
      renderConvList(document.querySelector(".conv-search")?.value || "");

      // Update Messages nav badge
      const chatBadge = document.getElementById("chat-badge");
      if (chatBadge) {
        const cur = parseInt(chatBadge.textContent) || 0;
        chatBadge.textContent = cur + 1;
        chatBadge.style.display = "flex";
      }
    }
  });

  // Typing indicator
  s.on("chat:typing", ({ isTyping }) => {
    if (!_activeConv) return;
    const ti = document.getElementById("typing-indicator");
    const tav = document.getElementById("typing-av");
    if (!ti) return;
    const f = _activeConv.friend;
    if (tav) {
      tav.textContent = initials(f.name);
      tav.style.background = colorFor(_activeConv.friendId);
    }
    ti.style.display = isTyping ? "flex" : "none";
    if (isTyping) scrollToBottom();
  });

  // Read receipts — green-tick sent messages
  s.on("chat:read", ({ roomId }) => {
    if (!_activeConv) return;
    const myRoomId = [_me?._id || _me?.id, _activeConv.friendId]
      .sort()
      .join("_");
    if (roomId !== myRoomId) return;
    document.querySelectorAll(".read-tick").forEach((el) => {
      el.style.color = "#7a8f52";
    });
  });

  // Friend gate error from socket — render the same rich card
  s.on("chat:error", ({ code, message, friendStatus, user }) => {
    if (!_activeConv) return;
    const area = document.getElementById("messages-area");

    // Render the rich not-friends card using any user data the socket sent,
    // falling back to the friend info we already loaded in _activeConv.friend
    const cardUser = user || {
      id: _activeConv.friendId,
      name: _activeConv.friend?.name || "",
      handle: _activeConv.friend?.handle || "",
      avatar: _activeConv.friend?.avatar || null,
    };

    renderNotFriendsCard(area, _activeConv.friendId, {
      notFriends: true,
      friendStatus: friendStatus || area.dataset.friendStatus || "none",
      user: cardUser,
    });

    const ta = document.getElementById("chat-textarea");
    const sb = document.getElementById("send-btn");
    if (ta) {
      ta.disabled = true;
      ta.placeholder = "Add this person as a friend to chat";
    }
    if (sb) sb.disabled = true;

    if (_activeConv) _activeConv._notFriends = true;
  });
}
// Removed: syncNav(), pickNav(), toggleSidebar(), closeSidebar(), window resize handler
function goBack() {
  document.getElementById("conv-panel").classList.remove("hidden");
  document.getElementById("chat-panel").classList.remove("visible");
}

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Sidebar
  initSidebar();
  populateSidebarUser();
  wireAttachButton();
  bindSocketEvents();
  loadConversations();

  // Wire nav item hrefs
  const navItems = document.querySelectorAll(".nav-item");
  const navRoutes = {
    Home: "../index.html",
    Explore: "explore.html",
    Search: "explore.html",
    Notifications: "dashboard.html",
    Messages: "chat.html",
    Profile: "profile.html",
    Settings: "settings.html",
  };
  navItems.forEach((el) => {
    const label = el.querySelector(".nav-label")?.textContent?.trim();
    if (label && navRoutes[label] && label !== "Messages") {
      el.addEventListener("click", () => {
        window.location.href = navRoutes[label];
      });
    }
    if (label === "Messages") el.classList.add("active");
  });

  // Wire distress button
  document.querySelector(".distress-btn")?.addEventListener("click", () => {
    window.location.href = "create-post.html";
  });
});
