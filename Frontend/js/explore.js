// Frontend/js/explore.js
// ─────────────────────────────────────────────────────────────────────────────
// Endpoints used:
//   GET  /api/explore/posts          — paginated post feed
//   GET  /api/explore/crafters       — featured crafters strip
//   GET  /api/explore/trends         — trending topics grid
//   GET  /api/explore/active         — active SOS sidebar
//   GET  /api/explore/leaderboard    — top helpers sidebar
//   GET  /api/explore/search?q=&type — unified live search
//   GET  /api/explore/regions        — real location data
//   PATCH /api/posts/:id/save        — bookmark toggle
//   POST  /api/crafter/:id/follow    — send / cancel / unfriend
//   POST  /api/crafter/:id/accept    — accept friend request
//   POST  /api/crafter/:id/decline   — decline friend request
// ─────────────────────────────────────────────────────────────────────────────
"use strict";

const API_BASE = "http://localhost:5000/api";
const token = localStorage.getItem("token");
const _user = JSON.parse(localStorage.getItem("user") || "{}");

if (!token) window.location.href = "login.html";

/* ═══════════════════════════════════════════════════
   FETCH HELPER
═══════════════════════════════════════════════════ */
async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

/* ═══════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════ */
let _state = {
  filter: "all",
  sort: "recent",
  search: "",
  region: "all",
  page: 1,
  hasMore: false,
  bookmarks: new Set(),
  // Per-crafter friend status: { [userId]: "none"|"pending_sent"|"pending_received"|"friends" }
  friendStatuses: {},
};

/* ═══════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════ */
function esc(s = "") {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}

function escAttr(s = "") {
  return String(s ?? "")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function stripHTML(html = "") {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent || d.innerText || "";
}

function initials(name = "", handle = "") {
  return (name || handle || "?").replace("@", "").slice(0, 2).toUpperCase();
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}

function severityLabel(post) {
  if (post.type !== "sos" || post.status === "resolved") return null;
  const hrs = (Date.now() - new Date(post.createdAt)) / 3600000;
  if (hrs < 2 && post.replyCount < 3) return "High";
  if (hrs < 12) return "Medium";
  return "Low";
}

function typeLabel(type) {
  return (
    {
      sos: "Distress Call",
      tut: "Tutorial",
      com: "Community",
      res: "Resource",
    }[type] ?? type
  );
}

const _COLORS = [
  "#b5c98a",
  "#a8c4d8",
  "#d4b8e0",
  "#f0c07a",
  "#c8a98a",
  "#9ec4a0",
  "#f7b8a2",
  "#c9d8b6",
];
function randomColor(id = "") {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) & 0xffffff;
  return _COLORS[h % _COLORS.length];
}

function avatarEl(name, id, avatar, sizePx = "34px") {
  if (avatar) {
    return `<div style="width:${sizePx};height:${sizePx};border-radius:50%;background:url(${avatar}) center/cover;flex-shrink:0;"></div>`;
  }
  const ini = initials(name);
  return `<div style="width:${sizePx};height:${sizePx};border-radius:50%;background:${randomColor(String(id))};color:#fff;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:700;flex-shrink:0;">${ini}</div>`;
}

/* ═══════════════════════════════════════════════════
   CATEGORY PILLS  (static)
═══════════════════════════════════════════════════ */
const CATEGORIES = [
  { label: "All", dot: "#7a8f52", filter: "all" },
  { label: "🆘 Distress", dot: "#d35b3a", filter: "distress" },
  { label: "💰 Financial", dot: "#c9a227", filter: "financial" },
  { label: "📦 Order Issues", dot: "#5b8dd3", filter: "order" },
  { label: "🧵 Supplier", dot: "#9e6bb5", filter: "supplier" },
  { label: "📚 Tutorials", dot: "#6ab04c", filter: "tutorial" },
  { label: "✅ Resolved", dot: "#3a7d2c", filter: "resolved" },
  { label: "💬 Community", dot: "#c87d3a", filter: "community" },
];

function renderCats() {
  const el = document.getElementById("cat-row");
  if (!el) return;
  el.innerHTML = CATEGORIES.map(
    (c) => `
    <div class="cat-pill ${c.filter === _state.filter ? "active" : ""}"
         onclick="setFilter('${c.filter}')">
      <span class="cp-dot" style="background:${c.dot}"></span>${c.label}
    </div>`,
  ).join("");
}

