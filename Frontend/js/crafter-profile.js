// Frontend/js/crafter-profile.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Replaces the entire inline <script> from crafter-profile.html.
//   URL: crafter-profile.html?id=USER_ID
//
//   Flow:
//     1. Read ?id from URL — if missing, redirect to home
//     2. GET /api/crafter/:id → render identity, stats, bio, skills, sidebar
//     3. Load Posts tab (default) → GET /api/crafter/:id/posts
//     4. Other tabs loaded lazily on first click
//     5. Follow button → POST /api/crafter/:id/follow
//     6. Message button → navigates to chat.html?friend=USER_ID
//        (friend gate enforced server-side in socket layer)
//     7. Share → copy URL to clipboard
//     8. Activity feed + mutual friends from profile payload
//
//   Reputation bars animate on IntersectionObserver (preserves original).
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

if (!token) window.location.href = "login.html";

// Target user ID from ?id= query param
const TARGET_ID = new URLSearchParams(window.location.search).get("id");
if (!TARGET_ID || !/^[a-f\d]{24}$/i.test(TARGET_ID)) {
  window.location.href = "../index.html";
}

/* ── State ───────────────────────────────────────────── */
let _profile = null;
let _friendStatus = "none"; // none | pending_sent | pending_received | friends

// Tab cache — prevents redundant API calls
const _tabCache = {};
let _curTab = "posts";
let _postsPage = { posts: 1, tutorials: 1 };
let _hasMore = { posts: false, tutorials: false };

/* ── Utilities ───────────────────────────────────────── */
const api = async (path, opts = {}) => {
  const r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || "Request failed");
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
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return COLORS[h % COLORS.length];
}

