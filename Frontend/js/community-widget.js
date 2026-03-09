// /* ═══════════════════════════════════════════════════════════════════════════
//    CRAFT-SOS  —  community-widgets.js
//    Drop this file in:  Frontend/js/community-widgets.js

//    HOW TO USE IN ANY PAGE
//    ──────────────────────
//    1. Add the widget containers anywhere in your HTML (right-rail aside, etc.):

//       <!-- Announcement banner — floats at page top, auto-dismisses -->
//       <div id="widget-announcements"></div>

//       <!-- Active challenges widget -->
//       <div id="widget-challenges"></div>

//       <!-- Badge showcase widget -->
//       <div id="widget-badges"></div>

//    2. Include this script at the bottom of <body>:
//       <script src="../js/community-widgets.js"></script>

//    3. Done. Each widget auto-loads from /api/community/*.
//       They're fully independent — missing containers are silently skipped.

//    USER TOKEN (for Join buttons):
//    ──────────────────────────────
//    The join button calls POST /api/community/challenges/:id/join with the
//    user's JWT from localStorage. If no token is found, clicking Join redirects
//    to the login page instead.

//    DESIGN:
//    ───────
//    All styles are injected inline — no external CSS file needed.
//    Matches Craft-SOS palette: earthy greens, Lora headings, DM Sans body.
// ═══════════════════════════════════════════════════════════════════════════ */

// (function () {
//   "use strict";

//   /* ─── Config ───────────────────────────────────────────── */
//   const API_BASE = "/api/community";
//   const TOKEN_KEY = "token"; // key used by your main app to store user JWT
//   const LOGIN_URL = "/pages/login.html"; // redirect if not logged in

//   /* ─── Palette / design tokens ──────────────────────────── */
//   const C = {
//     accent: "#7a8f52",
//     accentPale: "rgba(122,143,82,.10)",
//     accentMid: "rgba(122,143,82,.18)",
//     surface: "#f8f6f1",
//     card: "#ffffff",
//     border: "#ddd9d0",
//     text: "#2c2822",
//     textMid: "#6b6560",
//     textDim: "#9a9690",
//     high: "#c0432a",
//     highPale: "rgba(192,67,42,.09)",
//     blue: "#3a6ea8",
//     bluePale: "rgba(58,110,168,.09)",
//     purple: "#7258b0",
//     purplePale: "rgba(114,88,176,.09)",
//     med: "#b07820",
//     medPale: "rgba(176,120,32,.10)",
//     radius: "14px",
//     radiusSm: "10px",
//     shadow: "0 2px 16px rgba(0,0,0,.07)",
//   };

//   /* ─── Utilities ─────────────────────────────────────────── */
//   const esc = (s) =>
//     String(s ?? "").replace(
//       /[&<>"']/g,
//       (c) =>
//         ({
//           "&": "&amp;",
//           "<": "&lt;",
//           ">": "&gt;",
//           '"': "&quot;",
//           "'": "&#39;",
//         })[c],
//     );

//   const timeAgo = (d) => {
//     if (!d) return "";
//     const s = (Date.now() - new Date(d)) / 1000;
//     if (s < 3600) return Math.floor(s / 60) + "m ago";
//     if (s < 86400) return Math.floor(s / 3600) + "h ago";
//     if (s < 86400 * 7) return Math.floor(s / 86400) + "d ago";
//     return new Date(d).toLocaleDateString("en-IN", {
//       month: "short",
//       day: "numeric",
//     });
//   };

//   const daysLeft = (d) => {
//     if (!d) return null;
//     const days = Math.ceil((new Date(d) - Date.now()) / 86400000);
//     return days > 0 ? days : 0;
//   };

//   const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
//   const getUserId = () => {
//     try {
//       const t = getToken();
//       if (!t) return null;
//       return JSON.parse(atob(t.split(".")[1]))?.userId || null;
//     } catch {
//       return null;
//     }
//   };

//   const apiFetch = async (path, opts = {}) => {
//     const token = getToken();
//     const headers = { "Content-Type": "application/json" };
//     if (token) headers["Authorization"] = "Bearer " + token;
//     const res = await fetch(API_BASE + path, { ...opts, headers });
//     const data = await res.json().catch(() => ({}));
//     if (!res.ok) throw new Error(data.message || "Request failed");
//     return data;
//   };

//   /* ─── Inject global styles once ────────────────────────── */
//   function injectStyles() {
//     if (document.getElementById("cw-styles")) return;
//     const style = document.createElement("style");
//     style.id = "cw-styles";
//     style.textContent = `
//       /* ── Widget shell ── */
//       .cw-widget {
//         background: ${C.card};
//         border: 1px solid ${C.border};
//         border-radius: ${C.radius};
//         box-shadow: ${C.shadow};
//         overflow: hidden;
//         margin-bottom: 18px;
//         font-family: 'DM Sans', system-ui, sans-serif;
//       }
//       .cw-widget-head {
//         display: flex;
//         align-items: center;
//         gap: 8px;
//         padding: 14px 16px 12px;
//         border-bottom: 1px solid ${C.border};
//       }
//       .cw-widget-icon {
//         font-size: 1rem;
//         line-height: 1;
//       }
//       .cw-widget-title {
//         font-family: 'Lora', Georgia, serif;
//         font-weight: 700;
//         font-size: 0.88rem;
//         color: ${C.text};
//         flex: 1;
//       }
//       .cw-widget-badge {
//         background: ${C.accentMid};
//         color: ${C.accent};
//         font-size: 0.68rem;
//         font-weight: 700;
//         padding: 2px 7px;
//         border-radius: 20px;
//       }
//       .cw-widget-body { padding: 12px 14px; }
//       .cw-empty {
//         color: ${C.textDim};
//         font-size: 0.8rem;
//         text-align: center;
//         padding: 14px 0;
//       }