/* ═══════════════════════════════════════════════════
   FEATURED CRAFTERS
   4-state friend button: none / pending_sent /
   pending_received / friends
═══════════════════════════════════════════════════ */
async function loadAndRenderCrafters() {
  const strip = document.getElementById("crafters-strip");
  if (!strip) return;
  strip.innerHTML =
    `<div class="loading-shimmer" style="height:200px;border-radius:16px;min-width:170px;"></div>`.repeat(
      4,
    );

  try {
    const { crafters } = await api("/explore/crafters");

    // Seed state map from API
    crafters.forEach((c) => {
      _state.friendStatuses[String(c.id)] = c.friendStatus || "none";
    });

    if (!crafters.length) {
      strip.innerHTML = `<p style="color:var(--text-light);font-size:.84rem;padding:12px 0;">No crafters to show yet.</p>`;
      return;
    }

    strip.innerHTML = crafters
      .map((c) => {
        const uid = String(c.id);
        const status = _state.friendStatuses[uid] || "none";
        const av = c.avatar
          ? `<div class="crafter-av" style="background:url(${c.avatar}) center/cover;"></div>`
          : `<div class="crafter-av" style="background:${randomColor(uid)};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.2rem;">${initials(c.name, c.handle)}</div>`;

        return `
      <div class="crafter-card"
           role="button" tabindex="0" style="cursor:pointer;"
           onclick="window.location.href='crafter-profile.html?id=${escAttr(uid)}'">
        <div class="crafter-banner" style="background:linear-gradient(135deg,${randomColor(uid)}cc,${randomColor(uid)})">
          ${av}
        </div>
        <div class="crafter-body">
          <div class="crafter-name">${esc(c.name)}</div>
          <div class="crafter-handle">${esc(c.handle)}</div>
          ${c.location ? `<div style="font-size:.72rem;color:var(--text-light);margin-bottom:4px;">📍 ${esc(c.location)}</div>` : ""}
          <div class="crafter-tags">
            ${(c.tags || []).map((t) => `<span class="crafter-tag">${esc(t)}</span>`).join("")}
          </div>
          <div class="crafter-stats">
            <div class="crafter-stat"><strong>${c.followers}</strong>followers</div>
            <div class="crafter-stat"><strong>${(c.points || 0).toLocaleString()}</strong>pts</div>
          </div>
          ${crafterFriendBtns(uid, status)}
        </div>
      </div>`;
      })
      .join("");
  } catch (err) {
    strip.innerHTML = `<p style="color:var(--text-light);font-size:.83rem;">Could not load crafters.</p>`;
    console.error("[loadCrafters]", err);
  }
}

/**
 * crafterFriendBtns(uid, status)
 * Returns the action button HTML for a crafter card.
 *
 * none             → green  "+ Add Friend"
 * pending_sent     → muted  "⏳ Pending"  (click cancels)
 * pending_received → green  "✓ Accept" + red "Decline"
 * friends          → muted  "✓ Friends"  (click unfriends)
 */
function crafterFriendBtns(uid, status) {
  const safeId = escAttr(uid);
  switch (status) {
    case "friends":
      return `<button class="follow-btn following" data-id="${safeId}"
                onclick="event.stopPropagation(); crafterUnfriend(this)" title="Unfriend">
                ✓ Friends
              </button>`;
    case "pending_sent":
      return `<button class="follow-btn pending" data-id="${safeId}"
                onclick="event.stopPropagation(); crafterCancelRequest(this)" title="Cancel request">
                ⏳ Pending
              </button>`;
    case "pending_received":
      return `<div class="crafter-freq-btns" onclick="event.stopPropagation()">
                <button class="follow-btn" data-id="${safeId}"
                  onclick="crafterAcceptRequest(this)" title="Accept friend request">
                  ✓ Accept
                </button>
                <button class="follow-btn freq-decline" data-id="${safeId}"
                  onclick="crafterDeclineRequest(this)" title="Decline">
                  Decline
                </button>
              </div>`;
    default: // "none"
      return `<button class="follow-btn" data-id="${safeId}"
                onclick="event.stopPropagation(); crafterSendRequest(this)" title="Send friend request">
                + Add Friend
              </button>`;
  }
}

/* ── Friend action handlers ──────────────────────────── */

async function crafterSendRequest(btn) {
  const uid = btn.dataset.id;
  _state.friendStatuses[uid] = "pending_sent";
  _refreshCrafterBtns(uid);
  try {
    const { friendStatus } = await api(`/crafter/${uid}/follow`, {
      method: "POST",
    });
    _state.friendStatuses[uid] = friendStatus;
    _refreshCrafterBtns(uid);
  } catch (err) {
    _state.friendStatuses[uid] = "none";
    _refreshCrafterBtns(uid);
    if (window.craftToast)
      craftToast(err.message || "Could not send request", "error");
  }
}

async function crafterCancelRequest(btn) {
  const uid = btn.dataset.id;
  _state.friendStatuses[uid] = "none";
  _refreshCrafterBtns(uid);
  try {
    const { friendStatus } = await api(`/crafter/${uid}/follow`, {
      method: "POST",
    });
    _state.friendStatuses[uid] = friendStatus;
    _refreshCrafterBtns(uid);
  } catch {
    _state.friendStatuses[uid] = "pending_sent";
    _refreshCrafterBtns(uid);
  }
}

