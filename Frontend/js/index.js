// Frontend/js/index.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Powers every interactive section on index.html (the main home feed).
//
//   Sections driven by this file:
//     • Welcome banner  → GET /api/index/welcome
//     • Stats row       → same welcome response
//     • SOS Feed        → GET /api/index/feed (filter + pagination + live socket)
//     • Needs Your Help → GET /api/index/needs-help
//     • Activity feed   → GET /api/index/activity
//     • Top Helpers     → GET /api/index/top-helpers
//     • Suggestions     → GET /api/index/suggestions
//     • Friend Requests → GET /api/index/friend-requests
//
//   Mutations wired up:
//     • Save / unsave   → PATCH /api/posts/:id/save
//     • Like / helpful  → PATCH /api/posts/:id/reactions  (emoji 💚)
//     • Quick reply     → POST  /api/posts/:id/replies
//     • Follow          → POST  /api/dashboard/follow/:id
//     • Accept friend   → PATCH /api/index/friend-requests/:id/accept
//     • Decline friend  → PATCH /api/index/friend-requests/:id/decline
//
//   Socket events listened to (via window.craftSocket from socket-client.js):
//     • "feed:new"      → live-prepend new post card to #sos-feed
//
//   Folder structure (for reference):
//   ────────────────────────────────────────────
//   root/
//   ├── index.html
//   ├── css/
//   │   └── index.css
//   ├── js/
//   │   ├── socket-client.js   ← shared socket singleton
//   │   └── index.js           ← this file
//   ├── pages/
//   │   ├── post-detail.html
//   │   ├── profile.html
//   │   ├── chat.html
//   │   ├── explore.html
//   │   ├── dashboard.html
//   │   └── settings.html
//   └── Backend/
//       ├── controllers/
//       │   ├── indexController.js      ← welcome, feed, needs-help, activity …
//       │   ├── dashboardController.js  ← follow toggle
//       │   ├── postController.js       ← save, addReply
//       │   └── …
//       ├── routes/
//       │   ├── indexRoutes.js          ← /api/index/*
//       │   ├── dashboardRoutes.js      ← /api/dashboard/*
//       │   ├── postRoutes.js           ← /api/posts/*
//       │   └── …
//       └── server.js
// ─────────────────────────────────────────────────────────────────────────────

"use strict";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */
const API = "http://localhost:5000/api";
const token = localStorage.getItem("token");
const _me = JSON.parse(localStorage.getItem("user") || "{}");

// Redirect to login if no JWT
if (!token) window.location.href = "pages/login.html";

/* ═══════════════════════════════════════════════════════════
   FEED STATE — shared between loadFeed / loadMoreFeed
═══════════════════════════════════════════════════════════ */
let _feedPage = 1;
let _feedType = "all";
let _feedSev = "";
let _feedTag = "";
let _feedHasMore = false;

/* ═══════════════════════════════════════════════════════════
   FETCH HELPER
═══════════════════════════════════════════════════════════ */
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "pages/login.html";
    return;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

/* ═══════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════ */
function esc(s = "") {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

/* Strip HTML tags → plain text for card body previews.
   Posts are now stored as rich HTML. Feed cards must show
   a plain-text snippet, not raw <b>, <ul>, <li> tags. */
function stripHTML(html = "") {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent || d.innerText || "";
}
function escAttr(s = "") {
  return String(s).replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

const _COLORS = [
  "#b5c98a",
  "#a8c4d8",
  "#d4b8e0",
  "#f0c07a",
  "#c8a98a",
  "#9ec4a0",
  "#f7b8a2",
];
function colorFor(id = "") {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) & 0xffffff;
  return _COLORS[h % _COLORS.length];
}

function avatarHtml(cls, avatar, name, id, size = "") {
  if (avatar) {
    return `<div class="${cls}" ${size}
              style="background-image:url(${avatar});background-size:cover;background-position:center;cursor:pointer;"
              onclick="window.location.href='pages/crafter-profile.html?id=${escAttr(id)}'">
            </div>`;
  }
  const initials = (name || "?").slice(0, 2).toUpperCase();
  return `<div class="${cls}" ${size}
            style="background:${colorFor(id)};color:#fff;display:flex;align-items:center;
                   justify-content:center;font-weight:700;cursor:pointer;"
            onclick="window.location.href='pages/crafter-profile.html?id=${escAttr(id)}'">
            ${esc(initials)}
          </div>`;
}

function showToast(msg, type = "info") {
  if (window.craftToast) {
    window.craftToast(msg, type);
    return;
  }
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.style.opacity = "1";
  t.style.transform = "translateX(-50%) translateY(0)";
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(40px)";
  }, 3000);
}