//       /* ── Challenges ── */
//       .cw-ch-item {
//         display: flex;
//         align-items: flex-start;
//         gap: 10px;
//         padding: 10px 0;
//         border-bottom: 1px solid ${C.border};
//       }
//       .cw-ch-item:last-child { border-bottom: none; padding-bottom: 0; }
//       .cw-ch-ico {
//         width: 36px; height: 36px;
//         border-radius: 10px;
//         display: flex; align-items: center; justify-content: center;
//         font-size: 1.1rem;
//         flex-shrink: 0;
//       }
//       .cw-ch-info { flex: 1; min-width: 0; }
//       .cw-ch-title {
//         font-weight: 600;
//         font-size: 0.83rem;
//         color: ${C.text};
//         white-space: nowrap;
//         overflow: hidden;
//         text-overflow: ellipsis;
//         margin-bottom: 2px;
//       }
//       .cw-ch-meta {
//         font-size: 0.72rem;
//         color: ${C.textDim};
//         display: flex;
//         align-items: center;
//         gap: 6px;
//         flex-wrap: wrap;
//       }
//       .cw-ch-dot { width: 3px; height: 3px; border-radius: 50%; background: ${C.border}; }
//       .cw-ch-deadline { color: ${C.high}; font-weight: 600; }
//       .cw-join-btn {
//         font-size: 0.72rem;
//         font-weight: 700;
//         padding: 5px 10px;
//         border-radius: 8px;
//         border: 1.5px solid ${C.accent};
//         background: transparent;
//         color: ${C.accent};
//         cursor: pointer;
//         white-space: nowrap;
//         transition: all .18s;
//         flex-shrink: 0;
//         font-family: inherit;
//       }
//       .cw-join-btn:hover { background: ${C.accentPale}; }
//       .cw-join-btn.joined {
//         background: ${C.accent};
//         color: #fff;
//         border-color: ${C.accent};
//       }
//       .cw-join-btn:disabled { opacity: .5; cursor: default; }

//       /* ── Announcements banner ── */
//       .cw-ann-banner {
//         border-radius: ${C.radius};
//         border: 1px solid;
//         padding: 11px 14px;
//         margin-bottom: 10px;
//         display: flex;
//         align-items: flex-start;
//         gap: 10px;
//         position: relative;
//         font-family: 'DM Sans', system-ui, sans-serif;
//         animation: cwFadeIn .3s ease both;
//       }
//       .cw-ann-banner:last-child { margin-bottom: 0; }
//       .cw-ann-ico { font-size: 1.1rem; flex-shrink: 0; line-height: 1.4; }
//       .cw-ann-content { flex: 1; min-width: 0; }
//       .cw-ann-title {
//         font-weight: 700;
//         font-size: 0.82rem;
//         margin-bottom: 2px;
//       }
//       .cw-ann-body {
//         font-size: 0.76rem;
//         line-height: 1.45;
//         color: ${C.textMid};
//         overflow: hidden;
//         display: -webkit-box;
//         -webkit-line-clamp: 2;
//         -webkit-box-orient: vertical;
//       }
//       .cw-ann-time { font-size: 0.68rem; color: ${C.textDim}; margin-top: 3px; }
//       .cw-ann-close {
//         position: absolute;
//         top: 8px; right: 10px;
//         background: none; border: none;
//         font-size: 1rem; cursor: pointer;
//         color: ${C.textDim};
//         line-height: 1;
//         padding: 0;
//         font-family: inherit;
//       }
//       .cw-ann-close:hover { color: ${C.text}; }

//       /* type colours */
//       .cw-ann-announcement {
//         background: ${C.bluePale};
//         border-color: rgba(58,110,168,.25);
//       }
//       .cw-ann-announcement .cw-ann-title { color: ${C.blue}; }
//       .cw-ann-challenge {
//         background: ${C.accentPale};
//         border-color: rgba(122,143,82,.25);
//       }
//       .cw-ann-challenge .cw-ann-title { color: ${C.accent}; }
//       .cw-ann-safety_notice {
//         background: ${C.highPale};
//         border-color: rgba(192,67,42,.25);
//       }
//       .cw-ann-safety_notice .cw-ann-title { color: ${C.high}; }
//       .cw-ann-spotlight, .cw-ann-feature_update {
//         background: ${C.purplePale};
//         border-color: rgba(114,88,176,.25);
//       }
//       .cw-ann-spotlight .cw-ann-title,
//       .cw-ann-feature_update .cw-ann-title { color: ${C.purple}; }
//       .cw-ann-notification {
//         background: ${C.medPale};
//         border-color: rgba(176,120,32,.25);
//       }
//       .cw-ann-notification .cw-ann-title { color: ${C.med}; }

//       /* ── Badges ── */
//       .cw-badge-grid {
//         display: grid;
//         grid-template-columns: repeat(3, 1fr);
//         gap: 8px;
//       }
//       .cw-badge-tile {
//         background: ${C.surface};
//         border: 1px solid ${C.border};
//         border-radius: ${C.radiusSm};
//         padding: 10px 6px;
//         text-align: center;
//         transition: transform .18s, box-shadow .18s;
//         cursor: default;
//       }
//       .cw-badge-tile:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.09); }
//       .cw-badge-em { font-size: 1.5rem; line-height: 1; margin-bottom: 5px; }
//       .cw-badge-name {
//         font-size: 0.69rem;
//         font-weight: 700;
//         color: ${C.text};
//         white-space: nowrap;
//         overflow: hidden;
//         text-overflow: ellipsis;
//       }
//       .cw-badge-cnt { font-size: 0.65rem; color: ${C.textDim}; margin-top: 2px; }
//       .cw-badge-latest {
//         margin-top: 12px;
//         padding-top: 10px;
//         border-top: 1px solid ${C.border};
//         font-size: 0.75rem;
//         color: ${C.textMid};
//         display: flex;
//         align-items: center;
//         gap: 7px;
//       }
//       .cw-badge-latest-em { font-size: 1.1rem; }
//       .cw-badge-latest strong { color: ${C.text}; }