async function crafterAcceptRequest(btn) {
  const uid = btn.dataset.id;
  _state.friendStatuses[uid] = "friends";
  _refreshCrafterBtns(uid);
  try {
    const { friendStatus } = await api(`/crafter/${uid}/accept`, {
      method: "POST",
    });
    _state.friendStatuses[uid] = friendStatus;
    _refreshCrafterBtns(uid);
    if (window.craftToast) craftToast("Friend request accepted! 🎉", "success");
  } catch (err) {
    _state.friendStatuses[uid] = "pending_received";
    _refreshCrafterBtns(uid);
    if (window.craftToast)
      craftToast(err.message || "Could not accept", "error");
  }
}

async function crafterDeclineRequest(btn) {
  const uid = btn.dataset.id;
  _state.friendStatuses[uid] = "none";
  _refreshCrafterBtns(uid);
  try {
    await api(`/crafter/${uid}/decline`, { method: "POST" });
  } catch {
    _state.friendStatuses[uid] = "pending_received";
    _refreshCrafterBtns(uid);
  }
}

async function crafterUnfriend(btn) {
  const uid = btn.dataset.id;
  _state.friendStatuses[uid] = "none";
  _refreshCrafterBtns(uid);
  try {
    const { friendStatus } = await api(`/crafter/${uid}/follow`, {
      method: "POST",
    });
    _state.friendStatuses[uid] = friendStatus;
    _refreshCrafterBtns(uid);
  } catch {
    _state.friendStatuses[uid] = "friends";
    _refreshCrafterBtns(uid);
  }
}

function _refreshCrafterBtns(uid) {
  const status = _state.friendStatuses[uid] || "none";
  document.querySelectorAll(".crafter-card .crafter-body").forEach((body) => {
    const existing = body.querySelector(`[data-id="${uid}"]`);
    if (!existing) return;
    // Replace either the wrapper div (pending_received) or the button itself
    const container = existing.closest(".crafter-freq-btns") || existing;
    container.outerHTML = crafterFriendBtns(uid, status);
  });
}

/* ═══════════════════════════════════════════════════
   TRENDING TOPICS
═══════════════════════════════════════════════════ */
async function loadAndRenderTrends() {
  const grid = document.getElementById("trends-grid");
  if (!grid) return;
  grid.innerHTML =
    `<div class="loading-shimmer" style="height:52px;border-radius:12px;"></div>`.repeat(
      6,
    );

  try {
    const { trends } = await api("/explore/trends");
    const display = trends.length
      ? trends
      : [
          {
            emoji: "💸",
            name: "Wholesale Pricing",
            label: "Trending this week",
          },
          { emoji: "🧶", name: "Natural Dyeing", label: "Trending this week" },
          {
            emoji: "📦",
            name: "Courier Problems",
            label: "Trending this week",
          },
          {
            emoji: "🤝",
            name: "Supplier Networks",
            label: "Trending this week",
          },
          { emoji: "🌿", name: "Slow Fashion", label: "Trending this week" },
          {
            emoji: "📐",
            name: "Pattern Licensing",
            label: "Trending this week",
          },
        ];

    grid.innerHTML = display
      .map(
        (t) => `
      <div class="trend-chip" onclick="setSearchTerm('${escAttr(t.name)}')">
        <span class="trend-icon">${t.emoji}</span>
        <div class="trend-text">
          <div class="trend-name">${esc(t.name)}</div>
          <div class="trend-count">${esc(t.label)}</div>
        </div>
      </div>`,
      )
      .join("");
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--text-light);font-size:.83rem;">Could not load trends.</p>`;
    console.error("[loadTrends]", err);
  }
}