/* ═══════════════════════════════════════════════════════════
   1. WELCOME BANNER + STATS ROW
   GET /api/index/welcome
═══════════════════════════════════════════════════════════ */
async function loadWelcome() {
  try {
    const { welcome } = await api("/index/welcome");
    const w = welcome;

    // ── Greeting ─────────────────────────────────────────
    const firstName = (w.name || "").split(" ")[0];
    const greetEl = document.getElementById("wb-greeting");
    const subEl = document.getElementById("wb-sub");

    if (greetEl) greetEl.textContent = `Welcome back, ${firstName} 👋`;
    if (subEl) {
      const helpText =
        w.helpedCount > 0
          ? `🔥 You helped ${w.helpedCount} crafter${w.helpedCount !== 1 ? "s" : ""} this week — keep it up!`
          : "Start exploring SOS posts and help someone today 🌿";
      subEl.textContent = helpText;
    }

    // ── Rank widget ───────────────────────────────────────
    const rankIcon = document.getElementById("wb-rank-icon");
    const rankLabel = document.getElementById("wb-rank-label");
    if (rankIcon) rankIcon.textContent = w.rank?.split(" ")[0] ?? "🏅";
    if (rankLabel)
      rankLabel.textContent = (w.rank || "Member").replace(/^\S+\s*/, "");

    // ── Quick-stat pills ──────────────────────────────────
    const pillsEl = document.getElementById("wb-pills");
    if (pillsEl) {
      const style =
        "display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.14);" +
        "border-radius:12px;padding:6px 12px;font-size:.8rem;color:rgba(255,255,255,.9);" +
        "cursor:pointer;";
      pillsEl.innerHTML = `
        <div style="${style}" onclick="window.location.href='pages/dashboard.html'">
          🔔 ${w.unreadNotifs || 0} Notification${w.unreadNotifs !== 1 ? "s" : ""}
        </div>
        <div style="${style}" onclick="window.location.href='pages/dashboard.html'">
          💬 ${w.repliedPostCount || 0} Replies to your SOS
        </div>
        <div style="${style}" onclick="window.location.href='pages/chat.html'">
          📨 Messages
        </div>
        <div style="${style}" onclick="filterFeedPill(document.querySelector('[data-type=sos]'),'sos')">
          🏷 ${w.activePostCount || 0} Active Post${w.activePostCount !== 1 ? "s" : ""}
        </div>`;
    }

    // ── Topbar avatar ─────────────────────────────────────
    const tbAv = document.getElementById("topbar-profile-av");
    if (tbAv) {
      if (w.avatar) {
        tbAv.style.backgroundImage = `url(${w.avatar})`;
        tbAv.style.backgroundSize = "cover";
        tbAv.style.backgroundPosition = "center";
      } else {
        tbAv.textContent = (w.name || "?").slice(0, 2).toUpperCase();
        Object.assign(tbAv.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "700",
          background: colorFor(String(w.id || "")),
          color: "#fff",
        });
      }
    }

    // ── Sidebar mini-profile ──────────────────────────────
    const sbAv = document.getElementById("sb-prof-av");
    const sbName = document.getElementById("sb-prof-name");
    const sbSub = document.getElementById("sb-prof-sub");
    if (sbAv) {
      if (w.avatar) {
        sbAv.style.backgroundImage = `url(${w.avatar})`;
        sbAv.style.backgroundSize = "cover";
        sbAv.style.backgroundPosition = "center";
      } else {
        sbAv.textContent = (w.name || "?").slice(0, 2).toUpperCase();
        Object.assign(sbAv.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "700",
          background: colorFor("me"),
          color: "#fff",
        });
      }
    }
    if (sbName) sbName.textContent = w.name || "Crafter";
    if (sbSub)
      sbSub.textContent = `${w.handle ? `@${w.handle}` : ""} · ${w.badges?.[0] ?? "Member"}`;

    // ── Topbar notif dot ──────────────────────────────────
    const dot = document.getElementById("topbar-notif-dot");
    if (dot) dot.style.display = (w.unreadNotifs || 0) > 0 ? "block" : "none";

    // ── Stats row ─────────────────────────────────────────
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set("st-sos", w.activePostCount || 0);
    set("st-solved", w.resolvedCount || 0);
    set("st-tut", w.tutorials || 0);
    set("st-pts", w.helpedCount || 0);

    // ── SOS badge in sidebar ──────────────────────────────
    if ((w.activePostCount || 0) > 0) {
      const sosBadge = document.getElementById("sos-badge");
      if (sosBadge) {
        sosBadge.textContent = w.activePostCount;
        sosBadge.style.display = "inline-flex";
      }
    }

    // ── Contributions grid ────────────────────────────────
    const cgEl = document.getElementById("contrib-grid");
    if (cgEl) {
      cgEl.innerHTML = `
        <div class="contrib-tile"><div class="contrib-num">${w.activePostCount || 0}</div><div class="contrib-lbl">SOS Posted</div></div>
        <div class="contrib-tile"><div class="contrib-num">${w.resolvedCount || 0}</div><div class="contrib-lbl">SOS Solved</div></div>
        <div class="contrib-tile"><div class="contrib-num">${w.tutorials || 0}</div><div class="contrib-lbl">Tutorials</div></div>
        <div class="contrib-tile"><div class="contrib-num">${w.helpedCount || 0}</div><div class="contrib-lbl">Helpful Votes</div></div>
        <div class="contrib-tile"><div class="contrib-num">${w.friendCount || 0}</div><div class="contrib-lbl">Friends</div></div>
        <div class="contrib-tile"><div class="contrib-num">🔥 ${w.streakDays || 0}</div><div class="contrib-lbl">Day Streak</div></div>`;
    }

    const rb = document.getElementById("rank-badge");
    if (rb && w.rank) {
      const badges = (w.badges || [])
        .slice(0, 2)
        .map((b) => `🎖 ${b}`)
        .join("  ·  ");
      rb.textContent = `${w.rank}${badges ? `  ·  ${badges}` : ""}`;
    }
  } catch (err) {
    console.error("[loadWelcome]", err);
    const greetEl = document.getElementById("wb-greeting");
    if (greetEl) greetEl.textContent = "Welcome back 👋";
  }
}