//       /* ── Shimmer loader ── */
//       .cw-shimmer {
//         background: linear-gradient(90deg, #ece9e1 25%, #f5f3ef 50%, #ece9e1 75%);
//         background-size: 200% 100%;
//         animation: cwShimmer 1.4s infinite;
//         border-radius: 8px;
//       }
//       @keyframes cwShimmer {
//         0%   { background-position: 200% 0; }
//         100% { background-position: -200% 0; }
//       }
//       @keyframes cwFadeIn {
//         from { opacity: 0; transform: translateY(-4px); }
//         to   { opacity: 1; transform: translateY(0); }
//       }
//     `;
//     document.head.appendChild(style);
//   }

//   /* ═══════════════════════════════════════════════════════════
//      WIDGET 1 — ANNOUNCEMENTS
//   ═══════════════════════════════════════════════════════════ */
//   async function renderAnnouncements() {
//     const root = document.getElementById("widget-announcements");
//     if (!root) return;

//     // Get IDs the user already dismissed
//     const dismissed = JSON.parse(
//       localStorage.getItem("cw-dismissed-ann") || "[]",
//     );

//     const TYPE_ICON = {
//       announcement: "📢",
//       challenge: "🏆",
//       spotlight: "✨",
//       notification: "🔔",
//       feature_update: "🚀",
//       safety_notice: "⚠️",
//     };

//     // Shimmer placeholder
//     root.innerHTML = `
//       <div class="cw-widget">
//         <div class="cw-widget-head">
//           <span class="cw-widget-icon">📢</span>
//           <span class="cw-widget-title">Community Updates</span>
//         </div>
//         <div class="cw-widget-body">
//           <div class="cw-shimmer" style="height:52px;margin-bottom:8px;"></div>
//           <div class="cw-shimmer" style="height:52px;"></div>
//         </div>
//       </div>`;

//     try {
//       const data = await apiFetch("/announcements?limit=3");
//       const ann = (data.announcements || []).filter(
//         (a) => !dismissed.includes(String(a._id)),
//       );

//       if (!ann.length) {
//         root.innerHTML = ""; // nothing to show — hide the widget entirely
//         return;
//       }

//       root.innerHTML = `
//         <div class="cw-widget">
//           <div class="cw-widget-head">
//             <span class="cw-widget-icon">📢</span>
//             <span class="cw-widget-title">Community Updates</span>
//             <span class="cw-widget-badge">${ann.length} new</span>
//           </div>
//           <div class="cw-widget-body" id="cw-ann-list">
//             ${ann
//               .map(
//                 (a) => `
//               <div class="cw-ann-banner cw-ann-${esc(a.type || "announcement")}" id="cw-ann-${a._id}">
//                 <span class="cw-ann-ico">${TYPE_ICON[a.type] || "📢"}</span>
//                 <div class="cw-ann-content">
//                   <div class="cw-ann-title">${esc(a.title)}</div>
//                   <div class="cw-ann-body">${esc(a.message)}</div>
//                   <div class="cw-ann-time">${timeAgo(a.sentAt || a.createdAt)}</div>
//                 </div>
//                 <button class="cw-ann-close" onclick="cwDismissAnn('${a._id}')" title="Dismiss">✕</button>
//               </div>
//             `,
//               )
//               .join("")}
//           </div>
//         </div>`;
//     } catch (err) {
//       root.innerHTML = ""; // silently hide on error — announcements are non-critical
//       console.warn("[community-widgets/announcements]", err.message);
//     }
//   }

//   // Dismiss a single announcement (saved to localStorage)
//   window.cwDismissAnn = function (id) {
//     const dismissed = JSON.parse(
//       localStorage.getItem("cw-dismissed-ann") || "[]",
//     );
//     if (!dismissed.includes(id)) {
//       dismissed.push(id);
//       localStorage.setItem("cw-dismissed-ann", JSON.stringify(dismissed));
//     }
//     const el = document.getElementById("cw-ann-" + id);
//     if (el) {
//       el.style.transition = "opacity .25s, transform .25s";
//       el.style.opacity = "0";
//       el.style.transform = "translateX(10px)";
//       setTimeout(() => {
//         el.remove();
//         // If list is now empty, remove the whole widget
//         const list = document.getElementById("cw-ann-list");
//         if (list && !list.querySelector(".cw-ann-banner")) {
//           const root = document.getElementById("widget-announcements");
//           if (root) root.innerHTML = "";
//         }
//       }, 280);
//     }
//   };

//   /* ═══════════════════════════════════════════════════════════
//      WIDGET 2 — CHALLENGES
//   ═══════════════════════════════════════════════════════════ */
//   async function renderChallenges() {
//     const root = document.getElementById("widget-challenges");
//     if (!root) return;

//     // Shimmer
//     root.innerHTML = `
//       <div class="cw-widget">
//         <div class="cw-widget-head">
//           <span class="cw-widget-icon">🏆</span>
//           <span class="cw-widget-title">Active Challenges</span>
//         </div>
//         <div class="cw-widget-body">
//           <div class="cw-shimmer" style="height:50px;margin-bottom:10px;"></div>
//           <div class="cw-shimmer" style="height:50px;margin-bottom:10px;"></div>
//           <div class="cw-shimmer" style="height:50px;"></div>
//         </div>
//       </div>`;