/* ═══════════════════════════════════════════════════
   POSTS FEED
═══════════════════════════════════════════════════ */
async function loadAndRenderPosts(append = false) {
  const grid = document.getElementById("posts-grid");
  const moreBtn = document.getElementById("load-more-wrap");
  if (!grid) return;

  if (!append) {
    grid.innerHTML =
      `<div class="loading-shimmer" style="height:220px;border-radius:18px;"></div>`.repeat(
        3,
      );
    if (moreBtn) moreBtn.style.display = "none";
  }

  try {
    const params = new URLSearchParams({
      filter: _state.filter,
      sort: _state.sort,
      search: _state.search,
      page: _state.page,
      limit: 5,
      region: _state.region !== "all" ? _state.region : "",
    });

    const { posts, hasMore } = await api(`/explore/posts?${params}`);
    posts.forEach((p) => {
      if (p.isSaved) _state.bookmarks.add(String(p.id));
    });
    _state.hasMore = hasMore;

    const html = posts.map(buildPostCard).join("");

    if (append) {
      grid.querySelectorAll(".loading-shimmer").forEach((el) => el.remove());
      grid.insertAdjacentHTML("beforeend", html);
    } else {
      grid.innerHTML =
        html ||
        `<div style="text-align:center;padding:48px 24px;color:var(--text-light);background:var(--card);border-radius:18px;">
           <div style="font-size:2rem;margin-bottom:8px;">🔍</div>
           <div style="font-weight:600;margin-bottom:4px;">No posts found</div>
           <div style="font-size:.83rem;">Try a different filter or search term</div>
         </div>`;
    }

    if (moreBtn) moreBtn.style.display = hasMore ? "block" : "none";

    const titleMap = {
      all: "All Posts",
      distress: "Distress Calls",
      financial: "Financial Distress",
      order: "Order Issues",
      supplier: "Supplier Issues",
      tutorial: "Tutorials",
      resolved: "Resolved Posts",
      community: "Community Posts",
      resource: "Resources",
    };
    const titleEl = document.getElementById("posts-section-title");
    if (titleEl) titleEl.textContent = titleMap[_state.filter] ?? "All Posts";
  } catch (err) {
    grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-light);">Could not load posts. Please try again.</div>`;
    console.error("[loadPosts]", err);
  }
}

