// Frontend/js/explore.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Drives the entire Explore page. Replaces the hardcoded data arrays with
//   real fetch() calls to the backend. Manages filter/sort/search/pagination
//   state and re-renders on every change.
//
//   Endpoints used:
//     GET  /api/explore/posts        → main post feed
//     GET  /api/explore/crafters     → featured crafters strip
//     GET  /api/explore/trends       → trending topics grid
//     GET  /api/explore/active       → active help needed panel
//     GET  /api/explore/leaderboard  → top helpers panel
//     PATCH /api/posts/:id/save      → bookmark toggle (existing postRoutes)
//     PATCH /api/dashboard/follow/:id→ follow toggle  (existing dashboardRoutes)
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:5000/api";

/* ═══════════════════════════════════════════════════════════
   AUTH — grab token and current user from localStorage
═══════════════════════════════════════════════════════════ */
const token = localStorage.getItem("token");
const _user = JSON.parse(localStorage.getItem("user") || "{}");

// Redirect to login if not authenticated
if (!token) window.location.href = "pages/login.html";

// Shared fetch helper — attaches JWT and handles JSON parsing
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let _state = {
  filter: "all",
  sort: "recent",
  search: "",
  page: 1,
  hasMore: false,
  bookmarks: new Set(), // Set of post id strings
  following: new Set(), // Set of user id strings
};

/* ═══════════════════════════════════════════════════════════
   STATIC DATA — categories & locations stay client-side
   (they don't change and don't need a database round-trip)
═══════════════════════════════════════════════════════════ */
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

const LOCATIONS = [
  { name: "All Regions", count: null, active: true },
  { name: "South West", count: null },
  { name: "Scotland", count: null },
  { name: "North West", count: null },
  { name: "Yorkshire", count: null },
  { name: "London", count: null },
  { name: "Midlands", count: null },
];

/* ═══════════════════════════════════════════════════════════
   UTILITY HELPERS
═══════════════════════════════════════════════════════════ */

// Generate avatar initials from a name or handle
function initials(name = "", handle = "") {
  const src = name || handle || "?";
  return src.replace("@", "").slice(0, 2).toUpperCase();
}

// Turn a Mongoose type code into a readable category label
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