//     try {
//       const userId = getUserId();
//       const qs = userId ? `?userId=${userId}` : "";
//       const data = await apiFetch(`/challenges${qs}`);
//       const chals = data.challenges || [];

//       if (!chals.length) {
//         root.innerHTML = `
//           <div class="cw-widget">
//             <div class="cw-widget-head">
//               <span class="cw-widget-icon">🏆</span>
//               <span class="cw-widget-title">Active Challenges</span>
//             </div>
//             <div class="cw-widget-body">
//               <div class="cw-empty">No active challenges right now — check back soon!</div>
//             </div>
//           </div>`;
//         return;
//       }

//       root.innerHTML = `
//         <div class="cw-widget">
//           <div class="cw-widget-head">
//             <span class="cw-widget-icon">🏆</span>
//             <span class="cw-widget-title">Active Challenges</span>
//             <span class="cw-widget-badge">${chals.length} live</span>
//           </div>
//           <div class="cw-widget-body">
//             ${chals
//               .slice(0, 4)
//               .map((c) => {
//                 const dl = daysLeft(c.endsAt);
//                 const dlStr =
//                   dl === null ? "" : dl === 0 ? "Ends today!" : `${dl}d left`;
//                 const joined = c.joined;
//                 return `
//                 <div class="cw-ch-item">
//                   <div class="cw-ch-ico" style="background:${esc(c.bg || "rgba(122,143,82,.12);")}">
//                     ${esc(c.icon || "🎯")}
//                   </div>
//                   <div class="cw-ch-info">
//                     <div class="cw-ch-title" title="${esc(c.title)}">${esc(c.title)}</div>
//                     <div class="cw-ch-meta">
//                       <span>👥 ${c.participantCount}</span>
//                       ${dlStr ? `<span class="cw-ch-dot"></span><span class="${dl === 0 ? "cw-ch-deadline" : ""}">${dlStr}</span>` : ""}
//                       ${c.meta ? `<span class="cw-ch-dot"></span><span>${esc(c.meta.slice(0, 30))}${c.meta.length > 30 ? "…" : ""}</span>` : ""}
//                     </div>
//                   </div>
//                   <button
//                     class="cw-join-btn ${joined ? "joined" : ""}"
//                     id="cw-join-${c._id}"
//                     onclick="cwJoinChallenge('${c._id}', this)"
//                   >${joined ? "✓ Joined" : "Join"}</button>
//                 </div>`;
//               })
//               .join("")}
//           </div>
//         </div>`;
//     } catch (err) {
//       root.innerHTML = `
//         <div class="cw-widget">
//           <div class="cw-widget-head">
//             <span class="cw-widget-icon">🏆</span>
//             <span class="cw-widget-title">Active Challenges</span>
//           </div>
//           <div class="cw-widget-body">
//             <div class="cw-empty">Couldn't load challenges</div>
//           </div>
//         </div>`;
//       console.warn("[community-widgets/challenges]", err.message);
//     }
//   }

//   // Join / leave handler
//   window.cwJoinChallenge = async function (cid, btn) {
//     const token = getToken();
//     if (!token) {
//       // Not logged in — redirect to login
//       sessionStorage.setItem("returnUrl", window.location.href);
//       window.location.href = LOGIN_URL;
//       return;
//     }

//     btn.disabled = true;
//     btn.textContent = "…";

//     try {
//       const data = await apiFetch(`/challenges/${cid}/join`, {
//         method: "POST",
//       });
//       btn.disabled = false;
//       btn.textContent = data.joined ? "✓ Joined" : "Join";
//       btn.classList.toggle("joined", data.joined);

//       // Briefly show the success message in the meta line
//       const meta = btn.closest(".cw-ch-item")?.querySelector(".cw-ch-meta");
//       if (meta) {
//         const msg = document.createElement("span");
//         msg.textContent = data.joined ? "🎉 You're in!" : "Left challenge";
//         msg.style.cssText = `color:${data.joined ? "#7a8f52" : "#9a9690"};font-weight:600;`;
//         meta.appendChild(msg);
//         setTimeout(() => msg.remove(), 2500);
//       }

//       // Update participant count
//       const meta2 = btn
//         .closest(".cw-ch-item")
//         ?.querySelector(".cw-ch-meta span");
//       if (meta2) {
//         const newCount = data.participantCount;
//         if (meta2.textContent.startsWith("👥")) {
//           meta2.textContent = "👥 " + newCount;
//         }
//       }
//     } catch (err) {
//       btn.disabled = false;
//       btn.textContent = "Join";
//       console.warn("[cwJoinChallenge]", err.message);
//     }
//   };

//   /* ═══════════════════════════════════════════════════════════
//      WIDGET 3 — BADGE SHOWCASE
//   ═══════════════════════════════════════════════════════════ */
//   async function renderBadges() {
//     const root = document.getElementById("widget-badges");
//     if (!root) return;

//     // Shimmer
//     root.innerHTML = `
//       <div class="cw-widget">
//         <div class="cw-widget-head">
//           <span class="cw-widget-icon">🏅</span>
//           <span class="cw-widget-title">Community Badges</span>
//         </div>
//         <div class="cw-widget-body">
//           <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
//             ${Array(6).fill(`<div class="cw-shimmer" style="height:72px;border-radius:10px;"></div>`).join("")}
//           </div>
//         </div>
//       </div>`;

//     try {
//       const data = await apiFetch("/badges?limit=6");
//       const badges = data.badges || [];
//       const latest = data.latestAward;