function buildPostCard(p) {
  const sev = severityLabel(p);
  const sevCls =
    sev === "High" ? "b-high" : sev === "Medium" ? "b-med" : "b-low";
  const bkmk = _state.bookmarks.has(String(p.id));
  const avName = p.author?.name || "?";

  const avHtml = p.author?.avatar
    ? `<div class="ec-av" style="background:url(${p.author.avatar}) center/cover;cursor:pointer;"
           onclick="window.location.href='crafter-profile.html?id=${escAttr(p.author.id)}'"></div>`
    : `<div class="ec-av" style="background:${randomColor(String(p.author?.id || ""))};cursor:pointer;"
           onclick="window.location.href='crafter-profile.html?id=${escAttr(p.author?.id)}'">
           <span style="color:#fff;font-weight:700;font-size:.72rem;">${initials(avName)}</span>
         </div>`;

  const plainBody = stripHTML(p.body || "").slice(0, 200);

  return `
  <div class="explore-card" id="post-${escAttr(p.id)}">
    <div class="ec-header">
      ${avHtml}
      <div class="ec-meta">
        <div class="ec-name" style="cursor:pointer;"
             onclick="window.location.href='crafter-profile.html?id=${escAttr(p.author?.id)}'">
          ${esc(avName)}
        </div>
        <div class="ec-time">${timeAgo(p.createdAt)}</div>
        <div class="ec-badges">
          ${sev ? `<span class="badge ${sevCls}">${sev}</span>` : ""}
          ${p.status === "resolved" ? `<span class="badge b-resolved">✓ Resolved</span>` : ""}
          <span class="badge b-cat">${typeLabel(p.type)}</span>
        </div>
      </div>
    </div>
    <div class="ec-body" style="cursor:pointer;"
         onclick="window.location.href='post-detail.html?id=${escAttr(p.id)}'">
      <div class="ec-title">${esc(p.title)}</div>
      <div class="ec-para">${esc(plainBody)}${plainBody.length >= 200 ? "…" : ""}</div>
      ${
        p.tags?.length
          ? `<div class="ec-tags">${p.tags
              .slice(0, 4)
              .map((t) => `<span class="ec-tag">#${esc(t)}</span>`)
              .join("")}</div>`
          : ""
      }
    </div>
    <div class="ec-footer">
      <div class="ec-foot-av">${initials(_user.name || "?").slice(0, 1)}</div>
      <input class="ec-msg-input" type="text" placeholder="Offer support…"
             onkeydown="sendReply(event,'${escAttr(p.id)}',this)" />
      <div class="ec-actions">
        <button class="icon-btn" title="Share" onclick="sharePost('${escAttr(p.id)}')">
          <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
        <button class="icon-btn" title="Comment" onclick="focusReply('${escAttr(p.id)}')">
          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </button>
        <button class="icon-btn ${bkmk ? "bookmarked" : ""}" title="Bookmark"
                data-id="${escAttr(p.id)}" onclick="toggleBookmark('${escAttr(p.id)}',this)">
          <svg viewBox="0 0 24 24" ${bkmk ? 'style="fill:var(--accent);stroke:var(--accent)"' : ""}>
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="ec-engage">
      <span class="engage-stat" style="cursor:pointer;"
            onclick="window.location.href='post-detail.html?id=${escAttr(p.id)}'">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${p.replyCount} response${p.replyCount !== 1 ? "s" : ""}
      </span>
      <span class="engage-stat">
        <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
        ${p.saveCount} saved
      </span>
      ${p.author?.location ? `<span class="engage-stat" style="margin-left:auto;font-size:.74rem;">📍 ${esc(p.author.location)}</span>` : ""}
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════
   ACTIVE REQUESTS  — sidebar
═══════════════════════════════════════════════════ */
async function loadAndRenderActive() {
  const el = document.getElementById("live-list");
  if (!el) return;
  try {
    const { requests } = await api("/explore/active");
    el.innerHTML =
      requests
        .map(
          (r) => `
      <div class="live-item" style="cursor:pointer;"
           onclick="window.location.href='post-detail.html?id=${escAttr(r.id)}'">
        ${avatarEl(r.author.name, String(r.id), r.author.avatar, "36px")}
        <div class="live-body">
          <div class="live-name">${esc(r.author.name)}</div>
          <div class="live-preview">${esc(r.preview)}</div>
        </div>
        <span class="live-badge lb-high">SOS</span>
      </div>`,
        )
        .join("") ||
      `<p style="color:var(--text-light);font-size:.82rem;padding:8px 0">No active requests right now 🌿</p>`;
  } catch (err) {
    el.innerHTML = `<p style="color:var(--text-light);font-size:.82rem;padding:8px 0">Could not load requests.</p>`;
    console.error("[loadActive]", err);
  }
}

/* ═══════════════════════════════════════════════════
   LEADERBOARD  — sidebar
═══════════════════════════════════════════════════ */
async function loadAndRenderLeaderboard() {
  const el = document.getElementById("leaderboard");
  if (!el) return;
  try {
    const { leaderboard } = await api("/explore/leaderboard");
    el.innerHTML =
      leaderboard
        .map(
          (l) => `
      <div class="leader-item" style="cursor:pointer;"
           onclick="window.location.href='crafter-profile.html?id=${escAttr(l.id)}'">
        <div class="leader-rank ${l.rankClass}">${l.badge}</div>
        ${avatarEl(l.name, String(l.id), l.avatar, "34px")}
        <div class="leader-info">
          <div class="leader-name">${esc(l.name)}</div>
          <div class="leader-pts">${(l.points || 0).toLocaleString()} pts · ${l.helped || 0} helped</div>
        </div>
      </div>`,
        )
        .join("") ||
      `<p style="color:var(--text-light);font-size:.82rem;padding:8px 0">No data yet.</p>`;
  } catch (err) {
    el.innerHTML = `<p style="color:var(--text-light);font-size:.82rem;padding:8px 0">Could not load leaderboard.</p>`;
    console.error("[loadLeaderboard]", err);
  }
}

/* ═══════════════════════════════════════════════════
   REGIONS  — sidebar, from real DB data
═══════════════════════════════════════════════════ */
async function loadAndRenderRegions() {
  const el = document.getElementById("location-list");
  if (!el) return;
  el.innerHTML =
    `<div class="loading-shimmer" style="height:28px;border-radius:8px;margin-bottom:5px;"></div>`.repeat(
      4,
    );

  try {
    const { regions } = await api("/explore/regions");

    const items = [
      { name: "All Regions", key: "all", count: null },
      ...regions.map((r) => ({ name: r.name, key: r.name, count: r.count })),
    ];

    if (regions.length === 0) {
      items.push({
        name: "No locations set yet",
        key: null,
        count: null,
        disabled: true,
      });
    }

    el.innerHTML = items
      .map(
        (r) => `
      <div class="loc-item ${_state.region === r.key ? "active" : ""} ${r.disabled ? "loc-disabled" : ""}"
           ${r.key && !r.disabled ? `onclick="pickRegion(this,'${escAttr(r.key)}')"` : ""}>
        <div class="loc-left"><span class="loc-dot"></span>${esc(r.name)}</div>
        ${r.count != null ? `<span class="loc-count">${r.count}</span>` : ""}
      </div>`,
      )
      .join("");

    if (regions.length === 0) {
      el.insertAdjacentHTML(
        "beforeend",
        `<p style="font-size:.76rem;color:var(--text-light);padding:8px 0 0;line-height:1.4;">
           Crafters can add their location in Settings to appear here.
         </p>`,
      );
    }
  } catch (err) {
    el.innerHTML = `<p style="font-size:.78rem;color:var(--text-light);padding:8px 0">Could not load regions.</p>`;
    console.error("[loadRegions]", err);
  }
}

/* ═══════════════════════════════════════════════════
   LIVE SEARCH DROPDOWN
   Min 2 chars, 350ms debounce, grouped results.
═══════════════════════════════════════════════════ */
let _searchTimer = null;
let _searchType = "all";
let _dropVisible = false;

function onSearch() {
  const q = (document.getElementById("global-search")?.value || "").trim();

  const clearBtn = document.getElementById("search-clear");
  if (clearBtn) clearBtn.style.display = q ? "flex" : "none";

  clearTimeout(_searchTimer);

  if (q.length < 2) {
    hideSearchDrop();
    if (_state.search) {
      _state.search = "";
      _state.page = 1;
      loadAndRenderPosts();
    }
    return;
  }

  _searchTimer = setTimeout(async () => {
    _showDropLoading();

    const [searchRes] = await Promise.allSettled([
      api(`/explore/search?q=${encodeURIComponent(q)}&type=${_searchType}`),
    ]);

    if (searchRes.status === "fulfilled") {
      renderSearchDrop(q, searchRes.value.results);
    } else {
      hideSearchDrop();
    }

    _state.search = q;
    _state.page = 1;
    loadAndRenderPosts();
  }, 350);
}

function clearSearch() {
  const el = document.getElementById("global-search");
  if (el) el.value = "";
  const clearBtn = document.getElementById("search-clear");
  if (clearBtn) clearBtn.style.display = "none";
  _state.search = "";
  _state.page = 1;
  hideSearchDrop();
  loadAndRenderPosts();
}

function setSearchType(type, btn) {
  _searchType = type;
  document
    .querySelectorAll(".stype-pill")
    .forEach((p) => p.classList.remove("active"));
  btn.classList.add("active");
  const q = (document.getElementById("global-search")?.value || "").trim();
  if (q.length >= 2) onSearch();
}

function hideSearchDrop() {
  const drop = document.getElementById("search-drop");
  if (drop) drop.style.display = "none";
  _dropVisible = false;
}

function _getOrCreateDrop() {
  let drop = document.getElementById("search-drop");
  if (!drop) {
    const wrap = document.querySelector(".search-bar-wrap");
    if (!wrap) return null;
    wrap.style.position = "relative";
    drop = document.createElement("div");
    drop.id = "search-drop";
    Object.assign(drop.style, {
      position: "absolute",
      top: "calc(100% + 8px)",
      left: "0",
      right: "0",
      background: "#fff",
      borderRadius: "14px",
      zIndex: "999",
      boxShadow: "0 8px 32px rgba(0,0,0,.14)",
      maxHeight: "420px",
      overflowY: "auto",
      display: "none",
      border: "1.5px solid rgba(122,143,82,.18)",
    });
    wrap.appendChild(drop);
  }
  return drop;
}

function _showDropLoading() {
  const drop = _getOrCreateDrop();
  if (!drop) return;
  drop.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-light,#9a9690);font-size:.83rem;">Searching…</div>`;
  drop.style.display = "block";
  _dropVisible = true;
}