/* ═══════════════════════════════════════════════════════════
   2. MAIN SOS / COMMUNITY FEED
   GET /api/index/feed?type=&severity=&tag=&page=
═══════════════════════════════════════════════════════════ */
// Severity → display label + badge class + card class
const SEV_META = {
  High: { label: "🔴 High", badge: "b-high", card: "urgent" },
  Medium: { label: "🟡 Medium", badge: "b-med", card: "medium" },
  Low: { label: "🟢 Low", badge: "b-low", card: "" },
};
const TYPE_META = {
  sos: { label: "Distress Call", badge: "b-high" },
  tut: { label: "Tutorial", badge: "b-low" },
  com: { label: "Community", badge: "b-med" },
  res: { label: "Resource", badge: "b-cat" },
};

function buildPostCard(post) {
  const a = post.author;
  const sev = SEV_META[post.severity] ?? SEV_META.Low;
  const typeInfo = TYPE_META[post.type] ?? { label: post.type, badge: "b-cat" };
  const tags = (post.tags || [])
    .slice(0, 3)
    .map((t) => `<span class="badge b-cat">${esc(t)}</span>`)
    .join("");

  const avHtml = avatarHtml("card-av", a?.avatar, a?.name, a?.id);

  // Self-avatar (bottom composer) — uses current user
  const myAvHtml = _me?.avatar
    ? `<div class="foot-av" style="background-image:url(${_me.avatar});background-size:cover;background-position:center;"></div>`
    : `<div class="foot-av" style="background:${colorFor("me")};display:flex;align-items:center;justify-content:center;color:#fff;font-size:.7rem;font-weight:700;">${(_me?.name || "Y").slice(0, 2).toUpperCase()}</div>`;

  return `
  <article class="sos-card ${sev.card}" id="post-${post.id}" style="animation:fadeIn .3s ease;">
    <div class="card-header">
      ${avHtml}
      <div class="card-meta">
        <div class="card-username" style="cursor:pointer;"
             onclick="window.location.href='pages/crafter-profile.html?id=${escAttr(a?.id)}'">
          ${esc(a?.name || "Unknown")}
        </div>
        <div class="card-time">${esc(post.timeAgo)}</div>
        <div class="card-badges">
          <span class="badge ${sev.badge}">${esc(sev.label)}</span>
          <span class="badge ${typeInfo.badge}">${esc(typeInfo.label)}</span>
          ${tags}
        </div>
      </div>
    </div>

    <div class="sos-meta">
      <div class="sos-replies">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        <span id="rc-${post.id}">${post.replyCount}</span> response${post.replyCount !== 1 ? "s" : ""}
      </div>
      <div class="sos-views" style="font-size:.78rem;color:#999;margin-left:10px;">
        👁 ${(post.views || 0).toLocaleString()}
      </div>
    </div>

    <h2 class="card-heading">
      <a href="pages/post-detail.html?id=${escAttr(post.id)}" class="post-link">${esc(post.title)}</a>
    </h2>
    <p class="card-para">${esc(stripHTML(post.body || "").slice(0, 220))}</p>

    <div class="card-footer">
      ${myAvHtml}
      <input class="msg-input" type="text"
             placeholder="Share your advice…"
             onkeydown="if(event.key==='Enter'&&this.value.trim()){quickReply('${escAttr(post.id)}',this)}"
             id="qi-${escAttr(post.id)}" />
      <div class="card-acts">
        <button class="icon-btn ${post.isSaved ? "liked" : ""}"
                id="save-${escAttr(post.id)}"
                onclick="toggleSave('${escAttr(post.id)}',this)" title="Save">
          <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
        </button>
        <button class="icon-btn" title="Share"
                onclick="copyLink('${escAttr(post.id)}')">
          <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
      </div>
      <button class="help-btn" onclick="window.location.href='pages/post-detail.html?id=${escAttr(post.id)}'">Help →</button>
    </div>
  </article>`;
}

async function loadFeed(append = false) {
  const feedEl = document.getElementById("sos-feed");
  if (!feedEl) return;

  if (!append) {
    feedEl.innerHTML = `
      <div class="shimmer" style="height:188px;"></div>
      <div class="shimmer" style="height:188px;"></div>
      <div class="shimmer" style="height:188px;"></div>`;
    _feedPage = 1;
  }

  try {
    let url = `/index/feed?page=${_feedPage}&limit=10`;
    if (_feedType && _feedType !== "all") url += `&type=${_feedType}`;
    if (_feedSev) url += `&severity=${_feedSev}`;
    if (_feedTag) url += `&tag=${encodeURIComponent(_feedTag)}`;

    const { posts, hasMore } = await api(url);
    _feedHasMore = hasMore;

    const html = (posts || []).map(buildPostCard).join("");

    if (append) {
      feedEl.insertAdjacentHTML("beforeend", html);
    } else {
      feedEl.innerHTML =
        html ||
        `<div style="padding:32px;text-align:center;color:#999;font-size:.88rem;">
           No posts found. <a href="pages/create-post.html" style="color:var(--accent);">Create one →</a>
         </div>`;
    }

    const loadMoreBtn = document.getElementById("load-more-btn");
    if (loadMoreBtn) loadMoreBtn.style.display = hasMore ? "block" : "none";
  } catch (err) {
    console.error("[loadFeed]", err);
    if (!append) {
      feedEl.innerHTML = `<div style="padding:32px;text-align:center;color:#c0392b;">
        Failed to load feed. <button onclick="loadFeed()" style="cursor:pointer;color:var(--accent);background:none;border:none;font-size:.88rem;">Retry</button></div>`;
    }
  }
}

