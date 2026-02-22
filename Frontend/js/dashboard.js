// // this prevents access to dashboard without login
// const token = localStorage.getItem("token");

// if (!token) {
//   window.location.href = "login.html";
// }

// this is an logout button in the dash board
// this removes the token

// Important (Minimal Version Note)
// Storing JWT in localStorage is okay for now.
// In production:
// Use HttpOnly cookies
// Add refresh tokens
// Add token expiration handling
// But for now, this is correct.
// function logout() {
//   localStorage.removeItem("token");
//   window.location.href = "login.html";
// }

//claude
// Frontend/js/dashboard.js
// Replaces the inline <script> block from dashboard.html.
// Fetches real data from the backend and renders it into the same
// DOM elements the original static script used.

// /* ══════════════════════════════════════════════════
//    CONFIG & AUTH
// ══════════════════════════════════════════════════ */
// const API = "http://localhost:5000/api";
// const token = localStorage.getItem("token");
// const userData = JSON.parse(localStorage.getItem("user") || "null");

// if (!token) window.location.href = "login.html";

// function authHeaders() {
//   return {
//     "Content-Type": "application/json",
//     Authorization: "Bearer " + token,
//   };
// }

// /* ══════════════════════════════════════════════════
//    TOAST
// ══════════════════════════════════════════════════ */
// let toastT;
// function toast(msg) {
//   clearTimeout(toastT);
//   document.getElementById("toast-msg").textContent = msg;
//   document.getElementById("toast").classList.add("show");
//   toastT = setTimeout(
//     () => document.getElementById("toast").classList.remove("show"),
//     2400,
//   );
// }

// /* ══════════════════════════════════════════════════
//    TYPE  HELPERS
// ══════════════════════════════════════════════════ */
// const TYPE_LABEL = {
//   sos: "Distress Call",
//   tut: "Tutorial",
//   com: "Community",
//   res: "Resource",
// };

// function typeLabel(t) {
//   return TYPE_LABEL[t] || t;
// }

// function esc(str = "") {
//   const d = document.createElement("div");
//   d.textContent = str;
//   return d.innerHTML;
// }

// function timeAgo(dateStr) {
//   if (!dateStr) return "";
//   const diff = (Date.now() - new Date(dateStr)) / 1000;
//   if (diff < 60) return `${Math.floor(diff)}s ago`;
//   if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
//   if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
//   return `${Math.floor(diff / 86400)}d ago`;
// }

// /* ══════════════════════════════════════════════════
//    ① LOAD DASHBOARD  (home section)
//    GET /api/dashboard
// ══════════════════════════════════════════════════ */
// async function loadDashboard() {
//   try {
//     const res = await fetch(`${API}/dashboard`, { headers: authHeaders() });

//     if (res.status === 401) {
//       localStorage.removeItem("token");
//       window.location.href = "login.html";
//       return;
//     }

//     const json = await res.json();
//     if (!json.success) throw new Error(json.message);

//     const {
//       user,
//       feedPosts,
//       sosPosts,
//       myOpenPosts,
//       unreadNotifications,
//       challenges,
//       suggestedFriends,
//     } = json.data;

//     // ── Personalise the greeting ────────────────────
//     if (user) {
//       const nameEl = document.querySelector(".gh-name em");
//       if (nameEl) nameEl.textContent = user.name;

//       // Update sidebar avatar/name
//       const sbName = document.querySelector(".sb-me-name");
//       if (sbName) sbName.textContent = user.name;

//       // Animate stats
//       animateCounter(".sp-num[data-domain='points']", user.points);
//       animateCounter(".sp-num[data-domain='helped']", user.helpedCount);
//       animateCounter(".sp-num[data-domain='posts']", user.postCount);
//       animateCounter(".sp-num[data-domain='friends']", user.friendCount);
//     }

//     // ── Update notification badge ───────────────────
//     const notifBadge = document.querySelector(
//       ".nav-item[data-section='notifications'] .ni-badge",
//     );
//     if (notifBadge && unreadNotifications > 0) {
//       notifBadge.textContent = unreadNotifications;
//     }

//     // ── Render all widgets ──────────────────────────
//     renderFeed(feedPosts || []);
//     renderSosPulse(sosPosts || []);
//     renderOpenPostsWidget(myOpenPosts || []);
//     renderChallenges(challenges || []);
//     renderPeople(suggestedFriends || []);
//   } catch (err) {
//     console.error("[loadDashboard]", err);
//     toast("Failed to load dashboard — retrying…");
//   }
// }

// /* ══════════════════════════════════════════════════
//    ② LOAD NOTIFICATIONS
//    GET /api/dashboard/notifications
// ══════════════════════════════════════════════════ */
// async function loadNotifications() {
//   const cont = document.getElementById("notif-full");
//   if (!cont) return;
//   cont.innerHTML = `<div class="loading-placeholder">Loading…</div>`;

//   try {
//     const res = await fetch(`${API}/dashboard/notifications`, {
//       headers: authHeaders(),
//     });
//     const json = await res.json();
//     if (!json.success) throw new Error(json.message);

//     // Update page subtitle
//     const sub = document.querySelector("#sec-notifications .page-head p");
//     if (sub) sub.textContent = `${json.unread} unread · last updated just now`;

//     renderNotifications(json.data || []);
//   } catch (err) {
//     console.error("[loadNotifications]", err);
//     cont.innerHTML = `<div class="loading-placeholder">Failed to load notifications.</div>`;
//   }
// }

// /* ══════════════════════════════════════════════════
//    ③ MARK ALL READ
//    PATCH /api/dashboard/notifications/read-all
// ══════════════════════════════════════════════════ */
// async function markAllRead() {
//   try {
//     const res = await fetch(`${API}/dashboard/notifications/read-all`, {
//       method: "PATCH",
//       headers: authHeaders(),
//     });
//     const json = await res.json();
//     if (json.success) {
//       toast("All notifications marked as read ✅");
//       // Remove unread styling from rendered items
//       document
//         .querySelectorAll(".notif-item.unread")
//         .forEach((el) => el.classList.remove("unread"));
//       // Zero the badge
//       const badge = document.querySelector(
//         ".nav-item[data-section='notifications'] .ni-badge",
//       );
//       if (badge) badge.textContent = "";
//     }
//   } catch (err) {
//     console.error("[markAllRead]", err);
//     toast("Couldn't mark as read — try again");
//   }
// }