function renderSearchDrop(q, results = {}) {
  const drop = _getOrCreateDrop();
  if (!drop) return;

  const { posts = [], people = [], challenges = [], badges = [] } = results;
  const total =
    posts.length + people.length + challenges.length + badges.length;

  if (!total) {
    drop.innerHTML = `
      <div style="padding:28px;text-align:center;color:var(--text-light,#9a9690);">
        <div style="font-size:1.6rem;margin-bottom:8px;">🔍</div>
        <div style="font-weight:600;font-size:.88rem;color:#2c2822;">No results for "${esc(q)}"</div>
        <div style="font-size:.78rem;margin-top:4px;">Try a different keyword</div>
      </div>`;
    drop.style.display = "block";
    _dropVisible = true;
    return;
  }

  const TYPE_COLOR = {
    sos: "#d35b3a",
    tut: "#6ab04c",
    com: "#c87d3a",
    res: "#5b8dd3",
  };
  const TYPE_ICON = { sos: "🆘", tut: "📚", com: "💬", res: "📦" };

  let html = "";

  if (people.length) {
    html += `<div class="sdrop-label">👤 People</div>`;
    html += people
      .map(
        (u) => `
      <div class="sdrop-row" onclick="window.location.href='crafter-profile.html?id=${escAttr(u.id)}'; hideSearchDrop()">
        ${avatarEl(u.name, String(u.id), u.avatar, "32px")}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:.86rem;color:#2c2822;">${esc(u.name)}</div>
          <div style="font-size:.74rem;color:#9a9690;">${esc(u.handle || "")}${u.location ? " · 📍 " + esc(u.location) : ""}</div>
        </div>
        <span style="font-size:.72rem;color:var(--accent,#7a8f52);font-weight:600;">${(u.points || 0).toLocaleString()} pts</span>
      </div>`,
      )
      .join("");
  }

  if (posts.length) {
    html += `<div class="sdrop-label">📝 Posts</div>`;
    html += posts
      .map(
        (p) => `
      <div class="sdrop-row" onclick="window.location.href='post-detail.html?id=${escAttr(p.id)}'; hideSearchDrop()">
        <div style="width:32px;height:32px;border-radius:8px;background:${TYPE_COLOR[p.type] || "#7a8f52"}22;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">${TYPE_ICON[p.type] || "📝"}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:.86rem;color:#2c2822;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.title)}</div>
          <div style="font-size:.74rem;color:#9a9690;">${esc(p.author?.name || "")} · ${timeAgo(p.createdAt)} · ${p.replyCount} repl${p.replyCount === 1 ? "y" : "ies"}</div>
        </div>
        ${p.status === "resolved" ? `<span style="font-size:.68rem;background:#e5ecda;color:#6b7a50;padding:2px 8px;border-radius:12px;font-weight:600;">✓</span>` : ""}
      </div>`,
      )
      .join("");
  }

  if (challenges.length) {
    html += `<div class="sdrop-label">🏆 Challenges</div>`;
    html += challenges
      .map(
        (c) => `
      <div class="sdrop-row" onclick="hideSearchDrop()">
        <div style="width:32px;height:32px;border-radius:8px;background:rgba(122,143,82,.12);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">${c.icon || "🎯"}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:.86rem;color:#2c2822;">${esc(c.title)}</div>
          <div style="font-size:.74rem;color:#9a9690;">${c.participantCount} joined${c.endsAt ? " · ends " + timeAgo(c.endsAt) : ""}</div>
        </div>
      </div>`,
      )
      .join("");
  }

  if (badges.length) {
    html += `<div class="sdrop-label">🏅 Badges</div>`;
    html += badges
      .map(
        (b) => `
      <div class="sdrop-row" onclick="hideSearchDrop()">
        <div style="width:32px;height:32px;border-radius:8px;background:rgba(176,120,32,.1);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">${b.emoji}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:.86rem;color:#2c2822;">${esc(b.name)}</div>
          <div style="font-size:.74rem;color:#9a9690;">${b.holderCount} holder${b.holderCount !== 1 ? "s" : ""} · ${esc((b.description || "").slice(0, 50))}</div>
        </div>
      </div>`,
      )
      .join("");
  }

  html += `
    <div style="padding:10px 14px;border-top:1px solid #f0ece5;text-align:center;">
      <span style="font-size:.78rem;color:var(--accent,#7a8f52);font-weight:600;cursor:pointer;"
            onclick="hideSearchDrop()">
        ${total} result${total !== 1 ? "s" : ""} — see posts below ↓
      </span>
    </div>`;

  drop.innerHTML = html;
  drop.style.display = "block";
  _dropVisible = true;
}