//       if (!badges.length) {
//         root.innerHTML = `
//           <div class="cw-widget">
//             <div class="cw-widget-head">
//               <span class="cw-widget-icon">🏅</span>
//               <span class="cw-widget-title">Community Badges</span>
//             </div>
//             <div class="cw-widget-body">
//               <div class="cw-empty">No badges yet — the first ones are coming soon!</div>
//             </div>
//           </div>`;
//         return;
//       }

//       root.innerHTML = `
//         <div class="cw-widget">
//           <div class="cw-widget-head">
//             <span class="cw-widget-icon">🏅</span>
//             <span class="cw-widget-title">Community Badges</span>
//             <span class="cw-widget-badge">${badges.length} active</span>
//           </div>
//           <div class="cw-widget-body">
//             <div class="cw-badge-grid">
//               ${badges
//                 .map(
//                   (b) => `
//                 <div class="cw-badge-tile" title="${esc(b.criteria || b.name)}">
//                   <div class="cw-badge-em">${esc(b.emoji || "🏅")}</div>
//                   <div class="cw-badge-name">${esc(b.name)}</div>
//                   <div class="cw-badge-cnt">${b.holderCount} earned</div>
//                 </div>
//               `,
//                 )
//                 .join("")}
//             </div>
//             ${
//               latest
//                 ? `
//               <div class="cw-badge-latest">
//                 <span class="cw-badge-latest-em">${esc(latest.emoji || "🏅")}</span>
//                 <div>
//                   <strong>@${esc(latest.userHandle)}</strong> just earned
//                   <strong>${esc(latest.badge)}</strong>
//                   <span style="color:#9a9690;font-size:0.68rem;display:block;">${timeAgo(latest.awardedAt)}</span>
//                 </div>
//               </div>
//             `
//                 : ""
//             }
//           </div>
//         </div>`;
//     } catch (err) {
//       root.innerHTML = "";
//       console.warn("[community-widgets/badges]", err.message);
//     }
//   }

//   /* ═══════════════════════════════════════════════════════════
//      INIT
//   ═══════════════════════════════════════════════════════════ */
//   function init() {
//     injectStyles();
//     // All three are independent — each silently skips if its container is missing
//     renderAnnouncements();
//     renderChallenges();
//     renderBadges();
//   }