// /* ══════════════════════════════════════════════════
//    ④ LOAD SAVED POSTS
//    GET /api/dashboard/saved
// ══════════════════════════════════════════════════ */
// async function loadSaved() {
//   const cont = document.getElementById("saved-list");
//   if (!cont) return;
//   cont.innerHTML = `<div class="loading-placeholder">Loading…</div>`;

//   try {
//     const res = await fetch(`${API}/dashboard/saved`, {
//       headers: authHeaders(),
//     });
//     const json = await res.json();
//     if (!json.success) throw new Error(json.message);
//     renderSaved(json.data || []);
//   } catch (err) {
//     console.error("[loadSaved]", err);
//     cont.innerHTML = `<div class="loading-placeholder">Failed to load saved posts.</div>`;
//   }
// }

// /* ══════════════════════════════════════════════════
//    ⑤ LOAD PROGRESS
//    GET /api/dashboard/progress
// ══════════════════════════════════════════════════ */
// async function loadProgress() {
//   try {
//     const res = await fetch(`${API}/dashboard/progress`, {
//       headers: authHeaders(),
//     });
//     const json = await res.json();
//     if (!json.success) throw new Error(json.message);

//     const { points, helpedCount, streakDays, badges } = json.data;

//     // Animate progress bar fills
//     setTimeout(() => {
//       document.querySelectorAll(".pr-fill").forEach((el) => {
//         el.style.width = (el.dataset.pct || 0) + "%";
//       });
//     }, 100);

//     renderBadges(badges && badges.length ? badges : DEFAULT_BADGES);
//     renderPtsBreakdown();
//     renderTopTopics("top-topics-pg");
//     renderStreak("streak-row-full", streakDays || 7);
//   } catch (err) {
//     console.error("[loadProgress]", err);
//     // Fall back to static renders so the page isn't blank
//     renderBadges(DEFAULT_BADGES);
//     renderPtsBreakdown();
//     renderTopTopics("top-topics-pg");
//     renderStreak("streak-row-full", 7);
//     setTimeout(() => {
//       document.querySelectorAll(".pr-fill").forEach((el) => {
//         el.style.width = (el.dataset.pct || 0) + "%";
//       });
//     }, 100);
//   }
// }

// /* ══════════════════════════════════════════════════
//    ⑥ TOGGLE CHALLENGE  (join / leave)
//    POST /api/dashboard/challenges/:id/join
// ══════════════════════════════════════════════════ */
// async function toggleChallenge(challengeId, btn, title) {
//   try {
//     const res = await fetch(`${API}/dashboard/challenges/${challengeId}/join`, {
//       method: "POST",
//       headers: authHeaders(),
//     });
//     const json = await res.json();
//     if (!json.success) throw new Error(json.message);

//     btn.classList.toggle("on", json.joined);
//     btn.textContent = json.joined ? "Joined" : "Join";
//     toast(json.joined ? `Joined "${title.slice(0, 28)}…"` : "Left challenge");
//   } catch (err) {
//     console.error("[toggleChallenge]", err);
//     toast("Couldn't update challenge — try again");
//   }
// }

// /* ══════════════════════════════════════════════════
//    ⑦ TOGGLE FOLLOW
//    POST /api/dashboard/follow/:userId
// ══════════════════════════════════════════════════ */
// async function followPerson(userId, btn, name) {
//   try {
//     const res = await fetch(`${API}/dashboard/follow/${userId}`, {
//       method: "POST",
//       headers: authHeaders(),
//     });
//     const json = await res.json();
//     if (!json.success) throw new Error(json.message);

//     btn.classList.toggle("on", json.following);
//     btn.textContent = json.following ? "✓ Following" : "+ Follow";
//     toast(json.following ? `Now following ${name}` : `Unfollowed ${name}`);
//   } catch (err) {
//     console.error("[followPerson]", err);
//     toast("Couldn't update follow — try again");
//   }
// }

// /* ══════════════════════════════════════════════════
//    RENDER FUNCTIONS
//    Same DOM output as the original static script but
//    fed with real API data.
// ══════════════════════════════════════════════════ */

// function renderFeed(posts) {
//   const el = document.getElementById("feed-list");
//   if (!el) return;

//   if (!posts.length) {
//     el.innerHTML = `<div class="loading-placeholder">No posts yet.</div>`;
//     return;
//   }

//   el.innerHTML = posts
//     .map(
//       (p) => `
//     <div class="feed-item">
//       <div class="fi-av" style="background:${p.author?.avatar || "#a8c4d8"}">${(p.author?.name || "?")[0].toUpperCase()}</div>
//       <div class="fi-body">
//         <div class="fi-top">
//           <span class="fi-name">${esc(p.author?.name || "Unknown")}</span>
//           <span class="fi-badge ${p.type}">${typeLabel(p.type)}</span>
//           <span class="fi-time">${timeAgo(p.createdAt)}</span>
//         </div>
//         <div class="fi-text">${esc(p.body || "")}</div>
//         <div class="fi-foot">
//           <span class="fi-stat"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${(p.views || 0).toLocaleString()}</span>
//           <span class="fi-stat"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>${p.replyCount || 0}</span>
//           <span class="fi-stat"><svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>${p.saveCount || 0}</span>
//           <span class="fi-read" onclick="toast('Opening post…')">Read →</span>
//         </div>
//       </div>
//     </div>`,
//     )
//     .join("");
// }

// function renderSosPulse(posts) {
//   const el = document.getElementById("sos-pulse");
//   if (!el) return;

//   if (!posts.length) {
//     el.innerHTML = `<div class="loading-placeholder">No open distress calls right now 🎉</div>`;
//     return;
//   }

//   el.innerHTML = posts
//     .map(
//       (s) => `
//     <div class="sos-live" onclick="toast('Opening distress call…')">
//       <div class="sos-live-top">
//         <div class="sos-live-dot"></div>
//         <span class="sos-live-tag">LIVE · SOS</span>
//       </div>
//       <div class="sos-live-title">${esc(s.title)}</div>
//       <div class="sos-live-meta">
//         <div style="width:20px;height:20px;border-radius:50%;background:#9ec4a0;display:flex;align-items:center;justify-content:center;font-family:'Lora',serif;font-weight:700;font-size:.6rem;color:white;flex-shrink:0">
//           ${(s.author?.name || "?")[0].toUpperCase()}
//         </div>
//         ${esc(s.author?.name || "Unknown")} · ${timeAgo(s.createdAt)} · ${s.replyCount || 0} ${s.replyCount === 1 ? "reply" : "replies"} so far
//       </div>
//     </div>`,
//     )
//     .join("");
// }