// Inject shared styles once
(function _injectStyles() {
  const s = document.createElement("style");
  s.textContent = `
    .sdrop-label {
      font-size:.7rem; font-weight:700; text-transform:uppercase;
      letter-spacing:.06em; color:#9a9690; padding:10px 14px 4px;
    }
    .sdrop-row {
      display:flex; align-items:center; gap:10px;
      padding:8px 14px; cursor:pointer; transition:background .15s;
    }
    .sdrop-row:hover { background:rgba(122,143,82,.07); }
    #search-drop::-webkit-scrollbar { width:4px; }
    #search-drop::-webkit-scrollbar-thumb { background:rgba(122,143,82,.3); border-radius:4px; }

    /* Search type pills */
    .stype-row { display:flex; gap:6px; flex-wrap:wrap; margin-top:12px; }
    .stype-pill {
      padding:5px 14px; border-radius:20px;
      border:1.5px solid rgba(255,255,255,.3);
      background:rgba(255,255,255,.12); color:rgba(255,255,255,.85);
      font-size:.78rem; font-weight:600; cursor:pointer;
      transition:all .18s; font-family:inherit;
    }
    .stype-pill:hover { background:rgba(255,255,255,.22); }
    .stype-pill.active { background:rgba(255,255,255,.92); color:#7a8f52; border-color:transparent; }

    /* Clear button */
    .search-clear-btn {
      background:none; border:none; cursor:pointer;
      color:rgba(255,255,255,.6); padding:0 6px;
      display:flex; align-items:center; flex-shrink:0; transition:color .15s;
    }
    .search-clear-btn:hover { color:rgba(255,255,255,.95); }

    /* Region disabled item */
    .loc-disabled { opacity:.5; cursor:default; pointer-events:none; }

    /* Pending friend request button */
    .follow-btn.pending {
      background:rgba(122,143,82,.15);
      color:var(--accent);
      border:1.5px solid rgba(122,143,82,.3);
      cursor:pointer;
    }
    .follow-btn.pending:hover {
      background:rgba(200,72,48,.08);
      color:#c0392b;
      border-color:rgba(200,72,48,.25);
    }

    /* Accept + Decline pair wrapper on crafter cards */
    .crafter-freq-btns {
      display:flex; gap:6px; margin-top:10px;
    }
    .crafter-freq-btns .follow-btn { flex:1; margin-top:0; }
    .crafter-freq-btns .freq-decline {
      background:none; border:1.5px solid #e0b0a8; color:#c0392b;
    }
    .crafter-freq-btns .freq-decline:hover { background:rgba(200,72,48,.08); }
  `;
  document.head.appendChild(s);
})();