function loadMoreFeed() {
  if (!_feedHasMore) return;
  _feedPage += 1;
  loadFeed(true);
}

/* ═══════════════════════════════════════════════════════════
   3. NEEDS YOUR HELP
   GET /api/index/needs-help
═══════════════════════════════════════════════════════════ */
async function loadNeedsHelp() {
  const el = document.getElementById("needs-list");
  if (!el) return;

  try {
    const { posts } = await api("/index/needs-help");

    if (!posts?.length) {
      el.innerHTML = `<p style="font-size:.83rem;color:#9a6050;padding:8px 0;">
        No urgent posts right now — all caught up! 🌿</p>`;
      return;
    }

    el.innerHTML = posts
      .map(
        (p) => `
      <div class="need-item" style="cursor:pointer;"
           onclick="window.location.href='pages/post-detail.html?id=${escAttr(p.id)}'">
        ${avatarHtml("need-av", p.author?.avatar, p.author?.name, p.author?.id)}
        <div class="need-info">
          <div class="need-title">${esc(p.title)}</div>
          <div class="need-sub">
            ${
              p.tags
                ?.slice(0, 1)
                .map((t) => esc(t))
                .join(" · ") || "Craft"
            }
            · ${esc(p.author?.location || "Community")}
            · <span class="zero-tag">${p.replyCount || 0} ${p.replyCount === 1 ? "reply" : "replies"}</span>
          </div>
        </div>
      </div>`,
      )
      .join("");
  } catch (err) {
    console.error("[loadNeedsHelp]", err);
    el.innerHTML = `<p style="font-size:.83rem;color:#999;">Could not load posts.</p>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   4. COMMUNITY ACTIVITY
   GET /api/index/activity
═══════════════════════════════════════════════════════════ */
async function loadActivity() {
  const el = document.getElementById("activity-list");
  if (!el) return;

  try {
    const { activity } = await api("/index/activity");

    if (!activity?.length) {
      el.innerHTML = `<p style="padding:12px 0;color:#999;font-size:.85rem;">No recent activity yet.</p>`;
      return;
    }

    el.innerHTML = activity
      .map(
        (a) => `
      <div class="act-item">
        <div class="act-ico">${esc(a.icon)}</div>
        <div class="act-info">
          <div class="act-title">${esc(a.title)}</div>
          <div class="act-sub">${esc(a.sub)}</div>
          <div class="act-actions">
            ${(a.tags || [])
              .map(
                (t) =>
                  `<span class="act-tag ${esc(t.cls || "")}">${esc(t.label || t)}</span>`,
              )
              .join("")}
          </div>
        </div>
      </div>`,
      )
      .join("");
  } catch (err) {
    console.error("[loadActivity]", err);
    el.innerHTML = `<p style="padding:12px 0;color:#999;font-size:.85rem;">Could not load activity.</p>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   5. TOP HELPERS
   GET /api/index/top-helpers
═══════════════════════════════════════════════════════════ */
async function loadTopHelpers() {
  const el = document.getElementById("helpers-list");
  if (!el) return;

  try {
    const { helpers } = await api("/index/top-helpers");

    if (!helpers?.length) {
      el.innerHTML = `<p style="font-size:.83rem;color:#999;">No data yet.</p>`;
      return;
    }

    el.innerHTML = helpers
      .map(
        (h) => `
      <div class="helper-item">
        ${avatarHtml("helper-av", h.avatar, h.name, h.id)}
        <div class="helper-info">
          <div class="helper-name" style="cursor:pointer;"
               onclick="window.location.href='pages/crafter-profile.html?id=${escAttr(h.id)}'">
            ${esc(h.name)}
          </div>
          <div class="helper-count">${h.helpedCount} people helped</div>
        </div>
        <div class="helper-rank">${esc(h.medal)}</div>
      </div>`,
      )
      .join("");
  } catch (err) {
    console.error("[loadTopHelpers]", err);
    el.innerHTML = `<p style="font-size:.83rem;color:#999;">Could not load.</p>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   6. SUGGESTED CRAFTERS
   GET /api/index/suggestions
   Follow → POST /api/dashboard/follow/:id
═══════════════════════════════════════════════════════════ */
async function loadSuggestions() {
  const el = document.getElementById("sugg-list");
  if (!el) return;

  try {
    const { suggestions } = await api("/index/suggestions");

    if (!suggestions?.length) {
      el.innerHTML = `<p style="font-size:.83rem;color:#999;">No suggestions right now.</p>`;
      return;
    }

    el.innerHTML = suggestions
      .map(
        (s) => `
      <div class="sugg-item" id="sugg-${escAttr(s.id)}">
        ${avatarHtml("sugg-av", s.avatar, s.name, s.id)}
        <div class="sugg-info">
          <div class="sugg-name" style="cursor:pointer;"
               onclick="window.location.href='pages/crafter-profile.html?id=${escAttr(s.id)}'">
            ${esc(s.name)}
          </div>
          <div class="sugg-niche">${esc(s.niche)} ${s.location ? `· ${esc(s.location)}` : ""}</div>
        </div>
        <button class="sugg-add" data-id="${escAttr(s.id)}" onclick="followUser(this)" title="Follow">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>`,
      )
      .join("");
  } catch (err) {
    console.error("[loadSuggestions]", err);
    el.innerHTML = `<p style="font-size:.83rem;color:#999;">Could not load suggestions.</p>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   7. FRIEND REQUESTS
   GET    /api/index/friend-requests
   PATCH  /api/index/friend-requests/:id/accept
   PATCH  /api/index/friend-requests/:id/decline
═══════════════════════════════════════════════════════════ */
async function loadFriendRequests() {
  const el = document.getElementById("freq-list");
  const countEl = document.getElementById("freq-count");
  if (!el) return;

  try {
    const { requests } = await api("/index/friend-requests");

    if (countEl)
      countEl.textContent = requests?.length ? `(${requests.length})` : "";

    if (!requests?.length) {
      el.innerHTML = `<p style="font-size:.83rem;color:#999;padding:6px 0;">No pending requests.</p>`;
      return;
    }

    el.innerHTML = requests
      .map(
        (r) => `
      <div class="freq-item" id="freq-${escAttr(r.id)}">
        ${avatarHtml("freq-av", r.avatar, r.name, r.id)}
        <div class="freq-info">
          <div class="freq-name" style="cursor:pointer;"
               onclick="window.location.href='pages/crafter-profile.html?id=${escAttr(r.id)}'">
            ${esc(r.name)}
          </div>
          <div class="freq-sub">${esc(r.niche || "Crafter")} · ${esc(r.location || "Community")}</div>
        </div>
        <div class="freq-btns">
          <button class="freq-ok" data-id="${escAttr(r.id)}" onclick="acceptFreq(this)" title="Accept">✓</button>
          <button class="freq-no" data-id="${escAttr(r.id)}" onclick="declineFreq(this)" title="Decline">✕</button>
        </div>
      </div>`,
      )
      .join("");
  } catch (err) {
    console.error("[loadFriendRequests]", err);
    el.innerHTML = `<p style="font-size:.83rem;color:#999;">Could not load requests.</p>`;
  }
}

/* ── Accept a friend request ────────────────────────────── */
async function acceptFreq(btn) {
  const userId = btn.dataset.id;
  if (!userId) return;

  // Optimistic remove
  const item = document.getElementById(`freq-${userId}`);
  if (item) {
    item.style.opacity = "0";
    item.style.transition = "opacity .3s";
  }

  try {
    await api(`/index/friend-requests/${userId}/accept`, { method: "PATCH" });
    setTimeout(() => item?.remove(), 300);
    showToast("Friend request accepted! 🎉", "success");
  } catch (err) {
    if (item) item.style.opacity = "1";
    showToast(err.message || "Could not accept request", "error");
  }
}

/* ── Decline a friend request ───────────────────────────── */
async function declineFreq(btn) {
  const userId = btn.dataset.id;
  if (!userId) return;

  const item = document.getElementById(`freq-${userId}`);
  if (item) {
    item.style.opacity = "0";
    item.style.transition = "opacity .3s";
  }

  try {
    await api(`/index/friend-requests/${userId}/decline`, { method: "PATCH" });
    setTimeout(() => item?.remove(), 300);
  } catch (err) {
    if (item) item.style.opacity = "1";
    showToast(err.message || "Could not decline request", "error");
  }
}

/* ═══════════════════════════════════════════════════════════
   MUTATIONS
═══════════════════════════════════════════════════════════ */

/* ── Save / unsave a post ───────────────────────────────── */
async function toggleSave(postId, btn) {
  const wasSaved = btn.classList.contains("liked");
  btn.classList.toggle("liked", !wasSaved);
  btn.disabled = true;

  try {
    const { isSaved } = await api(`/posts/${postId}/save`, { method: "PATCH" });
    btn.classList.toggle("liked", isSaved);
    showToast(isSaved ? "Post saved 🔖" : "Removed from saved", "info");
  } catch (err) {
    btn.classList.toggle("liked", wasSaved); // rollback
    showToast(err.message || "Could not save post", "error");
  } finally {
    btn.disabled = false;
  }
}

/* ── Quick reply from feed card ─────────────────────────── */
async function quickReply(postId, input) {
  const text = input.value.trim();
  if (!text) return;

  input.disabled = true;
  input.value = "";

  try {
    const { replyCount } = await api(`/posts/${postId}/replies`, {
      method: "POST",
      body: JSON.stringify({ body: text }),
    });
    // Bump reply count display
    const rcEl = document.getElementById(`rc-${postId}`);
    if (rcEl)
      rcEl.textContent = replyCount ?? (parseInt(rcEl.textContent) || 0) + 1;
    showToast("Reply sent! 💬", "success");
  } catch (err) {
    input.value = text; // restore
    showToast(err.message || "Reply failed", "error");
  } finally {
    input.disabled = false;
    input.focus();
  }
}

/* ── Follow a suggested crafter ─────────────────────────── */
async function followUser(btn) {
  const userId = btn.dataset.id;
  if (!userId) return;
  btn.disabled = true;

  try {
    await api(`/dashboard/follow/${userId}`, { method: "POST" });

    // Show check mark
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                         stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    btn.style.cssText =
      "background:var(--accent,#7a8f52);color:#fff;cursor:default;border-color:var(--accent,#7a8f52);";
    showToast("Following! 🌱", "success");
  } catch (err) {
    btn.disabled = false;
    showToast(err.message || "Could not follow", "error");
  }
}

/* ── Copy post link to clipboard ────────────────────────── */
function copyLink(postId) {
  const url = `${window.location.origin}/pages/post-detail.html?id=${postId}`;
  navigator.clipboard
    ?.writeText(url)
    .then(() => showToast("Link copied! 🔗"))
    .catch(() => {});
}

/* ═══════════════════════════════════════════════════════════
   FILTER PILLS
═══════════════════════════════════════════════════════════ */
function filterFeedPill(el, type = null, severity = null, tag = null) {
  // Update pill UI
  document
    .querySelectorAll(".fpill")
    .forEach((p) => p.classList.remove("active"));
  if (el) el.classList.add("active");

  _feedType = type || "all";
  _feedSev = severity || "";
  _feedTag = tag || "";
  _feedPage = 1;
  loadFeed(false);
}

function filterFeedByTag(tag) {
  _feedTag = tag;
  _feedType = "all";
  _feedSev = "";
  _feedPage = 1;
  // Deselect all pills
  document
    .querySelectorAll(".fpill")
    .forEach((p) => p.classList.remove("active"));
  loadFeed(false);
}

let _searchTimer = null;
function handleSearch(val) {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    if (val.length > 1) {
      window.location.href = `pages/explore.html?search=${encodeURIComponent(val)}`;
    }
  }, 480);
}

/* ═══════════════════════════════════════════════════════════
   SOCKET — live feed updates
   Listens for "feed:new" events (server emits to "feed" room)
═══════════════════════════════════════════════════════════ */
function initIndexSocket() {
  const sock = window.craftSocket;
  if (!sock) return;

  // Optionally join a global feed room
  sock.emit("feed:join", {});

  // A new post was created by someone else → prepend to feed
  sock.on("feed:new", (post) => {
    const feedEl = document.getElementById("sos-feed");
    if (!feedEl) return;

    // Add "Live" badge to the post data and prepend
    post._live = true;
    const card = document.createElement("div");
    card.innerHTML = buildPostCard(post);
    const article = card.firstElementChild;
    if (article) {
      // Inject a live indicator
      const meta = article.querySelector(".sos-meta");
      if (meta)
        meta.insertAdjacentHTML(
          "beforeend",
          `<span class="live-badge">● Live</span>`,
        );
      feedEl.prepend(article);
    }
  });
}

function distressCall() {
  window.location.href = "pages/create-post.html";
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "pages/login.html";
}

/* ═══════════════════════════════════════════════════════════
   INIT — called when DOM is ready
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   NOTIFICATION PANEL  (Pinterest-style dropdown on bell click)
   • Opens as a panel anchored to the bell button
   • Loads real notifications from /api/dashboard/notifications
   • "Seen" (read) / "New" sections
   • Friend-request items show Accept/Decline inline
   • Closes on outside click or Escape
   • socket-client.js calls window._refreshNotifPanel() when new notif arrives
═══════════════════════════════════════════════════════════ */

// Track panel state so socket-client.js can call refresh
window._notifPanelOpen = false;
window._refreshNotifPanel = null; // set in initNotifPanel

function initNotifPanel() {
  // Target by the id we added in index.html
  const bellBtn = document.getElementById("notif-bell-btn");
  if (!bellBtn) return;

  // CRITICAL: removeAttribute("onclick") only removes the HTML attribute;
  // the browser already compiled it into an onclick property. Must null it.
  bellBtn.onclick = null;

  bellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleNotifPanel(bellBtn);
  });
}