// function renderOpenPostsWidget(posts) {
//   const el = document.getElementById("open-posts-widget");
//   if (!el) return;

//   if (!posts.length) {
//     el.innerHTML = `<div class="loading-placeholder">No posts yet — <a href="create-post.html">create one!</a></div>`;
//     return;
//   }

//   el.innerHTML = posts
//     .slice(0, 3)
//     .map(
//       (p) => `
//     <div class="open-post">
//       <div class="op-top">
//         <div class="op-title" onclick="toast('Opening post…')">${esc(p.title)}</div>
//       </div>
//       <div class="op-meta">
//         <span class="op-badge ${p.type}">${typeLabel(p.type)}</span>
//         <span class="op-badge ${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
//         <span class="op-time">${timeAgo(p.createdAt)}</span>
//       </div>
//       <div class="op-stats">
//         <span class="op-stat"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${(p.views || 0).toLocaleString()}</span>
//         <span class="op-stat"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>${p.replyCount || 0}</span>
//       </div>
//     </div>`,
//     )
//     .join("");
// }

// function renderNotifications(notifs) {
//   const el = document.getElementById("notif-full");
//   if (!el) return;

//   if (!notifs.length) {
//     el.innerHTML = `<div class="loading-placeholder">No notifications yet.</div>`;
//     return;
//   }

//   el.innerHTML = notifs
//     .map(
//       (n) => `
//     <div class="notif-item${n.isRead ? "" : " unread"}" onclick="toast('Opening notification…')">
//       <div class="notif-dot ${n.type}">
//         ${{ reply: "💬", helped: "✅", badge: "🏆", sos: "🆘", follow: "👤", milestone: "🎉" }[n.type] || "🔔"}
//       </div>
//       <div class="notif-body">
//         <div class="notif-text">${esc(n.message)}</div>
//         <div class="notif-time">${timeAgo(n.createdAt)}</div>
//       </div>
//     </div>`,
//     )
//     .join("");
// }

// function renderSaved(posts) {
//   const el = document.getElementById("saved-list");
//   if (!el) return;

//   if (!posts.length) {
//     el.innerHTML = `<div class="loading-placeholder">Nothing saved yet — bookmark posts to find them here.</div>`;
//     return;
//   }

//   el.innerHTML = posts
//     .map(
//       (p) => `
//     <div class="open-post" style="margin-bottom:12px">
//       <div class="op-top">
//         <div class="op-title" onclick="toast('Opening post…')">${esc(p.title)}</div>
//         <button onclick="unsavePost('${p.id}', this)" style="background:none;border:none;cursor:pointer;color:var(--text-light);font-size:1rem;padding:0;flex-shrink:0" title="Remove bookmark">🔖</button>
//       </div>
//       <div class="op-meta">
//         <span class="op-badge ${p.type}">${typeLabel(p.type)}</span>
//       </div>
//       <div class="op-stats">
//         <span class="op-stat"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${(p.views || 0).toLocaleString()}</span>
//         <span class="op-stat">by ${esc(p.author?.name || "Unknown")}</span>
//       </div>
//     </div>`,
//     )
//     .join("");
// }

// async function unsavePost(postId, btn) {
//   try {
//     const res = await fetch(`${API}/posts/${postId}/save`, {
//       method: "PATCH",
//       headers: authHeaders(),
//     });
//     const json = await res.json();
//     if (json.success && !json.saved) {
//       btn.closest(".open-post").remove();
//       toast("Bookmark removed");
//     }
//   } catch (err) {
//     toast("Couldn't remove bookmark — try again");
//   }
// }

// function renderChallenges(challenges) {
//   const el = document.getElementById("challenges-list");
//   if (!el) return;

//   if (!challenges.length) {
//     el.innerHTML = `<div class="loading-placeholder">No challenges available right now.</div>`;
//     return;
//   }

//   el.innerHTML = challenges
//     .map(
//       (c) => `
//     <div class="challenge-item">
//       <div class="ch-icon" style="background:${esc(c.iconBg)}">${c.icon}</div>
//       <div class="ch-body">
//         <div class="ch-title">${esc(c.title)}</div>
//         <div class="ch-meta">
//           <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
//           ${c.participantCount} joined${c.endsAt ? ` · ends ${timeAgo(c.endsAt)}` : ""}
//         </div>
//       </div>
//       <button
//         class="ch-join${c.isJoined ? " on" : ""}"
//         onclick="toggleChallenge('${c.id}', this, '${esc(c.title)}')"
//       >${c.isJoined ? "Joined" : "Join"}</button>
//     </div>`,
//     )
//     .join("");
// }

// function renderPeople(users) {
//   const el = document.getElementById("people-list");
//   if (!el) return;

//   if (!users.length) {
//     el.innerHTML = `<div class="loading-placeholder">No suggestions right now.</div>`;
//     return;
//   }

//   el.innerHTML = users
//     .map(
//       (u) => `
//     <div class="people-item">
//       <div class="pp-av" style="background:#a8b8d0">${(u.name || "?")[0].toUpperCase()}</div>
//       <div class="pp-info">
//         <div class="pp-name">${esc(u.name)}</div>
//         <div class="pp-meta">${esc(u.handle || "")}</div>
//       </div>
//       <button
//         class="pp-follow"
//         onclick="followPerson('${u.id}', this, '${esc(u.name)}')"
//       >+ Follow</button>
//     </div>`,
//     )
//     .join("");
// }

// /* ── Static fallbacks (progress section) ──────────── */
// const DEFAULT_BADGES = [
//   { icon: "🏆", label: "Mentor", tier: "gold" },
//   { icon: "⭐", label: "Top Responder", tier: "gold" },
//   { icon: "🏅", label: "Verified Expert", tier: "gold" },
//   { icon: "🧶", label: "Master Dyer", tier: "" },
//   { icon: "💚", label: "Community Pillar", tier: "" },
//   { icon: "📚", label: "Published Author", tier: "" },
//   { icon: "✅", label: "Problem Solver", tier: "" },
//   { icon: "🔥", label: "7-Day Streak", tier: "" },
// ];