// Format timestamp — very recent posts get a relative label
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} minute${m !== 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

// Severity badge for SOS posts — derived from replyCount + time since posting
function severityLabel(post) {
  if (post.type !== "sos" || post.status === "resolved") return null;
  const hoursOld = (Date.now() - new Date(post.createdAt)) / 3600000;
  if (hoursOld < 2 && post.replyCount < 3) return "High";
  if (hoursOld < 12) return "Medium";
  return "Low";
}

/* ═══════════════════════════════════════════════════════════
   BOOTSTRAP — populate user avatar in topbar
═══════════════════════════════════════════════════════════ */
function populateUserAvatar() {
  const btn = document.querySelector(".profile-av-btn");
  if (!btn) return;
  if (_user.avatar) {
    btn.style.backgroundImage = `url(${_user.avatar})`;
    btn.style.backgroundSize = "cover";
  } else {
    btn.textContent = initials(_user.name, _user.handle);
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
  }
  // Sidebar profile
  const sbName = document.querySelector(".sb-prof-name");
  const sbSub = document.querySelector(".sb-prof-sub");
  const sbAv = document.querySelector(".sb-prof-av");
  if (sbName) sbName.textContent = _user.name || "You";
  if (sbSub) sbSub.textContent = _user.handle || "";
  if (sbAv) {
    if (_user.avatar) {
      sbAv.style.backgroundImage = `url(${_user.avatar})`;
      sbAv.style.backgroundSize = "cover";
    } else sbAv.textContent = initials(_user.name, _user.handle);
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — CATEGORY PILLS (static)
═══════════════════════════════════════════════════════════ */
function renderCats() {
  document.getElementById("cat-row").innerHTML = CATEGORIES.map(
    (c) => `
    <div class="cat-pill ${c.filter === _state.filter ? "active" : ""}"
         onclick="setFilter('${c.filter}')">
      <span class="cp-dot" style="background:${c.dot}"></span>${c.label}
    </div>`,
  ).join("");
}

/* ═══════════════════════════════════════════════════════════
   RENDER — FEATURED CRAFTERS  (from API)
═══════════════════════════════════════════════════════════ */
async function loadAndRenderCrafters() {
  const strip = document.getElementById("crafters-strip");
  strip.innerHTML =
    `<div class="loading-shimmer" style="height:180px;border-radius:16px;"></div>`.repeat(
      3,
    );

  try {
    const { crafters } = await api("/explore/crafters");

    // Merge isFollowed from API with local _state.following Set
    crafters.forEach((c) => {
      if (c.isFollowed) _state.following.add(c.id.toString());
    });

    strip.innerHTML = crafters
      .map((c) => {
        const followed = _state.following.has(c.id.toString());
        const av = c.avatar
          ? `<div class="crafter-av" style="background-image:url(${c.avatar});background-size:cover;"></div>`
          : `<div class="crafter-av" style="background:${randomColor(c.id)}">${initials(c.name, c.handle)}</div>`;
        return `
      <div class="crafter-card">
        <div class="crafter-banner" style="background:linear-gradient(135deg,${randomColor(c.id)}aa,${randomColor(c.id)})">
          ${av}
        </div>
        <div class="crafter-body">
          <div class="crafter-name">${c.name}</div>
          <div class="crafter-handle">${c.handle}</div>
          <div class="crafter-tags">${(c.tags || []).map((t) => `<span class="crafter-tag">${t}</span>`).join("")}</div>
          <div class="crafter-stats">
            <div class="crafter-stat"><strong>${c.followers}</strong>followers</div>
            <div class="crafter-stat"><strong>${c.points?.toLocaleString()}</strong>pts</div>
          </div>
          <button class="follow-btn ${followed ? "following" : ""}"
                  data-id="${c.id}"
                  onclick="toggleFollow(this)">
            ${followed ? "✓ Following" : "+ Follow"}
          </button>
        </div>
      </div>`;
      })
      .join("");
  } catch (err) {
    strip.innerHTML = `<p style="color:var(--text-light);font-size:.83rem;">Could not load crafters.</p>`;
    console.error("[loadCrafters]", err);
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — TRENDING TOPICS  (from API)
═══════════════════════════════════════════════════════════ */
async function loadAndRenderTrends() {
  const grid = document.getElementById("trends-grid");
  grid.innerHTML =
    `<div class="loading-shimmer" style="height:52px;border-radius:12px;"></div>`.repeat(
      6,
    );

  try {
    const { trends } = await api("/explore/trends");

    // Fallback to static topics if DB has no posts yet
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
      <div class="trend-chip" onclick="setSearchTerm('${t.name}')">
        <span class="trend-icon">${t.emoji}</span>
        <div class="trend-text">
          <div class="trend-name">${t.name}</div>
          <div class="trend-count">${t.label}</div>
        </div>
      </div>`,
      )
      .join("");
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--text-light);font-size:.83rem;">Could not load trends.</p>`;
    console.error("[loadTrends]", err);
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — POSTS  (from API, paginated)
═══════════════════════════════════════════════════════════ */
async function loadAndRenderPosts(append = false) {
  const grid = document.getElementById("posts-grid");
  const moreBtn = document.getElementById("load-more-wrap");

  if (!append) {
    // Fresh load — show shimmer placeholders
    grid.innerHTML =
      `<div class="loading-shimmer" style="height:220px;border-radius:18px;"></div>`.repeat(
        3,
      );
    moreBtn.style.display = "none";
  }

  try {
    const params = new URLSearchParams({
      filter: _state.filter,
      sort: _state.sort,
      search: _state.search,
      page: _state.page,
      limit: 5,
    });

    const { posts, hasMore, total } = await api(`/explore/posts?${params}`);

    // Sync bookmark state from API response
    posts.forEach((p) => {
      if (p.isSaved) _state.bookmarks.add(p.id.toString());
    });

    _state.hasMore = hasMore;

    const html = posts
      .map((p) => {
        const sev = severityLabel(p);
        const sevCls =
          sev === "High" ? "b-high" : sev === "Medium" ? "b-med" : "b-low";
        const bkmk = _state.bookmarks.has(p.id.toString());
        const avName = p.author?.name || "?";
        const avHtml = p.author?.avatar
          ? `<div class="ec-av" style="background-image:url(${p.author.avatar});background-size:cover;"></div>`
          : `<div class="ec-av" style="background:${randomColor(p.id)}">${initials(avName)}</div>`;

        return `
      <div class="explore-card" id="post-${p.id}">
        <div class="ec-header">
          ${avHtml}
          <div class="ec-meta">
            <div class="ec-name">${avName}</div>
            <div class="ec-time">${timeAgo(p.createdAt)}</div>
            <div class="ec-badges">
              ${sev ? `<span class="badge ${sevCls}">${sev}</span>` : ""}
              ${p.status === "resolved" ? `<span class="badge b-resolved">✓ Resolved</span>` : ""}
              <span class="badge b-cat">${typeLabel(p.type)}</span>
            </div>
          </div>
        </div>
        <div class="ec-body">
          <div class="ec-title">${p.title}</div>
          <div class="ec-para">${p.body.slice(0, 200)}${p.body.length > 200 ? "…" : ""}</div>
          ${
            p.tags?.length
              ? `<div class="ec-tags">${p.tags
                  .slice(0, 4)
                  .map((t) => `<span class="ec-tag">#${t}</span>`)
                  .join("")}</div>`
              : ""
          }
        </div>
        <div class="ec-footer">
          <div class="ec-foot-av">${initials(avName).slice(0, 1)}</div>
          <input class="ec-msg-input" type="text" placeholder="Offer support…"
                 onkeydown="sendReply(event,'${p.id}',this)" />
          <div class="ec-actions">
            <button class="icon-btn" title="Share" onclick="sharePost('${p.id}')">
              <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            <button class="icon-btn" title="Comment" onclick="focusReply('${p.id}')">
              <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </button>
            <button class="icon-btn ${bkmk ? "bookmarked" : ""}" title="Bookmark"
                    data-id="${p.id}" onclick="toggleBookmark('${p.id}',this)">
              <svg viewBox="0 0 24 24" ${bkmk ? 'style="fill:var(--accent);stroke:var(--accent)"' : ""}>
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="ec-engage">
          <span class="engage-stat">
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            ${p.replyCount} response${p.replyCount !== 1 ? "s" : ""}
          </span>
          <span class="engage-stat">
            <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
            ${p.saveCount} saved
          </span>
        </div>
      </div>`;
      })
      .join("");

    if (append) {
      // Remove shimmer if any, then append
      grid.querySelectorAll(".loading-shimmer").forEach((el) => el.remove());
      grid.insertAdjacentHTML("beforeend", html);
    } else {
      grid.innerHTML =
        html ||
        `<div style="text-align:center;padding:40px 20px;color:var(--text-light);font-size:.88rem;background:var(--card);border-radius:18px;">No posts found for this filter.</div>`;
    }

    moreBtn.style.display = hasMore ? "block" : "none";

    // Update section title
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
    document.getElementById("posts-section-title").textContent =
      titleMap[_state.filter] ?? "All Posts";
  } catch (err) {
    grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-light);">Could not load posts. Please try again.</div>`;
    console.error("[loadPosts]", err);
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — ACTIVE REQUESTS  (sidebar panel, from API)
═══════════════════════════════════════════════════════════ */
async function loadAndRenderActive() {
  const el = document.getElementById("live-list");
  try {
    const { requests } = await api("/explore/active");
    el.innerHTML =
      requests
        .map(
          (r) => `
      <div class="live-item">
        <div class="live-av" style="background:${randomColor(r.id)}">${initials(r.author.name)}</div>
        <div class="live-body">
          <div class="live-name">${r.author.name}</div>
          <div class="live-preview">${r.preview}</div>
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

/* ═══════════════════════════════════════════════════════════
   RENDER — LEADERBOARD  (sidebar panel, from API)
═══════════════════════════════════════════════════════════ */
async function loadAndRenderLeaderboard() {
  const el = document.getElementById("leaderboard");
  try {
    const { leaderboard } = await api("/explore/leaderboard");
    el.innerHTML = leaderboard
      .map(
        (l) => `
      <div class="leader-item">
        <div class="leader-rank ${l.rankClass}">${l.rank}</div>
        <div class="leader-av" style="background:${randomColor(l.id)}">${initials(l.name, l.handle)}</div>
        <div class="leader-info">
          <div class="leader-name">${l.name}</div>
          <div class="leader-pts">${l.points?.toLocaleString() ?? 0} pts</div>
        </div>
        <span class="leader-badge-icon">${l.badge}</span>
      </div>`,
      )
      .join("");
  } catch (err) {
    el.innerHTML = `<p style="color:var(--text-light);font-size:.82rem;padding:8px 0">Could not load leaderboard.</p>`;
    console.error("[loadLeaderboard]", err);
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — LOCATIONS  (static)
═══════════════════════════════════════════════════════════ */
function renderLocations() {
  document.getElementById("location-list").innerHTML = LOCATIONS.map(
    (l) => `
    <div class="loc-item ${l.active ? "active" : ""}" onclick="pickLocation(this)">
      <div class="loc-left"><span class="loc-dot"></span>${l.name}</div>
      ${l.count != null ? `<span class="loc-count">${l.count}</span>` : ""}
    </div>`,
  ).join("");
}

/* ═══════════════════════════════════════════════════════════
   INTERACTIONS
═══════════════════════════════════════════════════════════ */

// Category pill click
function setFilter(filter) {
  _state.filter = filter;
  _state.page = 1;
  renderCats();
  loadAndRenderPosts();
}

// Search input — debounced 400ms
let _searchTimer;
function onSearch() {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    _state.search = document.getElementById("global-search").value;
    _state.page = 1;
    loadAndRenderPosts();
  }, 400);
}

// Clicking a trending topic sets it as search term
function setSearchTerm(term) {
  const el = document.getElementById("global-search");
  el.value = term;
  _state.search = term;
  _state.page = 1;
  loadAndRenderPosts();
}

// Sort buttons
function setSort(el, sort) {
  _state.sort = sort;
  _state.page = 1;
  document
    .querySelectorAll(".sort-btn")
    .forEach((b) => b.classList.remove("active"));
  el.classList.add("active");
  loadAndRenderPosts();
}

// Load more button
function loadMore() {
  if (!_state.hasMore) return;
  _state.page += 1;
  loadAndRenderPosts(true); // append=true
}

// ── Bookmark toggle ───────────────────────────────────────
// Calls PATCH /api/posts/:id/save (existing postRoutes)
async function toggleBookmark(postId, btn) {
  const id = postId.toString();
  const svg = btn.querySelector("svg");

  // Optimistic UI — flip immediately
  const wasBookmarked = _state.bookmarks.has(id);
  if (wasBookmarked) {
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
  } catch (err) {
    // Revert on failure
    if (wasBookmarked) {
      _state.bookmarks.add(id);
      btn.classList.add("bookmarked");
      svg.style.cssText = "fill:var(--accent);stroke:var(--accent)";
    } else {
      _state.bookmarks.delete(id);
      btn.classList.remove("bookmarked");
      svg.removeAttribute("style");
    }
    console.error("[toggleBookmark]", err);
  }
}

// ── Follow toggle ─────────────────────────────────────────
// Calls PATCH /api/dashboard/follow/:id (existing dashboardRoutes)
async function toggleFollow(btn) {
  const userId = btn.dataset.id;
  const isFollowing = _state.following.has(userId);

  // Optimistic UI
  if (isFollowing) {
    _state.following.delete(userId);
    btn.classList.remove("following");
    btn.textContent = "+ Follow";
  } else {
    _state.following.add(userId);
    btn.classList.add("following");
    btn.textContent = "✓ Following";
  }

  try {
    await api(`/dashboard/follow/${userId}`, { method: "PATCH" });
  } catch (err) {
    // Revert
    if (isFollowing) {
      _state.following.add(userId);
      btn.classList.add("following");
      btn.textContent = "✓ Following";
    } else {
      _state.following.delete(userId);
      btn.classList.remove("following");
      btn.textContent = "+ Follow";
    }
    console.error("[toggleFollow]", err);
  }
}

// ── Reply input — press Enter to send ────────────────────
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
    // Briefly flash green to confirm
    input.placeholder = "✓ Reply sent!";
    setTimeout(() => {
      input.placeholder = "Offer support…";
      input.disabled = false;
    }, 1500);

    // Increment the reply count in the UI without re-fetching
    const card = document.getElementById(`post-${postId}`);
    if (card) {
      const stat = card.querySelector(".engage-stat");
      if (stat) {
        const num = parseInt(stat.textContent) + 1;
        stat.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> ${num} response${num !== 1 ? "s" : ""}`;
      }
    }
  } catch (err) {
    input.placeholder = "❌ Failed — try again";
    input.disabled = false;
    console.error("[sendReply]", err);
  }
}

// Focus the reply input for this post
function focusReply(postId) {
  const input = document.querySelector(`#post-${postId} .ec-msg-input`);
  if (input) input.focus();
}

// Copy post link to clipboard
function sharePost(postId) {
  const url = `${window.location.origin}/post/${postId}`;
  navigator.clipboard?.writeText(url).catch(() => {});
}

function pickLocation(el) {
  document
    .querySelectorAll(".loc-item")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  // TODO: re-filter posts by location once User has a location field indexed on Post
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */
function syncNav(el) {
  const label = el.textContent.trim();
  document
    .querySelectorAll(".tnav, .snav")
    .forEach((l) =>
      l.classList.toggle("active", l.textContent.trim() === label),
    );
}

function pickNav(el) {
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  el.classList.add("active");
  if (window.innerWidth <= 520) closeSidebar();
}

function toggleSidebar() {
  const open = document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("on", open);
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("on");
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 520) closeSidebar();
});

/* ═══════════════════════════════════════════════════════════
   COLOR HELPER — deterministic pastel from id string
═══════════════════════════════════════════════════════════ */
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
  let hash = 0;
  for (const ch of id.toString())
    hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffff;
  return _COLORS[hash % _COLORS.length];
}

/* ═══════════════════════════════════════════════════════════
   INIT — wire up search input and boot all panels
═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Wire search input
  const searchEl = document.getElementById("global-search");
  if (searchEl) searchEl.addEventListener("input", onSearch);

  // Wire Distress Call button → create-post page
  const distressBtn = document.querySelector(".distress-btn");
  if (distressBtn)
    distressBtn.onclick = () =>
      (window.location.href = "pages/create-post.html");

  // Populate current user data in UI
  populateUserAvatar();

  // Static renders (no API needed)
  renderCats();
  renderLocations();

  // API-driven renders (parallel where possible)
  Promise.all([
    loadAndRenderCrafters(),
    loadAndRenderTrends(),
    loadAndRenderActive(),
    loadAndRenderLeaderboard(),
  ]);

  // Posts last (most important, gets full attention)
  loadAndRenderPosts();
});