function toggleNotifPanel(anchor) {
  const existing = document.getElementById("notif-panel");
  if (existing) {
    existing.remove();
    window._notifPanelOpen = false;
    window._refreshNotifPanel = null;
    return;
  }
  openNotifPanel(anchor);
}

// openNotifPanel: always opens (called directly from sidebar nav onclick)
// Guard so double-calls from sidebar + bell don't double-render

async function openNotifPanel(anchor) {
  // Guard: if already open, close it (sidebar calling openNotifPanel acts as toggle)
  const existing = document.getElementById("notif-panel");
  if (existing) {
    existing.remove();
    window._notifPanelOpen = false;
    window._refreshNotifPanel = null;
    return;
  }
  const panel = document.createElement("div");
  panel.id = "notif-panel";
  panel.style.cssText = [
    "position:fixed;top:60px;right:16px;z-index:9990;",
    "width:360px;max-width:calc(100vw - 24px);max-height:80vh;",
    "background:#fff;border-radius:18px;",
    "box-shadow:0 12px 48px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.08);",
    "display:flex;flex-direction:column;overflow:hidden;",
    "animation:_npIn .22s cubic-bezier(.34,1.2,.64,1) both;",
  ].join("");

  panel.innerHTML = `
    <style>
      @keyframes _npIn { from{opacity:0;transform:translateY(-10px)} }
      #notif-panel .np-head {
        display:flex;align-items:center;justify-content:space-between;
        padding:16px 18px 10px;border-bottom:1px solid #f0f0ea;flex-shrink:0;
      }
      #notif-panel .np-title {
        font-weight:800;font-size:1.05rem;color:#2d3520;font-family:'Lora',serif;
      }
      #notif-panel .np-action {
        font-size:.76rem;color:#8fa45a;font-weight:600;cursor:pointer;
        background:none;border:none;padding:4px 8px;border-radius:6px;
        transition:background .15s;
      }
      #notif-panel .np-action:hover { background:#f4f7ed; }
      #notif-panel .np-body  { overflow-y:auto;flex:1;padding:4px 0 8px; }
      #notif-panel .np-section-label {
        font-size:.72rem;font-weight:700;color:#aaa;letter-spacing:.06em;
        text-transform:uppercase;padding:10px 18px 4px;
      }
      #notif-panel .np-item {
        display:flex;align-items:flex-start;gap:12px;
        padding:10px 18px;cursor:pointer;transition:background .12s;
        border-radius:0;position:relative;
      }
      #notif-panel .np-item:hover { background:#f8faf3; }
      #notif-panel .np-item.unread::before {
        content:'';position:absolute;left:6px;top:50%;transform:translateY(-50%);
        width:6px;height:6px;border-radius:50%;background:#7a8f52;
      }
      #notif-panel .np-av {
        width:40px;height:40px;border-radius:50%;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        font-weight:700;font-size:.85rem;color:#fff;
      }
      #notif-panel .np-content { flex:1;min-width:0; }
      #notif-panel .np-msg {
        font-size:.84rem;color:#3d4a2a;line-height:1.4;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
      }
      #notif-panel .np-time { font-size:.73rem;color:#aaa;margin-top:2px; }
      #notif-panel .np-emoji { font-size:1.1rem;width:40px;height:40px;border-radius:50%;background:#f4f7ed;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
      /* Inline friend-request buttons */
      #notif-panel .np-freq-btns { display:flex;gap:6px;margin-top:6px; }
      #notif-panel .np-freq-btn {
        padding:5px 12px;border-radius:7px;font-size:.77rem;font-weight:700;
        cursor:pointer;border:none;transition:opacity .15s;
      }
      #notif-panel .np-freq-btn:hover { opacity:.82; }
      #notif-panel .np-freq-btn.accept { background:#7a8f52;color:#fff; }
      #notif-panel .np-freq-btn.decline { background:none;color:#c0392b;border:1.5px solid #e0b0a8; }
      /* Footer */
      #notif-panel .np-footer {
        border-top:1px solid #f0f0ea;padding:10px 18px;text-align:center;flex-shrink:0;
      }
      #notif-panel .np-footer a {
        font-size:.8rem;color:#8fa45a;font-weight:600;text-decoration:none;
      }
      #notif-panel .np-footer a:hover { text-decoration:underline; }
      #notif-panel .np-empty {
        text-align:center;padding:32px 24px;color:#bbb;font-size:.85rem;
      }
      #notif-panel .np-shimmer {
        height:58px;margin:4px 18px;border-radius:10px;
        background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);
        background-size:200% 100%;animation:shimmer 1.4s infinite;
      }
    </style>

    <div class="np-head">
      <span class="np-title">Updates</span>
      <button class="np-action" id="_np_mark_all">Mark all as seen</button>
    </div>
    <div class="np-body" id="_np_body">
      <div class="np-shimmer"></div>
      <div class="np-shimmer"></div>
      <div class="np-shimmer"></div>
    </div>
    <div class="np-footer">
      <a href="pages/dashboard.html#notifications">See all in Dashboard →</a>
    </div>`;

  document.body.appendChild(panel);
  window._notifPanelOpen = true;

  // Mark-all-read button
  panel.querySelector("#_np_mark_all")?.addEventListener("click", async () => {
    try {
      await api("/dashboard/notifications/read-all", { method: "PATCH" });
      panel
        .querySelectorAll(".np-item.unread")
        .forEach((el) => el.classList.remove("unread"));
      // Zero badge
      document.querySelectorAll("#notif-badge").forEach((b) => {
        b.textContent = "";
        b.style.display = "none";
      });
      document
        .querySelectorAll("#topbar-notif-dot")
        .forEach((d) => (d.style.display = "none"));
    } catch {
      /* silent */
    }
  });

  // Load notifications
  async function loadPanelNotifs() {
    const body = panel.querySelector("#_np_body");
    if (!body) return;
    try {
      const { data: notifs = [] } = await api("/dashboard/notifications");
      renderPanelNotifs(body, notifs);
    } catch {
      body.innerHTML = `<div class="np-empty">Could not load notifications.</div>`;
    }
  }

  function renderPanelNotifs(body, notifs) {
    if (!notifs.length) {
      body.innerHTML = `<div class="np-empty">You're all caught up! 🎉</div>`;
      return;
    }

    const EMOJI_MAP = {
      reply: "💬",
      helped: "✅",
      badge: "🏆",
      sos: "🆘",
      follow: "👤",
      milestone: "🎉",
      friend_request: "🤝",
      friend_accepted: "✅",
    };
    const COLORS_MAP = [
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
      for (const c of String(id || ""))
        h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
      return COLORS_MAP[h % COLORS_MAP.length];
    }
    function initials(n) {
      return (
        (n || "")
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2) || "?"
      ).toUpperCase();
    }
    function timeAgoShort(iso) {
      if (!iso) return "";
      const d = Date.now() - new Date(iso).getTime();
      const m = Math.floor(d / 60000);
      if (m < 1) return "Just now";
      if (m < 60) return m + "m ago";
      const h = Math.floor(m / 60);
      if (h < 24) return h + "h ago";
      const dy = Math.floor(h / 24);
      return dy === 1 ? "Yesterday" : dy + "d ago";
    }
    function esc2(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    // ── Deduplicate friend_request by actorId ─────────────────────────────
    // Multiple requests from the same person create multiple notifications.
    // Keep only the most recent one per actor so the panel shows one row.
    const deduped = [];
    const seenFreqActors = new Set();
    for (const n of notifs) {
      if (n.type === "friend_request") {
        const aid = String(n.actor?._id || n.actor?.id || "");
        if (aid && seenFreqActors.has(aid)) continue; // skip duplicate
        if (aid) seenFreqActors.add(aid);
      }
      deduped.push(n);
    }

    const newNotifs = deduped.filter((n) => !n.isRead);
    const seenNotifs = deduped.filter((n) => n.isRead);

    let html = "";

    function notifItemHTML(n) {
      const actor = n.actor || {};
      const actorId = String(actor._id || actor.id || "");
      const aName = actor.name || actor.handle || "";
      const emoji = EMOJI_MAP[n.type] || "🔔";
      const unreadCls = n.isRead ? "" : " unread";

      let avHTML;
      if (actor.avatar) {
        avHTML = `<div class="np-av" style="background:url(${actor.avatar}) center/cover no-repeat;"></div>`;
      } else if (aName) {
        avHTML = `<div class="np-av" style="background:${colorFor(actorId)};">${initials(aName)}</div>`;
      } else {
        avHTML = `<div class="np-emoji">${emoji}</div>`;
      }

      // Accept/Decline ONLY for unread friend requests.
      // After accepting/declining the notification becomes read — buttons won't reappear.
      let freqBtns = "";
      if (n.type === "friend_request" && actorId && !n.isRead) {
        freqBtns = `
          <div class="np-freq-btns">
            <button class="np-freq-btn accept" data-id="${esc2(actorId)}" onclick="npAcceptFreq(this)">Accept</button>
            <button class="np-freq-btn decline" data-id="${esc2(actorId)}" onclick="npDeclineFreq(this)">Decline</button>
          </div>`;
      }

      const profileLink = actorId
        ? `onclick="window.location.href='pages/crafter-profile.html?id=${esc2(actorId)}\'"`
        : "";

      return `
        <div class="np-item${unreadCls}" data-notif-id="${esc2(n._id || n.id || "")}" data-actor-id="${esc2(actorId)}">
          <div ${profileLink} style="cursor:${actorId ? "pointer" : "default"};">${avHTML}</div>
          <div class="np-content">
            <div class="np-msg" ${profileLink} style="cursor:${actorId ? "pointer" : "default"};">${esc2(n.message)}</div>
            <div class="np-time">${timeAgoShort(n.createdAt)}</div>
            ${freqBtns}
          </div>
        </div>`;
    }

    if (newNotifs.length) {
      html += `<div class="np-section-label">New</div>`;
      html += newNotifs.map(notifItemHTML).join("");
    }
    if (seenNotifs.length) {
      html += `<div class="np-section-label">Seen</div>`;
      html += seenNotifs.map(notifItemHTML).join("");
    }

    body.innerHTML = html;
  }
  // Expose refresh so socket-client.js can call it
  window._refreshNotifPanel = loadPanelNotifs;

  loadPanelNotifs();

  // Close on outside click
  function handleOutsideClick(e) {
    const bellBtn = document.getElementById("notif-bell-btn");
    const sidebarBtn = document.getElementById("sidebar-notif-btn");
    if (
      !panel.contains(e.target) &&
      e.target !== bellBtn &&
      !bellBtn?.contains(e.target) &&
      e.target !== sidebarBtn &&
      !sidebarBtn?.contains(e.target)
    ) {
      panel.remove();
      window._notifPanelOpen = false;
      window._refreshNotifPanel = null;
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    }
  }
  function handleEsc(e) {
    if (e.key === "Escape") {
      panel.remove();
      window._notifPanelOpen = false;
      window._refreshNotifPanel = null;
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    }
  }
  setTimeout(() => {
    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("keydown", handleEsc);
  }, 0);
}