// function renderBadges(badges) {
//   const el = document.getElementById("badge-shelf");
//   if (!el) return;
//   el.innerHTML = badges
//     .map(
//       (b) => `
//     <div class="badge-pill${b.tier === "gold" ? " gold" : ""}" onclick="toast('${esc(b.label || b.icon)} badge')">
//       <span class="bp-icon">${b.icon || "🏅"}</span>${esc(b.label || "")}
//     </div>`,
//     )
//     .join("");
// }

// const PTS_BREAKDOWN = [
//   { ic: "💬", label: "Responses given", val: "+1,248" },
//   { ic: "📚", label: "Tutorials posted", val: "+440" },
//   { ic: "🌟", label: "Marked helpful", val: "+286" },
//   { ic: "✅", label: "Resolved issues", val: "+180" },
//   { ic: "👋", label: "Bonuses earned", val: "+50" },
// ];

// function renderPtsBreakdown() {
//   const el = document.getElementById("pts-breakdown");
//   if (!el) return;
//   el.innerHTML =
//     PTS_BREAKDOWN.map(
//       (r) => `
//       <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(122,143,82,.1);font-size:.84rem">
//         <span style="color:var(--text-mid);display:flex;align-items:center;gap:7px"><span style="font-size:.9rem">${r.ic}</span>${r.label}</span>
//         <span style="font-weight:700;color:var(--green)">${r.val}</span>
//       </div>`,
//     ).join("") +
//     `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 0;font-size:.9rem;border-top:2px solid rgba(122,143,82,.18);margin-top:2px">
//       <span style="font-weight:700;color:var(--text-dark)">Total earned</span>
//       <span style="font-family:'Lora',serif;font-weight:700;font-size:1.1rem;color:var(--accent-dark)">2,204 pts</span>
//     </div>`;
// }

// const TOP_TOPICS = [
//   { name: "Pricing & Margins", pct: 90, count: 28 },
//   { name: "Etsy & Marketplaces", pct: 62, count: 19 },
//   { name: "Natural Dyeing", pct: 52, count: 16 },
//   { name: "Business & Legal", pct: 40, count: 12 },
//   { name: "Wholesale", pct: 30, count: 9 },
// ];

// function renderTopTopics(id) {
//   const el = document.getElementById(id);
//   if (!el) return;
//   el.innerHTML = TOP_TOPICS.map(
//     (t, i) => `
//     <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(122,143,82,.1)">
//       <span style="font-family:'Lora',serif;font-weight:700;font-size:.76rem;color:var(--text-light);min-width:16px">${i + 1}</span>
//       <span style="font-size:.82rem;color:var(--text-dark);flex:1">${t.name}</span>
//       <div style="width:56px;height:5px;background:rgba(122,143,82,.15);border-radius:3px;overflow:hidden">
//         <div style="height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-mid));border-radius:3px;width:0;transition:width 1.1s cubic-bezier(.4,0,.2,1)" data-pct="${t.pct}"></div>
//       </div>
//       <span style="font-size:.73rem;color:var(--text-light);min-width:22px;text-align:right">${t.count}</span>
//     </div>`,
//   ).join("");

//   setTimeout(() => {
//     el.querySelectorAll("[data-pct]").forEach(
//       (b) => (b.style.width = b.dataset.pct + "%"),
//     );
//   }, 180);
// }

// function renderStreak(containerId, len) {
//   const el = document.getElementById(containerId);
//   if (!el) return;
//   const labels = ["M", "T", "W", "T", "F", "S", "S"];
//   const states =
//     len >= 7
//       ? ["done", "done", "done", "done", "done", "done", "today"]
//       : labels.map((_, i) => (i < len ? "done" : ""));
//   el.innerHTML = states
//     .map((s, i) => `<div class="streak-day ${s}">${labels[i]}</div>`)
//     .join("");
// }

// /* ══════════════════════════════════════════════════
//    COUNTER ANIMATION
// ══════════════════════════════════════════════════ */
// function animateCounter(selector, target) {
//   const el = document.querySelector(selector);
//   if (!el || !target) return;
//   const dur = 900;
//   const start = performance.now();
//   const step = (now) => {
//     const p = Math.min((now - start) / dur, 1);
//     const e = 1 - Math.pow(1 - p, 3);
//     el.textContent = Math.floor(e * target).toLocaleString();
//     if (p < 1) requestAnimationFrame(step);
//   };
//   requestAnimationFrame(step);
// }

// /* ══════════════════════════════════════════════════
//    SECTION SWITCHING
// ══════════════════════════════════════════════════ */
// function switchSection(name, navEl) {
//   document
//     .querySelectorAll(".dash-section")
//     .forEach((s) => s.classList.remove("on"));
//   document
//     .querySelectorAll(".nav-item")
//     .forEach((n) => n.classList.remove("on"));
//   document.querySelectorAll(".snav").forEach((n) => n.classList.remove("on"));

//   document.getElementById(`sec-${name}`)?.classList.add("on");

//   // Activate matching sidebar nav item
//   document.querySelectorAll(".nav-item").forEach((n) => {
//     if (n.getAttribute("onclick")?.includes(`'${name}'`)) n.classList.add("on");
//   });

//   // Activate subnav
//   if (navEl) {
//     navEl.classList.add("on");
//   } else {
//     document.querySelectorAll(".snav").forEach((n) => {
//       if (n.getAttribute("onclick")?.includes(`'${name}'`))
//         n.classList.add("on");
//     });
//   }

//   // Lazy-load section data
//   if (name === "notifications") loadNotifications();
//   if (name === "saved") loadSaved();
//   if (name === "progress") loadProgress();
//   if (name === "my-posts") renderMyPostsFull();

//   window.scrollTo({ top: 0, behavior: "smooth" });
//   if (window.innerWidth <= 520) closeSidebar();
// }

// function navPick(el, name) {
//   switchSection(name, null);
// }

// /* ══════════════════════════════════════════════════
//    MY POSTS FULL  (uses cached dashboard data)
// ══════════════════════════════════════════════════ */
// let _myPosts = [];