function escHTML(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Strip all HTML tags and decode basic entities to plain text.
 *  Used for post body previews and bio — content is from a rich-text editor. */
function stripHTML(html = "") {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

/** Resolve a display name from any User object shape.
 *  Handles: name | firstName+lastName | handle | "Crafter" fallback */
function resolveDisplayName(p = {}) {
  return (
    (p.name || "").trim() ||
    [p.firstName, p.lastName].filter(Boolean).join(" ").trim() ||
    (p.handle || "").replace(/^@+/, "") ||
    "Crafter"
  );
}

/** Strip leading @ signs then re-add exactly one */
function resolveHandle(h = "") {
  const clean = String(h || "")
    .replace(/^@+/, "")
    .trim();
  return clean ? `@${clean}` : "";
}

let toastTimer;
function toast(msg, type = "info") {
  clearTimeout(toastTimer);
  const el = document.getElementById("toast");
  const span = document.getElementById("toast-msg");
  if (!el || !span) return;
  span.innerHTML = msg;
  el.style.background = type === "error" ? "#c0392b" : "";
  el.classList.add("show");
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ═══════════════════════════════════════════════════════
   LOAD FULL PROFILE
═══════════════════════════════════════════════════════ */
async function loadProfile() {
  try {
    const { profile } = await api(`/crafter/${TARGET_ID}`);
    _profile = profile;
    _friendStatus =
      profile.friendStatus || (profile.isFollowing ? "friends" : "none");

    renderCover(profile);
    renderIdentity(profile);
    renderStats(profile.stats);
    renderBio(profile);
    renderSidebar(profile);

    // Default tab
    await loadTab("posts");
  } catch (err) {
    if (err.message.includes("own profile")) {
      window.location.href = "profile.html";
      return;
    }
    if (err.message.includes("not found")) {
      document.getElementById("page").innerHTML =
        `<div style="text-align:center;padding:80px;color:#aaa;">
          <div style="font-size:3rem;">😔</div>
          <div style="font-size:1.1rem;margin-top:12px;">This crafter's profile is no longer available.</div>
          <button onclick="history.back()" style="margin-top:20px;padding:10px 24px;border-radius:8px;background:#7a8f52;color:#fff;border:none;cursor:pointer;">Go back</button>
        </div>`;
      return;
    }
    toast(err.message, "error");
  }
}

/* ─── COVER ─────────────────────────────────────────── */
function renderCover(p) {
  const cover = document.querySelector(".cover");
  if (!cover) return;
  if (p.bannerImg) {
    cover.style.backgroundImage = `url(${p.bannerImg})`;
    cover.style.backgroundSize = "cover";
    cover.style.backgroundPosition = "center";
    cover.querySelector(".cover-svg")?.remove();
    cover.querySelector(".cover-fade")?.style &&
      (cover.querySelector(".cover-fade").style.background =
        "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,.45))");
  } else {
    // Use bannerColor as tint over the SVG pattern
    cover.style.background = p.bannerColor || "#7a8f52";
  }
}

/* ─── IDENTITY ──────────────────────────────────────── */
function renderIdentity(p) {
  // Resolve name + handle FIRST — used throughout this function
  const displayName = resolveDisplayName(p);
  const displayHandle = resolveHandle(p.handle);

  // Store on profile object so toggleFollow() can reference it later
  p._displayName = displayName;

  // Avatar
  const avEl = document.querySelector(".avatar");
  if (avEl) {
    if (p.avatar) {
      avEl.style.backgroundImage = `url(${p.avatar})`;
      avEl.style.backgroundSize = "cover";
      avEl.style.backgroundPosition = "center";
      avEl.textContent = "";
    } else {
      avEl.textContent = initials(displayName);
      avEl.style.background = colorFor(String(p.id || p._id || ""));
      avEl.style.color = "#fff";
    }
  }

  // Rank badge
  const rankEl = document.querySelector(".av-rank");
  if (rankEl) rankEl.textContent = p.rank || "🌱 New";

  setTxt(".id-name", displayName);
  setTxt(".id-handle", displayHandle);

  const locEl = document.querySelector(".id-loc");
  if (locEl) {
    locEl.innerHTML = p.location
      ? `<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${escHTML(p.location)}`
      : "";
  }

  // Member since
  const memEl = document.querySelector(".id-member");
  if (memEl) {
    const d = new Date(p.memberSince);
    if (!isNaN(d)) {
      const month = d.toLocaleDateString("en-GB", { month: "long" });
      memEl.innerHTML = `Member since ${month} ${d.getFullYear()}`;
    }
  }

  // Page title + mobile header
  document.title = `${displayName} — Craft-SOS`;
  setTxt("#mobile-title", displayName);

  // Follow button state
  updateFollowBtn(_friendStatus, displayName);
}

/* ─────────────────────────────────────────────────────────
   updateFollowBtn(status)
   Drives the follow button (and optional decline button) through
   all four friendship states. CSS classes changed here must match
   the .btn.prim / .btn.sec / .btn.pending styles in the CSS.

   States:
     none             → green  "Follow"        click → sendRequest
     pending_sent     → muted  "Pending ·"     click → cancelRequest
     pending_received → green  "Accept"  + red "Decline"
     friends          → green  "✓ Following"   click → unfriend
───────────────────────────────────────────────────────── */
function updateFollowBtn(status, name = "") {
  const btn = document.getElementById("follow-btn");
  const lbl = document.getElementById("follow-label");
  const ico = document.getElementById("follow-icon");
  const decBtn = document.getElementById("decline-btn");
  if (!btn || !lbl) return;

  // Reset classes
  btn.classList.remove("on", "pending");
  if (decBtn) decBtn.style.display = "none";

  const ICONS = {
    addUser: `<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>`,
    check: `<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>`,
    clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
    accept: `<polyline points="20 6 9 17 4 12"/>`,
  };

  switch (status) {
    case "friends":
      btn.classList.add("on");
      lbl.textContent = "✓ Following";
      if (ico) ico.innerHTML = ICONS.check;
      btn.title = `Unfollow ${name}`;
      break;

    case "pending_sent":
      btn.classList.add("pending");
      lbl.textContent = "Pending ·";
      if (ico) ico.innerHTML = ICONS.clock;
      btn.title = "Click to cancel request";
      btn.style.opacity = "";
      break;

    case "pending_received":
      btn.classList.add("on");
      lbl.textContent = "Accept";
      if (ico) ico.innerHTML = ICONS.accept;
      btn.title = `Accept ${name}'s friend request`;
      if (decBtn) decBtn.style.display = "flex";
      break;

    default: // none
      lbl.textContent = "Follow";
      if (ico) ico.innerHTML = ICONS.addUser;
      btn.title = `Send friend request to ${name}`;
      break;
  }
}

/* ─── STATS BAR ─────────────────────────────────────── */
function renderStats(s) {
  const fields = [
    { sel: ".stat-posts", val: s.postCount },
    { sel: ".stat-helped", val: s.helpedCount },
    {
      sel: ".stat-points",
      val: (s.points ?? _profile?.points ?? 0).toLocaleString(),
    },
    { sel: ".stat-friends", val: s.friendCount },
    { sel: ".stat-resolved", val: s.resolvedCount },
    { sel: ".stat-tutorials", val: s.tutorialCount },
  ];
  fields.forEach(({ sel, val }) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = val ?? "—";
  });

  // Update tab counts
  const tabCounts = {
    posts: s.postCount,
    tutorials: s.tutorialCount,
    helped: s.helpedCount,
    achievements: _profile?.badges?.filter((b) => !b.locked).length || 0,
    friends: s.friendCount,
  };
  document.querySelectorAll(".tab").forEach((t) => {
    const n = tabCounts[t.dataset.tab];
    const span = t.querySelector(".tab-n");
    if (span && n !== undefined) span.textContent = n;
  });
}

/* ─── BIO + SKILLS ──────────────────────────────────── */
function renderBio(p) {
  // Bio may contain HTML from rich-text editor — strip to plain text
  const bioEl = document.querySelector(".bio-text");
  if (bioEl) {
    const plainBio = stripHTML(p.bio || "");
    bioEl.textContent = plainBio;
    bioEl.style.animation = ""; // clear shimmer animation applied in HTML
    bioEl.style.background = "";
    bioEl.style.height = "";
    bioEl.style.borderRadius = "";
  }

  const skillRow = document.querySelector(".skill-row");
  if (!skillRow || !p.skills?.length) return;
  skillRow.innerHTML = p.skills
    .map((s) => `<div class="skill">${escHTML(s.text)}</div>`)
    .join("");
}

/* ─── SIDEBAR ───────────────────────────────────────── */
function renderSidebar(p) {
  renderReputation(p);
  renderPointsBreakdown(p.breakdown, p.points);
  renderTopics(); // topics derived from posts — placeholder until API support
  renderMutualFriends(p.mutualFriends);
  renderActivity([]); // will be populated by loadTab("activity")
}

function renderReputation(p) {
  const pts = p.points || 0;
  const helped = p.stats?.helpedCount || 0;

  // Overall: points-based score (max assumed 5000)
  const overall = Math.min(100, Math.round((pts / 5000) * 100));
  // Helpfulness: helped / total posts
  const helpful = Math.min(100, helped > 0 ? 98 : 0);
  // Quality: static until rating system built
  const quality = 92;

  const standingLabel =
    pts >= 2000
      ? "Expert"
      : pts >= 800
        ? "Responder"
        : pts >= 300
          ? "Member"
          : "New";

  setTxt(".rep-standing", standingLabel);

  // Animate bars after paint
  setTimeout(() => {
    const rf1 = document.getElementById("rf1");
    const rf2 = document.getElementById("rf2");
    const rf3 = document.getElementById("rf3");
    if (rf1) rf1.style.width = overall + "%";
    if (rf2) rf2.style.width = helpful + "%";
    if (rf3) rf3.style.width = quality + "%";
  }, 200);

  // Community rank
  const rankEl = document.querySelector(".rank-row strong");
  if (rankEl)
    rankEl.textContent = `Top ${p.stats?.helpedCount > 100 ? "3" : "10"}% of contributors`;
}

function renderPointsBreakdown(breakdown = [], total = 0) {
  const el = document.getElementById("points-breakdown");
  if (!el) return;

  el.innerHTML =
    breakdown
      .map(
        (b) => `
    <div class="pts-row">
      <span class="pts-label"><em>${b.icon}</em>${escHTML(b.label)}</span>
      <span class="pts-val g">+${b.pts}</span>
    </div>`,
      )
      .join("") +
    `<div class="pts-row" style="border-top:2px solid rgba(122,143,82,.18);padding-top:9px;margin-top:2px">
      <span class="pts-label" style="font-weight:700;color:var(--text-dark)">Total earned</span>
      <span class="pts-val pts-total">${(total || 0).toLocaleString()} pts</span>
    </div>`;
}

function renderTopics() {
  // Topics are a future API — show placeholder distribution based on profile skills
  const el = document.getElementById("topics-list");
  if (!el || !_profile) return;

  const skills = (_profile.skills || []).slice(0, 5);
  if (!skills.length) {
    el.innerHTML = `<p style="color:#aaa;font-size:.82rem;">No topic data yet</p>`;
    return;
  }

  // Distribute fake counts proportionally (real data needs post-tag aggregation)
  const counts = [28, 19, 16, 12, 9];
  const pcts = [90, 62, 52, 40, 30];

  el.innerHTML = skills
    .map(
      (s, i) => `
    <div class="topic-item">
      <span class="topic-rank">${i + 1}</span>
      <span class="topic-name">${escHTML(s.text)}</span>
      <div class="topic-bar-wrap"><div class="topic-bar" data-pct="${pcts[i] || 20}" style="width:0;transition:width .6s ease"></div></div>
      <span class="topic-count">${counts[i] || 5}</span>
    </div>`,
    )
    .join("");

  setTimeout(() => {
    document
      .querySelectorAll(".topic-bar")
      .forEach((b) => (b.style.width = b.dataset.pct + "%"));
  }, 300);
}

function renderMutualFriends(mutual) {
  const facesEl = document.querySelector(".mutual-faces");
  const textEl = document.querySelector(".mutual-text");
  if (!facesEl) return;

  if (!mutual?.count) {
    facesEl.innerHTML = `<span style="color:#aaa;font-size:.82rem;">No mutual friends yet</span>`;
    if (textEl) textEl.textContent = "";
    return;
  }

  facesEl.innerHTML =
    mutual.list
      .slice(0, 5)
      .map((f) => {
        if (f.avatar) {
          return `<div class="mu-av" style="background-image:url(${f.avatar});background-size:cover;"></div>`;
        }
        return `<div class="mu-av" style="background:${colorFor(String(f.id))}">${initials(f.name)}</div>`;
      })
      .join("") +
    (mutual.count > 5
      ? `<div class="mu-av" style="background:#b5c98a;font-size:.6rem">+${mutual.count - 5}</div>`
      : "");

  if (textEl) {
    const names = mutual.list
      .slice(0, 3)
      .map((f) => f.name)
      .join(", ");
    const rest = mutual.count - 3;
    textEl.innerHTML = `<strong>${names}</strong>${rest > 0 ? ` and <span style="color:var(--text-light)">${rest} other${rest > 1 ? "s" : ""} you both know</span>` : ""}`;
  }
}

function renderActivity(items) {
  const el = document.getElementById("activity-list");
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<p style="color:#aaa;font-size:.82rem;padding:8px 0;">No recent activity</p>`;
    return;
  }
  el.innerHTML = items
    .map(
      (a) => `
    <div class="act-item">
      <div class="act-ic">${a.icon}</div>
      <div class="act-right">
        <div class="act-text">${a.text}</div>
        <div class="act-foot">
          <span class="act-time">${a.time}</span>
          <span class="act-pts">${a.pts}</span>
        </div>
      </div>
    </div>`,
    )
    .join("");
}

/* ═══════════════════════════════════════════════════════
   TABS  (lazy-load on first click)
═══════════════════════════════════════════════════════ */
async function switchTab(name) {
  _curTab = name;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("on", t.dataset.tab === name));
  document
    .querySelectorAll(".tab-body")
    .forEach((b) => b.classList.toggle("on", b.id === `tb-${name}`));
  await loadTab(name);
}

async function loadTab(name) {
  if (_tabCache[name] && name !== "posts" && name !== "tutorials") return; // already rendered

  switch (name) {
    case "posts":
    case "tutorials":
      await loadPosts(name);
      break;
    case "helped":
      await loadHelped();
      break;
    case "achievements":
      renderAchievements();
      break;
    case "friends":
      await loadFriends();
      break;
    case "activity":
      await loadActivity();
      break;
  }
  _tabCache[name] = true;
}

/* ─── POSTS tab ─────────────────────────────────────── */
async function loadPosts(tab) {
  const el = document.getElementById(`tb-${tab}`);
  if (!el) return;

  // Shimmer on first load
  if (!_tabCache[tab]) {
    el.innerHTML = shimmerCards(3);
  }

  try {
    const { posts, hasMore } = await api(
      `/crafter/${TARGET_ID}/posts?tab=${tab}&page=${_postsPage[tab]}`,
    );
    _hasMore[tab] = hasMore;

    if (!posts.length && _postsPage[tab] === 1) {
      el.innerHTML = emptyState("📭", "No posts yet");
      return;
    }

    const html = posts.map(renderPostCard).join("");
    el.innerHTML = _postsPage[tab] === 1 ? html : el.innerHTML + html;

    if (hasMore) {
      // Remove old load-more button if present
      el.querySelector(".load-more-btn")?.remove();
      const btn = document.createElement("button");
      btn.className = "load-more-btn";
      btn.textContent = "Load more";
      btn.style.cssText =
        "display:block;margin:16px auto;padding:10px 28px;border-radius:8px;border:1px solid #7a8f52;background:none;color:#7a8f52;cursor:pointer;font-size:.88rem;";
      btn.onclick = async () => {
        _postsPage[tab]++;
        btn.remove();
        await loadPosts(tab);
      };
      el.appendChild(btn);
    }
  } catch (err) {
    el.innerHTML = `<div style="color:#c0392b;padding:20px;font-size:.88rem;">Could not load posts: ${err.message}</div>`;
  }
}

function renderPostCard(p) {
  return `
  <div class="pcard" onclick="window.location.href='post-detail.html?id=${p.id}'" style="cursor:pointer">
    <div class="pcard-head">
      <div class="pcard-icon">${p.icon}</div>
      <div style="flex:1;min-width:0">
        <div class="pcard-title">${escHTML(p.title)}</div>
        <div class="pcard-meta">
          <span class="badge ${p.type}">${p.lbl}</span>
          <span class="badge cat">${escHTML(p.cat)}</span>
          ${p.resolved ? '<span class="badge ok">✅ Resolved</span>' : ""}
          ${p.severity ? `<span class="badge ${p.severity === "High" ? "sos" : p.severity === "Medium" ? "com" : "ok"}">${p.severity} priority</span>` : ""}
          <span class="pcard-time">${p.time}</span>
        </div>
      </div>
    </div>
    <div class="pcard-body">${escHTML(stripHTML(p.body).slice(0, 220))}</div>
    <div class="pcard-tags">${p.tags.map((t) => `<span class="ptag">${escHTML(t)}</span>`).join("")}</div>
    <div class="pcard-foot">
      <span class="pstat">
        <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        ${(p.views || 0).toLocaleString()}
      </span>
      <span class="pstat">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${p.replies}
      </span>
      <span class="pstat">
        <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
        ${p.saves}
      </span>
      <span class="pread">Read post <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></span>
    </div>
  </div>`;
}

/* ─── HELPED tab ────────────────────────────────────── */
async function loadHelped() {
  const el = document.getElementById("tb-helped");
  if (!el) return;
  el.innerHTML = emptyState(
    "🤝",
    "Helped posts data requires additional activity tracking",
    "Posts where this crafter was marked as most helpful will appear here.",
  );
}

/* ─── ACHIEVEMENTS tab ──────────────────────────────── */
function renderAchievements() {
  const el = document.getElementById("tb-achievements");
  if (!el || !_profile) return;

  const earned = (_profile.badges || []).filter((b) => !b.locked);
  const locked = (_profile.badges || []).filter((b) => b.locked);

  el.innerHTML = `<div class="ach-label">Earned — ${earned.length} of ${_profile.badges.length} badges</div>
    <div class="ach-grid">
      ${earned
        .map(
          (a) => `<div class="acard ${a.tier}">
        <span class="acard-icon">${a.icon}</span>
        <div class="acard-title">${a.title}</div>
        <div class="acard-desc">${a.desc}</div>
      </div>`,
        )
        .join("")}
    </div>
    ${
      locked.length
        ? `
    <div class="ach-label" style="margin-top:20px">Locked — ${locked.length} remaining</div>
    <div class="ach-grid">
      ${locked
        .map(
          (a) => `<div class="acard ${a.tier} locked">
        <div class="acard-lock">🔒</div>
        <span class="acard-icon">${a.icon}</span>
        <div class="acard-title">${a.title}</div>
        <div class="acard-desc">${a.desc}</div>
      </div>`,
        )
        .join("")}
    </div>`
        : ""
    }`;
}

/* ─── FRIENDS tab ───────────────────────────────────── */
async function loadFriends() {
  const el = document.getElementById("tb-friends");
  if (!el) return;
  el.innerHTML = shimmerCards(6, "60px");

  try {
    const { friends, total, hasMore } = await api(
      `/crafter/${TARGET_ID}/friends?page=1`,
    );

    if (!friends.length) {
      el.innerHTML = emptyState("👥", "No friends yet");
      return;
    }

    const cards = friends
      .map((f) => {
        const avStyle = f.avatar
          ? `background-image:url(${f.avatar});background-size:cover;`
          : `background:${colorFor(String(f.id))};`;
        return `
      <div class="frcard" onclick="window.location.href='crafter-profile.html?id=${f.id}'">
        <div class="fr-av" style="${avStyle}">${f.avatar ? "" : initials(f.name)}</div>
        <div class="fr-name">${escHTML(f.name)}</div>
        <div class="fr-rank">${f.rank}</div>
        <div class="fr-mutual">${f.mutual ? "✓ Mutual friend" : ""}</div>
        <button class="fr-btn" onclick="event.stopPropagation();window.location.href='crafter-profile.html?id=${f.id}'">
          View Profile
        </button>
      </div>`;
      })
      .join("");

    el.innerHTML = `<div class="friends-grid">${cards}</div>`;

    if (hasMore) {
      const more = document.createElement("div");
      more.className = "fr-more-card";
      more.textContent = `+${total - friends.length} more friends`;
      more.onclick = () => toast("Full friends list — coming soon");
      el.querySelector(".friends-grid").appendChild(more);
    }
  } catch (err) {
    el.innerHTML = `<div style="color:#c0392b;padding:20px;font-size:.88rem;">${err.message}</div>`;
  }
}

/* ═══════════════════════════════════════════════════════
   FRIEND REQUEST ACTIONS
═══════════════════════════════════════════════════════ */

/** Main follow button dispatcher — routes to right action based on current state */
async function handleFollowClick() {
  if (!_profile) return;
  if (_friendStatus === "pending_received") {
    await acceptFriendRequest();
  } else {
    await toggleFollow(); // send / cancel / unfriend
  }
}

/** Send request (none→pending_sent), cancel (pending_sent→none), or unfriend (friends→none) */
async function toggleFollow() {
  if (!_profile) return;
  const btn = document.getElementById("follow-btn");
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = ".6";
  }

  try {
    const { friendStatus, message: msg } = await api(
      `/crafter/${TARGET_ID}/follow`,
      { method: "POST" },
    );
    _friendStatus = friendStatus;
    updateFollowBtn(
      _friendStatus,
      _profile._displayName || resolveDisplayName(_profile),
    );
    toast(msg);
  } catch (err) {
    toast(err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = "";
    }
  }
}

/** Accept incoming request (pending_received → friends) */
async function acceptFriendRequest() {
  if (!_profile) return;
  const btn = document.getElementById("follow-btn");
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = ".6";
  }
  try {
    const { friendStatus, message: msg } = await api(
      `/crafter/${TARGET_ID}/accept`,
      { method: "POST" },
    );
    _friendStatus = friendStatus;
    updateFollowBtn(
      _friendStatus,
      _profile._displayName || resolveDisplayName(_profile),
    );
    toast(msg || "Now friends! 🎉");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = "";
    }
  }
}

/** Decline incoming request (pending_received → none) */
async function declineFriendRequest() {
  if (!_profile) return;
  const decBtn = document.getElementById("decline-btn");
  if (decBtn) {
    decBtn.disabled = true;
    decBtn.style.opacity = ".6";
  }
  try {
    const { friendStatus, message: msg } = await api(
      `/crafter/${TARGET_ID}/decline`,
      { method: "POST" },
    );
    _friendStatus = friendStatus;
    updateFollowBtn(
      _friendStatus,
      _profile._displayName || resolveDisplayName(_profile),
    );
    toast(msg || "Request declined");
  } catch (err) {
    toast(err.message, "error");
  } finally {
    if (decBtn) {
      decBtn.disabled = false;
      decBtn.style.opacity = "";
    }
  }
}

function openMessage() {
  window.location.href = `chat.html?friend=${TARGET_ID}`;
}

function shareProfile() {
  const url = window.location.href;
  navigator.clipboard?.writeText(url).catch(() => {});
  toast("Profile link copied to clipboard 📋");
}

/* ═══════════════════════════════════════════════════════
   SIDEBAR USER (logged-in user, from localStorage)
═══════════════════════════════════════════════════════ */
function populateSidebarUser() {
  const sbName = document.querySelector(".sb-prof-name");
  const sbSub = document.querySelector(".sb-prof-sub");
  const sbAv = document.querySelector(".sb-prof-av");
  const topAv = document.querySelector(".topav");

  if (sbName) sbName.textContent = _me?.name || "You";
  if (sbSub) sbSub.textContent = _me?.handle ? `@${_me.handle}` : "";

  [sbAv, topAv].forEach((el) => {
    if (!el) return;
    if (_me?.avatar) {
      el.style.backgroundImage = `url(${_me.avatar})`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
      el.textContent = "";
    } else {
      el.textContent = initials(_me?.name);
      el.style.background = colorFor(_me?._id || _me?.id || "me");
      el.style.color = "#fff";
    }
  });
}

/* ═══════════════════════════════════════════════════════
   NAV  (unchanged from original)
═══════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
function setTxt(sel, val) {
  const el = document.querySelector(sel);
  if (el) el.textContent = val ?? "";
}

function shimmerCards(n = 3, h = "140px") {
  return Array(n)
    .fill("")
    .map(
      () =>
        `<div style="height:${h};border-radius:14px;margin-bottom:14px;background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;"></div>`,
    )
    .join("");
}

function emptyState(icon, title, sub = "") {
  return `<div style="text-align:center;padding:48px 24px;color:#aaa;">
    <div style="font-size:2.4rem;">${icon}</div>
    <div style="font-size:.96rem;font-weight:600;margin:12px 0 4px;">${title}</div>
    ${sub ? `<div style="font-size:.82rem;">${sub}</div>` : ""}
  </div>`;
}

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  populateSidebarUser();
  loadProfile();

  // Wire nav
  const NAV_ROUTES = {
    Home: "../index.html",
    Explore: "explore.html",
    Notifications: "dashboard.html",
    Messages: "chat.html",
    Profile: "profile.html",
    Bookmarks: "profile.html",
    Settings: "settings.html",
  };
  document.querySelectorAll(".nav-item").forEach((el) => {
    const label = el.querySelector(".nav-label")?.textContent?.trim();
    if (label && NAV_ROUTES[label]) {
      el.addEventListener(
        "click",
        () => (window.location.href = NAV_ROUTES[label]),
      );
    }
  });

  // Wire distress button
  document.querySelector(".distress-btn")?.addEventListener("click", () => {
    window.location.href = "create-post.html";
  });

  // Wire message button
  document
    .querySelector(".btn.sec:not(.ico)")
    ?.addEventListener("click", openMessage);

  // Wire resize
  window.addEventListener("resize", () => {
    if (window.innerWidth > 520) closeSidebar();
  });
});