/* ── Inline friend-request actions from inside the panel ── */
async function npAcceptFreq(btn) {
  const actorId = btn.dataset.id;
  if (!actorId) return;
  btn.disabled = true;
  btn.textContent = "…";
  try {
    await api("/crafter/" + actorId + "/accept", { method: "POST" });

    // Remove ALL panel rows for this actor (de-duplicated view may still have one;
    // removes any that survived de-dup in case of race conditions)
    const panel = document.getElementById("notif-panel");
    if (panel) {
      panel
        .querySelectorAll(`.np-item[data-actor-id="${actorId}"]`)
        .forEach((item) => {
          item.querySelector(".np-freq-btns")?.remove();
          const msg = item.querySelector(".np-msg");
          if (msg) msg.textContent = "✓ Friend request accepted!";
          item.classList.remove("unread");
        });
    }

    // Mark all notifications as read so buttons don't reappear on reopen
    api("/dashboard/notifications/read-all", { method: "PATCH" }).catch(
      () => {},
    );

    showToast("Friend request accepted! 🎉", "success");
    loadFriendRequests(); // refresh the sidebar friend-requests widget
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "Accept";
    showToast(e.message || "Could not accept", "error");
  }
}

async function npDeclineFreq(btn) {
  const actorId = btn.dataset.id;
  if (!actorId) return;
  btn.disabled = true;
  try {
    await api("/crafter/" + actorId + "/decline", { method: "POST" });

    // Remove ALL panel rows for this actor
    const panel = document.getElementById("notif-panel");
    if (panel) {
      panel
        .querySelectorAll(`.np-item[data-actor-id="${actorId}"]`)
        .forEach((item) => item.remove());
    }

    // Mark read so declined notifs don't show buttons on reopen
    api("/dashboard/notifications/read-all", { method: "PATCH" }).catch(
      () => {},
    );
  } catch (e) {
    btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  // All sections load in parallel for speed
  loadWelcome();
  loadFeed();
  loadNeedsHelp();
  loadActivity();
  loadTopHelpers();
  loadSuggestions();
  loadFriendRequests();

  // Notification panel
  initNotifPanel();

  // Socket live feed
  // Small delay to ensure socket-client.js has connected
  setTimeout(initIndexSocket, 800);
});