// function renderMyPostsFull() {
//   const el = document.getElementById("my-posts-full");
//   if (!el) return;

//   if (!_myPosts.length) {
//     el.innerHTML = `<div class="loading-placeholder">No posts yet.</div>
//       <button class="btn ghost" style="margin-top:4px" onclick="toast('Opening create post…')">
//         <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
//         Create new post
//       </button>`;
//     return;
//   }

//   el.innerHTML =
//     _myPosts
//       .map(
//         (p) => `
//     <div class="open-post" style="margin-bottom:12px">
//       <div class="op-top">
//         <div class="op-title" onclick="toast('Opening post…')">${esc(p.title)}</div>
//       </div>
//       <div class="op-meta">
//         <span class="op-badge ${p.type}">${typeLabel(p.type)}</span>
//         <span class="op-badge ${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
//         <span class="op-time">${timeAgo(p.createdAt)}</span>
//       </div>
//       <div class="op-stats">
//         <span class="op-stat"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${(p.views || 0).toLocaleString()}</span>
//         <span class="op-stat"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>${p.replyCount || 0}</span>
//       </div>
//     </div>`,
//       )
//       .join("") +
//     `<button class="btn ghost" style="margin-top:4px" onclick="toast('Opening create post…')">
//       <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
//       Create new post
//     </button>`;
// }

// /* ══════════════════════════════════════════════════
//    SIDEBAR HELPERS
// ══════════════════════════════════════════════════ */
// function toggleSidebar() {
//   const sb = document.getElementById("sidebar");
//   const open = sb.classList.toggle("open");
//   document.getElementById("overlay").classList.toggle("on", open);
// }

// function closeSidebar() {
//   document.getElementById("sidebar")?.classList.remove("open");
//   document.getElementById("overlay")?.classList.remove("on");
// }

// window.addEventListener("resize", () => {
//   if (window.innerWidth > 520) closeSidebar();
// });

// /* ══════════════════════════════════════════════════
//    INIT
// ══════════════════════════════════════════════════ */
// document.addEventListener("DOMContentLoaded", async () => {
//   renderStreak("streak-row", 7); // render immediately; real value fills in after API

//   await loadDashboard(); // fetches and caches _myPosts
// });

// Frontend/js/dashboard.js
// Replaces the inline <script> block from dashboard.html.
// Fetches real data from the backend and renders it into the same
// DOM elements the original static script used.

/* ══════════════════════════════════════════════════
   CONFIG & AUTH
══════════════════════════════════════════════════ */
const API = "http://localhost:5000/api";
const token = localStorage.getItem("token");
const userData = JSON.parse(localStorage.getItem("user") || "null");

if (!token) window.location.href = "login.html";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  };
}

/* ══════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════ */
let toastT;
function toast(msg) {
  clearTimeout(toastT);
  document.getElementById("toast-msg").textContent = msg;
  document.getElementById("toast").classList.add("show");
  toastT = setTimeout(
    () => document.getElementById("toast").classList.remove("show"),
    2400,
  );
}

/* ══════════════════════════════════════════════════
   TYPE  HELPERS
══════════════════════════════════════════════════ */
const TYPE_LABEL = {
  sos: "Distress Call",
  tut: "Tutorial",
  com: "Community",
  res: "Resource",
};

function typeLabel(t) {
  return TYPE_LABEL[t] || t;
}