//   if (document.readyState === "loading") {
//     document.addEventListener("DOMContentLoaded", init);
//   } else {
//     init();
//   }
// })();
/* ═══════════════════════════════════════════════════════════════════════════
   CRAFT-SOS  —  community-widgets.js
   Drop this file in:  Frontend/js/community-widgets.js

   HOW TO USE IN ANY PAGE
   ──────────────────────
   1. Add the widget containers anywhere in your HTML (right-rail aside, etc.):

      <!-- Announcement banner — floats at page top, auto-dismisses -->
      <div id="widget-announcements"></div>

      <!-- Active challenges widget -->
      <div id="widget-challenges"></div>

      <!-- Badge showcase widget -->
      <div id="widget-badges"></div>

   2. Include this script at the bottom of <body>:
      <script src="../js/community-widgets.js"></script>

   3. Done. Each widget auto-loads from /api/community/*.
      They're fully independent — missing containers are silently skipped.

   USER TOKEN (for Join buttons):
   ──────────────────────────────
   The join button calls POST /api/community/challenges/:id/join with the
   user's JWT from localStorage. If no token is found, clicking Join redirects
   to the login page instead.

   DESIGN:
   ───────
   All styles are injected inline — no external CSS file needed.
   Matches Craft-SOS palette: earthy greens, Lora headings, DM Sans body.
═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ─── Config ───────────────────────────────────────────── */
  const API_BASE = "/api/community";
  const TOKEN_KEY = "token"; // key used by your main app to store user JWT
  const LOGIN_URL = "/pages/login.html"; // redirect if not logged in

  /* ─── Palette / design tokens ──────────────────────────── */
  const C = {
    accent: "#7a8f52",
    accentPale: "rgba(122,143,82,.10)",
    accentMid: "rgba(122,143,82,.18)",
    surface: "#f8f6f1",
    card: "#ffffff",
    border: "#ddd9d0",
    text: "#2c2822",
    textMid: "#6b6560",
    textDim: "#9a9690",
    high: "#c0432a",
    highPale: "rgba(192,67,42,.09)",
    blue: "#3a6ea8",
    bluePale: "rgba(58,110,168,.09)",
    purple: "#7258b0",
    purplePale: "rgba(114,88,176,.09)",
    med: "#b07820",
    medPale: "rgba(176,120,32,.10)",
    radius: "14px",
    radiusSm: "10px",
    shadow: "0 2px 16px rgba(0,0,0,.07)",
  };

  /* ─── Utilities ─────────────────────────────────────────── */
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  const timeAgo = (d) => {
    if (!d) return "";
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago";
    if (s < 86400 * 7) return Math.floor(s / 86400) + "d ago";
    return new Date(d).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    });
  };

  const daysLeft = (d) => {
    if (!d) return null;
    const days = Math.ceil((new Date(d) - Date.now()) / 86400000);
    return days > 0 ? days : 0;
  };

  const getToken = () => localStorage.getItem(TOKEN_KEY) || "";
  const getUserId = () => {
    try {
      const t = getToken();
      if (!t) return null;
      return JSON.parse(atob(t.split(".")[1]))?.userId || null;
    } catch {
      return null;
    }
  };

  const apiFetch = async (path, opts = {}) => {
    const token = getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(API_BASE + path, { ...opts, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  };

  /* ─── Inject global styles once ────────────────────────── */
  function injectStyles() {
    if (document.getElementById("cw-styles")) return;
    const style = document.createElement("style");
    style.id = "cw-styles";
    style.textContent = `
      /* ── Widget shell ── */
      .cw-widget {
        background: ${C.card};
        border: 1px solid ${C.border};
        border-radius: ${C.radius};
        box-shadow: ${C.shadow};
        overflow: hidden;
        margin-bottom: 18px;
        font-family: 'DM Sans', system-ui, sans-serif;
      }
      .cw-widget-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 14px 16px 12px;
        border-bottom: 1px solid ${C.border};
      }
      .cw-widget-icon {
        font-size: 1rem;
        line-height: 1;
      }
      .cw-widget-title {
        font-family: 'Lora', Georgia, serif;
        font-weight: 700;
        font-size: 0.88rem;
        color: ${C.text};
        flex: 1;
      }
      .cw-widget-badge {
        background: ${C.accentMid};
        color: ${C.accent};
        font-size: 0.68rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 20px;
      }
      .cw-widget-body { padding: 12px 14px; }
      .cw-empty {
        color: ${C.textDim};
        font-size: 0.8rem;
        text-align: center;
        padding: 14px 0;
      }

      /* ── Challenges ── */
      .cw-ch-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 0;
        border-bottom: 1px solid ${C.border};
      }
      .cw-ch-item:last-child { border-bottom: none; padding-bottom: 0; }
      .cw-ch-ico {
        width: 36px; height: 36px;
        border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.1rem;
        flex-shrink: 0;
      }
      .cw-ch-info { flex: 1; min-width: 0; }
      .cw-ch-title {
        font-weight: 600;
        font-size: 0.83rem;
        color: ${C.text};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 2px;
      }
      .cw-ch-meta {
        font-size: 0.72rem;
        color: ${C.textDim};
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .cw-ch-dot { width: 3px; height: 3px; border-radius: 50%; background: ${C.border}; }
      .cw-ch-deadline { color: ${C.high}; font-weight: 600; }
      .cw-join-btn {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 5px 10px;
        border-radius: 8px;
        border: 1.5px solid ${C.accent};
        background: transparent;
        color: ${C.accent};
        cursor: pointer;
        white-space: nowrap;
        transition: all .18s;
        flex-shrink: 0;
        font-family: inherit;
      }
      .cw-join-btn:hover { background: ${C.accentPale}; }
      .cw-join-btn.joined {
        background: ${C.accent};
        color: #fff;
        border-color: ${C.accent};
      }
      .cw-join-btn:disabled { opacity: .5; cursor: default; }

      /* ── Announcements banner ── */
      .cw-ann-banner {
        border-radius: ${C.radius};
        border: 1px solid;
        padding: 11px 14px;
        margin-bottom: 10px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        position: relative;
        font-family: 'DM Sans', system-ui, sans-serif;
        animation: cwFadeIn .3s ease both;
      }
      .cw-ann-banner:last-child { margin-bottom: 0; }
      .cw-ann-ico { font-size: 1.1rem; flex-shrink: 0; line-height: 1.4; }
      .cw-ann-content { flex: 1; min-width: 0; }
      .cw-ann-title {
        font-weight: 700;
        font-size: 0.82rem;
        margin-bottom: 2px;
      }
      .cw-ann-body {
        font-size: 0.76rem;
        line-height: 1.45;
        color: ${C.textMid};
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      .cw-ann-time { font-size: 0.68rem; color: ${C.textDim}; margin-top: 3px; }
      .cw-ann-close {
        position: absolute;
        top: 8px; right: 10px;
        background: none; border: none;
        font-size: 1rem; cursor: pointer;
        color: ${C.textDim};
        line-height: 1;
        padding: 0;
        font-family: inherit;
      }
      .cw-ann-close:hover { color: ${C.text}; }

      /* type colours */
      .cw-ann-announcement {
        background: ${C.bluePale};
        border-color: rgba(58,110,168,.25);
      }
      .cw-ann-announcement .cw-ann-title { color: ${C.blue}; }
      .cw-ann-challenge {
        background: ${C.accentPale};
        border-color: rgba(122,143,82,.25);
      }
      .cw-ann-challenge .cw-ann-title { color: ${C.accent}; }
      .cw-ann-safety_notice {
        background: ${C.highPale};
        border-color: rgba(192,67,42,.25);
      }
      .cw-ann-safety_notice .cw-ann-title { color: ${C.high}; }
      .cw-ann-spotlight, .cw-ann-feature_update {
        background: ${C.purplePale};
        border-color: rgba(114,88,176,.25);
      }
      .cw-ann-spotlight .cw-ann-title,
      .cw-ann-feature_update .cw-ann-title { color: ${C.purple}; }
      .cw-ann-notification {
        background: ${C.medPale};
        border-color: rgba(176,120,32,.25);
      }
      .cw-ann-notification .cw-ann-title { color: ${C.med}; }

      /* ── Badges ── */
      .cw-badge-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }
      .cw-badge-tile {
        background: ${C.surface};
        border: 1px solid ${C.border};
        border-radius: ${C.radiusSm};
        padding: 10px 6px;
        text-align: center;
        transition: transform .18s, box-shadow .18s;
        cursor: default;
      }
      .cw-badge-tile:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.09); }
      .cw-badge-em { font-size: 1.5rem; line-height: 1; margin-bottom: 5px; }
      .cw-badge-name {
        font-size: 0.69rem;
        font-weight: 700;
        color: ${C.text};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cw-badge-cnt { font-size: 0.65rem; color: ${C.textDim}; margin-top: 2px; }
      .cw-badge-latest {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid ${C.border};
        font-size: 0.75rem;
        color: ${C.textMid};
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .cw-badge-latest-em { font-size: 1.1rem; }
      .cw-badge-latest strong { color: ${C.text}; }

      /* ── Shimmer loader ── */
      .cw-shimmer {
        background: linear-gradient(90deg, #ece9e1 25%, #f5f3ef 50%, #ece9e1 75%);
        background-size: 200% 100%;
        animation: cwShimmer 1.4s infinite;
        border-radius: 8px;
      }
      @keyframes cwShimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @keyframes cwFadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  /* ═══════════════════════════════════════════════════════════
     WIDGET 1 — ANNOUNCEMENTS
  ═══════════════════════════════════════════════════════════ */
  async function renderAnnouncements() {
    const root = document.getElementById("widget-announcements");
    if (!root) return;

    // Get IDs the user already dismissed
    const dismissed = JSON.parse(
      localStorage.getItem("cw-dismissed-ann") || "[]",
    );

    const TYPE_ICON = {
      announcement: "📢",
      challenge: "🏆",
      spotlight: "✨",
      notification: "🔔",
      feature_update: "🚀",
      safety_notice: "⚠️",
    };

    // Shimmer placeholder
    root.innerHTML = `
      <div class="cw-widget">
        <div class="cw-widget-head">
          <span class="cw-widget-icon">📢</span>
          <span class="cw-widget-title">Community Updates</span>
        </div>
        <div class="cw-widget-body">
          <div class="cw-shimmer" style="height:52px;margin-bottom:8px;"></div>
          <div class="cw-shimmer" style="height:52px;"></div>
        </div>
      </div>`;

    try {
      const data = await apiFetch("/announcements?limit=3");
      const ann = (data.announcements || []).filter(
        (a) => !dismissed.includes(String(a._id)),
      );

      if (!ann.length) {
        root.innerHTML = ""; // nothing to show — hide the widget entirely
        return;
      }

      root.innerHTML = `
        <div class="cw-widget">
          <div class="cw-widget-head">
            <span class="cw-widget-icon">📢</span>
            <span class="cw-widget-title">Community Updates</span>
            <span class="cw-widget-badge">${ann.length} new</span>
          </div>
          <div class="cw-widget-body" id="cw-ann-list">
            ${ann
              .map(
                (a) => `
              <div class="cw-ann-banner cw-ann-${esc(a.type || "announcement")}" id="cw-ann-${a._id}">
                <span class="cw-ann-ico">${TYPE_ICON[a.type] || "📢"}</span>
                <div class="cw-ann-content">
                  <div class="cw-ann-title">${esc(a.title)}</div>
                  <div class="cw-ann-body">${esc(a.message)}</div>
                  <div class="cw-ann-time">${timeAgo(a.sentAt || a.createdAt)}</div>
                </div>
                <button class="cw-ann-close" onclick="cwDismissAnn('${a._id}')" title="Dismiss">✕</button>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>`;
    } catch (err) {
      root.innerHTML = ""; // silently hide on error — announcements are non-critical
      console.warn("[community-widgets/announcements]", err.message);
    }
  }

  // Dismiss a single announcement (saved to localStorage)
  window.cwDismissAnn = function (id) {
    const dismissed = JSON.parse(
      localStorage.getItem("cw-dismissed-ann") || "[]",
    );
    if (!dismissed.includes(id)) {
      dismissed.push(id);
      localStorage.setItem("cw-dismissed-ann", JSON.stringify(dismissed));
    }
    const el = document.getElementById("cw-ann-" + id);
    if (el) {
      el.style.transition = "opacity .25s, transform .25s";
      el.style.opacity = "0";
      el.style.transform = "translateX(10px)";
      setTimeout(() => {
        el.remove();
        // If list is now empty, remove the whole widget
        const list = document.getElementById("cw-ann-list");
        if (list && !list.querySelector(".cw-ann-banner")) {
          const root = document.getElementById("widget-announcements");
          if (root) root.innerHTML = "";
        }
      }, 280);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     WIDGET 2 — CHALLENGES
  ═══════════════════════════════════════════════════════════ */
  async function renderChallenges() {
    const root = document.getElementById("widget-challenges");
    if (!root) return;

    // Shimmer
    root.innerHTML = `
      <div class="cw-widget">
        <div class="cw-widget-head">
          <span class="cw-widget-icon">🏆</span>
          <span class="cw-widget-title">Active Challenges</span>
        </div>
        <div class="cw-widget-body">
          <div class="cw-shimmer" style="height:50px;margin-bottom:10px;"></div>
          <div class="cw-shimmer" style="height:50px;margin-bottom:10px;"></div>
          <div class="cw-shimmer" style="height:50px;"></div>
        </div>
      </div>`;

    try {
      const userId = getUserId();
      const qs = userId ? `?userId=${userId}` : "";
      const data = await apiFetch(`/challenges${qs}`);
      const chals = data.challenges || [];

      if (!chals.length) {
        root.innerHTML = `
          <div class="cw-widget">
            <div class="cw-widget-head">
              <span class="cw-widget-icon">🏆</span>
              <span class="cw-widget-title">Active Challenges</span>
            </div>
            <div class="cw-widget-body">
              <div class="cw-empty">No challenges</div>
            </div>
          </div>`;
        return;
      }

      root.innerHTML = `
        <div class="cw-widget">
          <div class="cw-widget-head">
            <span class="cw-widget-icon">🏆</span>
            <span class="cw-widget-title">Active Challenges</span>
            <span class="cw-widget-badge">${chals.length} live</span>
          </div>
          <div class="cw-widget-body">
            ${chals
              .slice(0, 4)
              .map((c) => {
                const dl = daysLeft(c.endsAt);
                const dlStr =
                  dl === null ? "" : dl === 0 ? "Ends today!" : `${dl}d left`;
                const joined = c.joined;
                return `
                <div class="cw-ch-item">
                  <div class="cw-ch-ico" style="background:${esc(c.bg || "rgba(122,143,82,.12);")}">
                    ${esc(c.icon || "🎯")}
                  </div>
                  <div class="cw-ch-info">
                    <div class="cw-ch-title" title="${esc(c.title)}">${esc(c.title)}</div>
                    <div class="cw-ch-meta">
                      <span>👥 ${c.participantCount}</span>
                      ${dlStr ? `<span class="cw-ch-dot"></span><span class="${dl === 0 ? "cw-ch-deadline" : ""}">${dlStr}</span>` : ""}
                      ${c.meta ? `<span class="cw-ch-dot"></span><span>${esc(c.meta.slice(0, 30))}${c.meta.length > 30 ? "…" : ""}</span>` : ""}
                    </div>
                  </div>
                  <button
                    class="cw-join-btn ${joined ? "joined" : ""}"
                    id="cw-join-${c._id}"
                    onclick="cwJoinChallenge('${c._id}', this)"
                  >${joined ? "✓ Joined" : "Join"}</button>
                </div>`;
              })
              .join("")}
          </div>
        </div>`;
    } catch (err) {
      root.innerHTML = `
        <div class="cw-widget">
          <div class="cw-widget-head">
            <span class="cw-widget-icon">🏆</span>
            <span class="cw-widget-title">Active Challenges</span>
          </div>
          <div class="cw-widget-body">
            <div class="cw-empty">Couldn't load challenges</div>
          </div>
        </div>`;
      console.warn("[community-widgets/challenges]", err.message);
    }
  }

  // Join / leave handler
  window.cwJoinChallenge = async function (cid, btn) {
    const token = getToken();
    if (!token) {
      // Not logged in — redirect to login
      sessionStorage.setItem("returnUrl", window.location.href);
      window.location.href = LOGIN_URL;
      return;
    }

    btn.disabled = true;
    btn.textContent = "…";

    try {
      const data = await apiFetch(`/challenges/${cid}/join`, {
        method: "POST",
      });
      btn.disabled = false;
      btn.textContent = data.joined ? "✓ Joined" : "Join";
      btn.classList.toggle("joined", data.joined);

      // Briefly show the success message in the meta line
      const meta = btn.closest(".cw-ch-item")?.querySelector(".cw-ch-meta");
      if (meta) {
        const msg = document.createElement("span");
        msg.textContent = data.joined ? "🎉 You're in!" : "Left challenge";
        msg.style.cssText = `color:${data.joined ? "#7a8f52" : "#9a9690"};font-weight:600;`;
        meta.appendChild(msg);
        setTimeout(() => msg.remove(), 2500);
      }

      // Update participant count
      const meta2 = btn
        .closest(".cw-ch-item")
        ?.querySelector(".cw-ch-meta span");
      if (meta2) {
        const newCount = data.participantCount;
        if (meta2.textContent.startsWith("👥")) {
          meta2.textContent = "👥 " + newCount;
        }
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Join";
      console.warn("[cwJoinChallenge]", err.message);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     WIDGET 3 — BADGE SHOWCASE
  ═══════════════════════════════════════════════════════════ */
  async function renderBadges() {
    const root = document.getElementById("widget-badges");
    if (!root) return;

    // Shimmer
    root.innerHTML = `
      <div class="cw-widget">
        <div class="cw-widget-head">
          <span class="cw-widget-icon">🏅</span>
          <span class="cw-widget-title">Community Badges</span>
        </div>
        <div class="cw-widget-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
            ${Array(6).fill(`<div class="cw-shimmer" style="height:72px;border-radius:10px;"></div>`).join("")}
          </div>
        </div>
      </div>`;

    try {
      const data = await apiFetch("/badges?limit=6");
      const badges = data.badges || [];
      const latest = data.latestAward;

      if (!badges.length) {
        root.innerHTML = `
          <div class="cw-widget">
            <div class="cw-widget-head">
              <span class="cw-widget-icon">🏅</span>
              <span class="cw-widget-title">Community Badges</span>
            </div>
            <div class="cw-widget-body">
              <div class="cw-empty">No badges</div>
            </div>
          </div>`;
        return;
      }

      root.innerHTML = `
        <div class="cw-widget">
          <div class="cw-widget-head">
            <span class="cw-widget-icon">🏅</span>
            <span class="cw-widget-title">Community Badges</span>
            <span class="cw-widget-badge">${badges.length} active</span>
          </div>
          <div class="cw-widget-body">
            <div class="cw-badge-grid">
              ${badges
                .map(
                  (b) => `
                <div class="cw-badge-tile" title="${esc(b.criteria || b.name)}">
                  <div class="cw-badge-em">${esc(b.emoji || "🏅")}</div>
                  <div class="cw-badge-name">${esc(b.name)}</div>
                  <div class="cw-badge-cnt">${b.holderCount} earned</div>
                </div>
              `,
                )
                .join("")}
            </div>
            ${
              latest
                ? `
              <div class="cw-badge-latest">
                <span class="cw-badge-latest-em">${esc(latest.emoji || "🏅")}</span>
                <div>
                  <strong>@${esc(latest.userHandle)}</strong> just earned
                  <strong>${esc(latest.badge)}</strong>
                  <span style="color:#9a9690;font-size:0.68rem;display:block;">${timeAgo(latest.awardedAt)}</span>
                </div>
              </div>
            `
                : ""
            }
          </div>
        </div>`;
    } catch (err) {
      root.innerHTML = "";
      console.warn("[community-widgets/badges]", err.message);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════════ */
  function init() {
    injectStyles();
    // All three are independent — each silently skips if its container is missing
    renderAnnouncements();
    renderChallenges();
    renderBadges();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