/* ═══════════════════════════════════════════════════
   INTERACTIONS
═══════════════════════════════════════════════════ */
function setFilter(filter) {
  _state.filter = filter;
  _state.page = 1;
  renderCats();
  loadAndRenderPosts();
}

function setSort(el, sort) {
  _state.sort = sort;
  _state.page = 1;
  document
    .querySelectorAll(".sort-btn")
    .forEach((b) => b.classList.remove("active"));
  el.classList.add("active");
  loadAndRenderPosts();
}

function setSearchTerm(term) {
  const el = document.getElementById("global-search");
  if (el) el.value = term;
  const clearBtn = document.getElementById("search-clear");
  if (clearBtn) clearBtn.style.display = "flex";
  _state.search = term;
  _state.page = 1;
  hideSearchDrop();
  loadAndRenderPosts();
}

function loadMore() {
  if (!_state.hasMore) return;
  _state.page += 1;
  loadAndRenderPosts(true);
}

function pickRegion(el, key) {
  _state.region = key;
  _state.page = 1;
  document
    .querySelectorAll(".loc-item")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  loadAndRenderPosts();
}

/* ── Bookmark ─────────────────────────────────────── */
async function toggleBookmark(postId, btn) {
  const id = String(postId);
  const svg = btn.querySelector("svg");
  const was = _state.bookmarks.has(id);
  if (was) {
    _state.bookmarks.delete(id);
    btn.classList.remove("bookmarked");
    svg.removeAttribute("style");
  } else {
    _state.bookmarks.add(id);
    btn.classList.add("bookmarked");
    svg.style.cssText = "fill:var(--accent);stroke:var(--accent)";
  }
  try {
    await api(`/posts/${id}/save`, { method: "PATCH" });
  } catch {
    if (was) {
      _state.bookmarks.add(id);
      btn.classList.add("bookmarked");
      svg.style.cssText = "fill:var(--accent);stroke:var(--accent)";
    } else {
      _state.bookmarks.delete(id);
      btn.classList.remove("bookmarked");
      svg.removeAttribute("style");
    }
  }
}

/* ── Reply ────────────────────────────────────────── */
async function sendReply(event, postId, input) {
  if (event.key !== "Enter" || !input.value.trim()) return;
  const body = input.value.trim();
  input.value = "";
  input.disabled = true;
  try {
    await api(`/posts/${postId}/replies`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    input.placeholder = "✓ Reply sent!";
    const card = document.getElementById(`post-${postId}`);
    const stat = card?.querySelector(".engage-stat");
    if (stat) {
      const n = (parseInt(stat.textContent) || 0) + 1;
      stat.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> ${n} response${n !== 1 ? "s" : ""}`;
    }
    setTimeout(() => {
      input.placeholder = "Offer support…";
      input.disabled = false;
    }, 1500);
  } catch {
    input.placeholder = "❌ Failed — try again";
    input.disabled = false;
  }
}

function focusReply(postId) {
  document.querySelector(`#post-${postId} .ec-msg-input`)?.focus();
}

function sharePost(postId) {
  const url = `${window.location.origin}/pages/post-detail.html?id=${postId}`;
  navigator.clipboard?.writeText(url).catch(() => {});
}

/* ═══════════════════════════════════════════════════
   NAV HELPERS
═══════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Sidebar: pre-fill from localStorage; loadProfile() will refresh after API
  initSidebar();
  // Close search dropdown on outside click
  document.addEventListener("click", (e) => {
    if (_dropVisible && !e.target.closest(".search-bar-wrap")) hideSearchDrop();
  });

  // Search type pills
  document.querySelectorAll(".stype-pill").forEach((p) => {
    p.addEventListener("click", () => setSearchType(p.dataset.type, p));
  });

  // Pre-fill search from URL ?search= param
  const urlSearch = new URLSearchParams(window.location.search).get("search");
  if (urlSearch) {
    const el = document.getElementById("global-search");
    if (el) el.value = urlSearch;
    const clearBtn = document.getElementById("search-clear");
    if (clearBtn) clearBtn.style.display = "flex";
    _state.search = urlSearch;
  }

  renderCats();

  Promise.all([
    loadAndRenderCrafters(),
    loadAndRenderTrends(),
    loadAndRenderActive(),
    loadAndRenderLeaderboard(),
    loadAndRenderRegions(),
  ]);

  loadAndRenderPosts();
});