function esc(str = "") {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/* ══════════════════════════════════════════════════
   ① LOAD DASHBOARD  (home section)
   GET /api/dashboard
══════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const res = await fetch(`${API}/dashboard`, { headers: authHeaders() });

    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "login.html";
      return;
    }

    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const {
      user,
      feedPosts,
      sosPosts,
      myOpenPosts,
      unreadNotifications,
      challenges,
      suggestedFriends,
    } = json.data;

    // ── Personalise the greeting ────────────────────
    if (user) {
      const nameEl = document.querySelector(".gh-name em");
      if (nameEl) nameEl.textContent = user.name;

      // Update sidebar avatar/name
      const sbName = document.querySelector(".sb-me-name");
      if (sbName) sbName.textContent = user.name;

      // Animate stats
      animateCounter(".sp-num[data-domain='points']", user.points);
      animateCounter(".sp-num[data-domain='helped']", user.helpedCount);
      animateCounter(".sp-num[data-domain='posts']", user.postCount);
      animateCounter(".sp-num[data-domain='friends']", user.friendCount);
    }

    // ── Update notification badge ───────────────────
    const notifBadge = document.querySelector(
      ".nav-item[data-section='notifications'] .ni-badge",
    );
    if (notifBadge && unreadNotifications > 0) {
      notifBadge.textContent = unreadNotifications;
    }

    // ── Cache myOpenPosts so renderMyPostsFull() has data ─
    // ✅ Bug fix: _myPosts was declared but never assigned, causing
    //    the "My Posts" tab to always show empty.
    _myPosts = myOpenPosts || [];

    // ── Render all widgets ──────────────────────────
    renderFeed(feedPosts || []);
    renderSosPulse(sosPosts || []);
    renderOpenPostsWidget(_myPosts);
    renderChallenges(challenges || []);
    renderPeople(suggestedFriends || []);
  } catch (err) {
    console.error("[loadDashboard]", err);
    toast("Failed to load dashboard — retrying…");
  }
}

/* ══════════════════════════════════════════════════
   ② LOAD NOTIFICATIONS
   GET /api/dashboard/notifications
══════════════════════════════════════════════════ */
async function loadNotifications() {
  const cont = document.getElementById("notif-full");
  if (!cont) return;
  cont.innerHTML = `<div class="loading-placeholder">Loading…</div>`;

  try {
    const res = await fetch(`${API}/dashboard/notifications`, {
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    // Update page subtitle
    const sub = document.querySelector("#sec-notifications .page-head p");
    if (sub) sub.textContent = `${json.unread} unread · last updated just now`;

    renderNotifications(json.data || []);
  } catch (err) {
    console.error("[loadNotifications]", err);
    cont.innerHTML = `<div class="loading-placeholder">Failed to load notifications.</div>`;
  }
}

/* ══════════════════════════════════════════════════
   ③ MARK ALL READ
   PATCH /api/dashboard/notifications/read-all
══════════════════════════════════════════════════ */
async function markAllRead() {
  try {
    const res = await fetch(`${API}/dashboard/notifications/read-all`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    const json = await res.json();
    if (json.success) {
      toast("All notifications marked as read ✅");
      // Remove unread styling from rendered items
      document
        .querySelectorAll(".notif-item.unread")
        .forEach((el) => el.classList.remove("unread"));
      // Zero the badge
      const badge = document.querySelector(
        ".nav-item[data-section='notifications'] .ni-badge",
      );
      if (badge) badge.textContent = "";
    }
  } catch (err) {
    console.error("[markAllRead]", err);
    toast("Couldn't mark as read — try again");
  }
}

/* ══════════════════════════════════════════════════
   ④ LOAD SAVED POSTS
   GET /api/dashboard/saved
══════════════════════════════════════════════════ */
async function loadSaved() {
  const cont = document.getElementById("saved-list");
  if (!cont) return;
  cont.innerHTML = `<div class="loading-placeholder">Loading…</div>`;

  try {
    const res = await fetch(`${API}/dashboard/saved`, {
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    renderSaved(json.data || []);
  } catch (err) {
    console.error("[loadSaved]", err);
    cont.innerHTML = `<div class="loading-placeholder">Failed to load saved posts.</div>`;
  }
}

/* ══════════════════════════════════════════════════
   ⑤ LOAD PROGRESS
   GET /api/dashboard/progress
══════════════════════════════════════════════════ */
async function loadProgress() {
  try {
    const res = await fetch(`${API}/dashboard/progress`, {
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    const { points, helpedCount, streakDays, badges } = json.data;

    // Animate progress bar fills
    setTimeout(() => {
      document.querySelectorAll(".pr-fill").forEach((el) => {
        el.style.width = (el.dataset.pct || 0) + "%";
      });
    }, 100);

    renderBadges(badges && badges.length ? badges : DEFAULT_BADGES);
    renderPtsBreakdown();
    renderTopTopics("top-topics-pg");
    renderStreak("streak-row-full", streakDays || 7);
  } catch (err) {
    console.error("[loadProgress]", err);
    // Fall back to static renders so the page isn't blank
    renderBadges(DEFAULT_BADGES);
    renderPtsBreakdown();
    renderTopTopics("top-topics-pg");
    renderStreak("streak-row-full", 7);
    setTimeout(() => {
      document.querySelectorAll(".pr-fill").forEach((el) => {
        el.style.width = (el.dataset.pct || 0) + "%";
      });
    }, 100);
  }
}

/* ══════════════════════════════════════════════════
   ⑥ TOGGLE CHALLENGE  (join / leave)
   POST /api/dashboard/challenges/:id/join
══════════════════════════════════════════════════ */
async function toggleChallenge(challengeId, btn, title) {
  try {
    const res = await fetch(`${API}/dashboard/challenges/${challengeId}/join`, {
      method: "POST",
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    btn.classList.toggle("on", json.joined);
    btn.textContent = json.joined ? "Joined" : "Join";
    toast(json.joined ? `Joined "${title.slice(0, 28)}…"` : "Left challenge");
  } catch (err) {
    console.error("[toggleChallenge]", err);
    toast("Couldn't update challenge — try again");
  }
}

/* ══════════════════════════════════════════════════
   ⑦ TOGGLE FOLLOW
   POST /api/dashboard/follow/:userId
══════════════════════════════════════════════════ */
async function followPerson(userId, btn, name) {
  try {
    const res = await fetch(`${API}/dashboard/follow/${userId}`, {
      method: "POST",
      headers: authHeaders(),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);

    btn.classList.toggle("on", json.following);
    btn.textContent = json.following ? "✓ Following" : "+ Follow";
    toast(json.following ? `Now following ${name}` : `Unfollowed ${name}`);
  } catch (err) {
    console.error("[followPerson]", err);
    toast("Couldn't update follow — try again");
  }
}

/* ══════════════════════════════════════════════════
   RENDER FUNCTIONS
   Same DOM output as the original static script but
   fed with real API data.
══════════════════════════════════════════════════ */

function renderFeed(posts) {
  const el = document.getElementById("feed-list");
  if (!el) return;

  if (!posts.length) {
    el.innerHTML = `<div class="loading-placeholder">No posts yet.</div>`;
    return;
  }

  el.innerHTML = posts
    .map(
      (p) => `
    <div class="feed-item">
      <div class="fi-av" style="background:${p.author?.avatar || "#a8c4d8"}">${(p.author?.name || "?")[0].toUpperCase()}</div>
      <div class="fi-body">
        <div class="fi-top">
          <span class="fi-name">${esc(p.author?.name || "Unknown")}</span>
          <span class="fi-badge ${p.type}">${typeLabel(p.type)}</span>
          <span class="fi-time">${timeAgo(p.createdAt)}</span>
        </div>
        <div class="fi-text">${esc(p.body || "")}</div>
        <div class="fi-foot">
          <span class="fi-stat"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${(p.views || 0).toLocaleString()}</span>
          <span class="fi-stat"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>${p.replyCount || 0}</span>
          <span class="fi-stat"><svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>${p.saveCount || 0}</span>
          <span class="fi-read" onclick="toast('Opening post…')">Read →</span>
        </div>
      </div>
    </div>`,
    )
    .join("");
}

function renderSosPulse(posts) {
  const el = document.getElementById("sos-pulse");
  if (!el) return;

  if (!posts.length) {
    el.innerHTML = `<div class="loading-placeholder">No open distress calls right now 🎉</div>`;
    return;
  }

  el.innerHTML = posts
    .map(
      (s) => `
    <div class="sos-live" onclick="toast('Opening distress call…')">
      <div class="sos-live-top">
        <div class="sos-live-dot"></div>
        <span class="sos-live-tag">LIVE · SOS</span>
      </div>
      <div class="sos-live-title">${esc(s.title)}</div>
      <div class="sos-live-meta">
        <div style="width:20px;height:20px;border-radius:50%;background:#9ec4a0;display:flex;align-items:center;justify-content:center;font-family:'Lora',serif;font-weight:700;font-size:.6rem;color:white;flex-shrink:0">
          ${(s.author?.name || "?")[0].toUpperCase()}
        </div>
        ${esc(s.author?.name || "Unknown")} · ${timeAgo(s.createdAt)} · ${s.replyCount || 0} ${s.replyCount === 1 ? "reply" : "replies"} so far
      </div>
    </div>`,
    )
    .join("");
}

function renderOpenPostsWidget(posts) {
  const el = document.getElementById("open-posts-widget");
  if (!el) return;

  if (!posts.length) {
    el.innerHTML = `<div class="loading-placeholder">No posts yet — <a href="create-post.html">create one!</a></div>`;
    return;
  }

  el.innerHTML = posts
    .slice(0, 3)
    .map(
      (p) => `
    <div class="open-post">
      <div class="op-top">
        <div class="op-title" onclick="toast('Opening post…')">${esc(p.title)}</div>
      </div>
      <div class="op-meta">
        <span class="op-badge ${p.type}">${typeLabel(p.type)}</span>
        <span class="op-badge ${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
        <span class="op-time">${timeAgo(p.createdAt)}</span>
      </div>
      <div class="op-stats">
        <span class="op-stat"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${(p.views || 0).toLocaleString()}</span>
        <span class="op-stat"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>${p.replyCount || 0}</span>
      </div>
    </div>`,
    )
    .join("");
}

function renderNotifications(notifs) {
  const el = document.getElementById("notif-full");
  if (!el) return;

  if (!notifs.length) {
    el.innerHTML = `<div class="loading-placeholder">No notifications yet.</div>`;
    return;
  }

  el.innerHTML = notifs
    .map(
      (n) => `
    <div class="notif-item${n.isRead ? "" : " unread"}" onclick="toast('Opening notification…')">
      <div class="notif-dot ${n.type}">
        ${{ reply: "💬", helped: "✅", badge: "🏆", sos: "🆘", follow: "👤", milestone: "🎉" }[n.type] || "🔔"}
      </div>
      <div class="notif-body">
        <div class="notif-text">${esc(n.message)}</div>
        <div class="notif-time">${timeAgo(n.createdAt)}</div>
      </div>
    </div>`,
    )
    .join("");
}

function renderSaved(posts) {
  const el = document.getElementById("saved-list");
  if (!el) return;

  if (!posts.length) {
    el.innerHTML = `<div class="loading-placeholder">Nothing saved yet — bookmark posts to find them here.</div>`;
    return;
  }

  el.innerHTML = posts
    .map(
      (p) => `
    <div class="open-post" style="margin-bottom:12px">
      <div class="op-top">
        <div class="op-title" onclick="toast('Opening post…')">${esc(p.title)}</div>
        <button onclick="unsavePost('${p.id}', this)" style="background:none;border:none;cursor:pointer;color:var(--text-light);font-size:1rem;padding:0;flex-shrink:0" title="Remove bookmark">🔖</button>
      </div>
      <div class="op-meta">
        <span class="op-badge ${p.type}">${typeLabel(p.type)}</span>
      </div>
      <div class="op-stats">
        <span class="op-stat"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${(p.views || 0).toLocaleString()}</span>
        <span class="op-stat">by ${esc(p.author?.name || "Unknown")}</span>
      </div>
    </div>`,
    )
    .join("");
}

async function unsavePost(postId, btn) {
  try {
    const res = await fetch(`${API}/posts/${postId}/save`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    const json = await res.json();
    if (json.success && !json.saved) {
      btn.closest(".open-post").remove();
      toast("Bookmark removed");
    }
  } catch (err) {
    toast("Couldn't remove bookmark — try again");
  }
}

function renderChallenges(challenges) {
  const el = document.getElementById("challenges-list");
  if (!el) return;

  if (!challenges.length) {
    el.innerHTML = `<div class="loading-placeholder">No challenges available right now.</div>`;
    return;
  }

  el.innerHTML = challenges
    .map(
      (c) => `
    <div class="challenge-item">
      <div class="ch-icon" style="background:${esc(c.iconBg)}">${c.icon}</div>
      <div class="ch-body">
        <div class="ch-title">${esc(c.title)}</div>
        <div class="ch-meta">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${c.participantCount} joined${c.endsAt ? ` · ends ${timeAgo(c.endsAt)}` : ""}
        </div>
      </div>
      <button
        class="ch-join${c.isJoined ? " on" : ""}"
        onclick="toggleChallenge('${c.id}', this, '${esc(c.title)}')"
      >${c.isJoined ? "Joined" : "Join"}</button>
    </div>`,
    )
    .join("");
}

function renderPeople(users) {
  const el = document.getElementById("people-list");
  if (!el) return;

  if (!users.length) {
    el.innerHTML = `<div class="loading-placeholder">No suggestions right now.</div>`;
    return;
  }

  el.innerHTML = users
    .map(
      (u) => `
    <div class="people-item">
      <div class="pp-av" style="background:#a8b8d0">${(u.name || "?")[0].toUpperCase()}</div>
      <div class="pp-info">
        <div class="pp-name">${esc(u.name)}</div>
        <div class="pp-meta">${esc(u.handle || "")}</div>
      </div>
      <button
        class="pp-follow"
        onclick="followPerson('${u.id}', this, '${esc(u.name)}')"
      >+ Follow</button>
    </div>`,
    )
    .join("");
}

/* ── Static fallbacks (progress section) ──────────── */
const DEFAULT_BADGES = [
  { icon: "🏆", label: "Mentor", tier: "gold" },
  { icon: "⭐", label: "Top Responder", tier: "gold" },
  { icon: "🏅", label: "Verified Expert", tier: "gold" },
  { icon: "🧶", label: "Master Dyer", tier: "" },
  { icon: "💚", label: "Community Pillar", tier: "" },
  { icon: "📚", label: "Published Author", tier: "" },
  { icon: "✅", label: "Problem Solver", tier: "" },
  { icon: "🔥", label: "7-Day Streak", tier: "" },
];

function renderBadges(badges) {
  const el = document.getElementById("badge-shelf");
  if (!el) return;
  el.innerHTML = badges
    .map(
      (b) => `
    <div class="badge-pill${b.tier === "gold" ? " gold" : ""}" onclick="toast('${esc(b.label || b.icon)} badge')">
      <span class="bp-icon">${b.icon || "🏅"}</span>${esc(b.label || "")}
    </div>`,
    )
    .join("");
}

const PTS_BREAKDOWN = [
  { ic: "💬", label: "Responses given", val: "+1,248" },
  { ic: "📚", label: "Tutorials posted", val: "+440" },
  { ic: "🌟", label: "Marked helpful", val: "+286" },
  { ic: "✅", label: "Resolved issues", val: "+180" },
  { ic: "👋", label: "Bonuses earned", val: "+50" },
];

function renderPtsBreakdown() {
  const el = document.getElementById("pts-breakdown");
  if (!el) return;
  el.innerHTML =
    PTS_BREAKDOWN.map(
      (r) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(122,143,82,.1);font-size:.84rem">
        <span style="color:var(--text-mid);display:flex;align-items:center;gap:7px"><span style="font-size:.9rem">${r.ic}</span>${r.label}</span>
        <span style="font-weight:700;color:var(--green)">${r.val}</span>
      </div>`,
    ).join("") +
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0 0;font-size:.9rem;border-top:2px solid rgba(122,143,82,.18);margin-top:2px">
      <span style="font-weight:700;color:var(--text-dark)">Total earned</span>
      <span style="font-family:'Lora',serif;font-weight:700;font-size:1.1rem;color:var(--accent-dark)">2,204 pts</span>
    </div>`;
}

const TOP_TOPICS = [
  { name: "Pricing & Margins", pct: 90, count: 28 },
  { name: "Etsy & Marketplaces", pct: 62, count: 19 },
  { name: "Natural Dyeing", pct: 52, count: 16 },
  { name: "Business & Legal", pct: 40, count: 12 },
  { name: "Wholesale", pct: 30, count: 9 },
];

function renderTopTopics(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = TOP_TOPICS.map(
    (t, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(122,143,82,.1)">
      <span style="font-family:'Lora',serif;font-weight:700;font-size:.76rem;color:var(--text-light);min-width:16px">${i + 1}</span>
      <span style="font-size:.82rem;color:var(--text-dark);flex:1">${t.name}</span>
      <div style="width:56px;height:5px;background:rgba(122,143,82,.15);border-radius:3px;overflow:hidden">
        <div style="height:100%;background:linear-gradient(90deg,var(--accent),var(--accent-mid));border-radius:3px;width:0;transition:width 1.1s cubic-bezier(.4,0,.2,1)" data-pct="${t.pct}"></div>
      </div>
      <span style="font-size:.73rem;color:var(--text-light);min-width:22px;text-align:right">${t.count}</span>
    </div>`,
  ).join("");

  setTimeout(() => {
    el.querySelectorAll("[data-pct]").forEach(
      (b) => (b.style.width = b.dataset.pct + "%"),
    );
  }, 180);
}

function renderStreak(containerId, len) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const states =
    len >= 7
      ? ["done", "done", "done", "done", "done", "done", "today"]
      : labels.map((_, i) => (i < len ? "done" : ""));
  el.innerHTML = states
    .map((s, i) => `<div class="streak-day ${s}">${labels[i]}</div>`)
    .join("");
}

/* ══════════════════════════════════════════════════
   COUNTER ANIMATION
══════════════════════════════════════════════════ */
function animateCounter(selector, target) {
  const el = document.querySelector(selector);
  if (!el || !target) return;
  const dur = 900;
  const start = performance.now();
  const step = (now) => {
    const p = Math.min((now - start) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(e * target).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ══════════════════════════════════════════════════
   SECTION SWITCHING
══════════════════════════════════════════════════ */
function switchSection(name, navEl) {
  document
    .querySelectorAll(".dash-section")
    .forEach((s) => s.classList.remove("on"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("on"));
  document.querySelectorAll(".snav").forEach((n) => n.classList.remove("on"));

  document.getElementById(`sec-${name}`)?.classList.add("on");

  // Activate matching sidebar nav item
  document.querySelectorAll(".nav-item").forEach((n) => {
    if (n.getAttribute("onclick")?.includes(`'${name}'`)) n.classList.add("on");
  });

  // Activate subnav
  if (navEl) {
    navEl.classList.add("on");
  } else {
    document.querySelectorAll(".snav").forEach((n) => {
      if (n.getAttribute("onclick")?.includes(`'${name}'`))
        n.classList.add("on");
    });
  }

  // Lazy-load section data
  if (name === "notifications") loadNotifications();
  if (name === "saved") loadSaved();
  if (name === "progress") loadProgress();
  if (name === "my-posts") renderMyPostsFull();

  window.scrollTo({ top: 0, behavior: "smooth" });
  if (window.innerWidth <= 520) closeSidebar();
}

function navPick(el, name) {
  switchSection(name, null);
}

/* ══════════════════════════════════════════════════
   MY POSTS FULL  (uses cached dashboard data)
══════════════════════════════════════════════════ */
let _myPosts = [];

function renderMyPostsFull() {
  const el = document.getElementById("my-posts-full");
  if (!el) return;

  if (!_myPosts.length) {
    el.innerHTML = `<div class="loading-placeholder">No posts yet.</div>
      <button class="btn ghost" style="margin-top:4px" onclick="toast('Opening create post…')">
        <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Create new post
      </button>`;
    return;
  }

  el.innerHTML =
    _myPosts
      .map(
        (p) => `
    <div class="open-post" style="margin-bottom:12px">
      <div class="op-top">
        <div class="op-title" onclick="toast('Opening post…')">${esc(p.title)}</div>
      </div>
      <div class="op-meta">
        <span class="op-badge ${p.type}">${typeLabel(p.type)}</span>
        <span class="op-badge ${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
        <span class="op-time">${timeAgo(p.createdAt)}</span>
      </div>
      <div class="op-stats">
        <span class="op-stat"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${(p.views || 0).toLocaleString()}</span>
        <span class="op-stat"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>${p.replyCount || 0}</span>
      </div>
    </div>`,
      )
      .join("") +
    `<button class="btn ghost" style="margin-top:4px" onclick="toast('Opening create post…')">
      <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Create new post
    </button>`;
}

/* ══════════════════════════════════════════════════
   SIDEBAR HELPERS
══════════════════════════════════════════════════ */
function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  const open = sb.classList.toggle("open");
  document.getElementById("overlay").classList.toggle("on", open);
}

function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("overlay")?.classList.remove("on");
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 520) closeSidebar();
});

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  renderStreak("streak-row", 7); // render immediately; real value fills in after API

  await loadDashboard(); // fetches and caches _myPosts
});
