// Frontend/js/profile.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Powers the full profile page. Replaces every hardcoded data array
//   from the original inline script with real API calls.
//
//   Endpoints used:
//     GET   /api/profile              → hero, stats, points, badges, friends, details
//     GET   /api/profile/posts?filter → posts grid (all / distress / resolved)
//     GET   /api/profile/activity     → timeline
//     PATCH /api/profile              → save profile edits
//     PATCH /api/profile/hobbies      → save hobbies changes
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:5000/api";

/* ═══════════════════════════════════════════════════════════
   AUTH GUARD
═══════════════════════════════════════════════════════════ */
const token = localStorage.getItem("token");
const _me = JSON.parse(localStorage.getItem("user") || "{}");

if (!token) {
  window.location.href = "login.html";
}

/* ═══════════════════════════════════════════════════════════
   SHARED FETCH HELPER
═══════════════════════════════════════════════════════════ */
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
   PAGE STATE
═══════════════════════════════════════════════════════════ */
let _profile = null; // full profile object from API
let _postsCache = {}; // { all: [], distress: [], resolved: [] }

/* ═══════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════ */
function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
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
function colorFor(id = "") {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) & 0xffffff;
  return _COLORS[h % _COLORS.length];
}

function escapeHTML(str = "") {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ═══════════════════════════════════════════════════════════
   COUNTER ANIMATION
═══════════════════════════════════════════════════════════ */
function animateCounter(el, target) {
  if (!el) return;
  const num = parseInt(String(target).replace(/,/g, "")) || 0;
  const duration = 1200;
  const start = performance.now();

  const tick = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(num * eased);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = num.toLocaleString();
  };
  requestAnimationFrame(tick);
}

/* ═══════════════════════════════════════════════════════════
   LOAD PROFILE  (main bootstrap)
═══════════════════════════════════════════════════════════ */
async function loadProfile() {
  try {
    const { profile } = await api("/profile");
    _profile = profile;

    renderHero(profile);
    renderStats(profile);
    renderPoints(profile.pointsBreakdown, profile.points);
    renderBadges(profile.badges);
    renderHobbies(profile.hobbies);
    renderFriends(profile.friendsStrip, profile.friendCount);
    renderDetails(profile.details);

    // Posts and activity in parallel (non-blocking)
    loadPosts("all");
    loadActivity();
  } catch (err) {
    console.error("[loadProfile]", err);
    showError("Could not load profile. Please refresh.");
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — HERO
═══════════════════════════════════════════════════════════ */
function renderHero(p) {
  // Banner background
  const banner = document.querySelector(".hero-banner");
  if (banner) banner.style.background = p.bannerColor || "#7a8f52";

  // Avatar
  const av = document.querySelector(".hero-avatar");
  if (av) {
    if (p.avatar) {
      av.style.backgroundImage = `url(${p.avatar})`;
      av.style.backgroundSize = "cover";
      av.textContent = "";
    } else {
      av.textContent = initials(p.name);
    }
  }

  // Sidebar avatar
  const sbAv = document.querySelector(".sb-prof-av");
  if (sbAv) {
    if (p.avatar) {
      sbAv.style.backgroundImage = `url(${p.avatar})`;
      sbAv.style.backgroundSize = "cover";
    } else sbAv.textContent = initials(p.name);
  }

  // Text fields
  const set = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
  };
  set(".hero-name", p.name);
  set(".hero-handle", `${p.handle} · Member since ${p.memberSince}`);
  set(".hero-bio", p.bio || "No bio yet — click Edit Profile to add one.");
  set(".sb-prof-name", p.name);
  set(".sb-prof-sub", p.handle);

  // Location
  const locEl = document.querySelector(".hero-location");
  if (locEl) {
    if (p.location) {
      locEl.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${escapeHTML(p.location)}`;
      locEl.style.display = "";
    } else {
      locEl.style.display = "none";
    }
  }

  // Topbar avatar
  const topAv = document.querySelector(".profile-avatar-btn");
  if (topAv) {
    if (p.avatar) {
      topAv.style.backgroundImage = `url(${p.avatar})`;
      topAv.style.backgroundSize = "cover";
    } else topAv.textContent = initials(p.name);
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — STATS ROW  (with counter animation)
═══════════════════════════════════════════════════════════ */
function renderStats(p) {
  // Set raw values first (avoid showing 0 flash)
  document.getElementById("stat-friends").textContent =
    p.friendCount.toLocaleString();
  document.getElementById("stat-pts").textContent = p.points.toLocaleString();
  document.getElementById("stat-posts").textContent =
    p.postCount.toLocaleString();
  document.getElementById("stat-helped").textContent =
    p.helpedCount.toLocaleString();

  // Resolved sub-label
  const subEls = document.querySelectorAll(".stat-sub");
  if (subEls[2]) subEls[2].textContent = `${p.resolvedCount} resolved`;

  // Animate after short delay (visual polish)
  setTimeout(() => {
    animateCounter(document.getElementById("stat-friends"), p.friendCount);
    animateCounter(document.getElementById("stat-pts"), p.points);
    animateCounter(document.getElementById("stat-posts"), p.postCount);
    animateCounter(document.getElementById("stat-helped"), p.helpedCount);
  }, 200);

  // Update points total panel
  const ptsVal = document.querySelector(".points-total-val");
  if (ptsVal) ptsVal.textContent = `${p.points.toLocaleString()} pts`;

  const rankEl = document.querySelector(".points-rank");
  if (rankEl) rankEl.textContent = p.rank;
}

/* ═══════════════════════════════════════════════════════════
   RENDER — POINTS BREAKDOWN BAR CHART
═══════════════════════════════════════════════════════════ */
function renderPoints(breakdown, total) {
  const container = document.getElementById("points-breakdown");
  if (!container) return;

  container.innerHTML = breakdown
    .map((r) => {
      const pct = total > 0 ? Math.round((r.val / total) * 100) : 0;
      return `
    <div class="point-row">
      <div class="point-row-icon" style="background:${r.bg};color:${r.color}">
        <svg viewBox="0 0 24 24" stroke="${r.color}" fill="none" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">${r.icon}</svg>
      </div>
      <div class="point-row-info">
        <div class="point-row-label">${escapeHTML(r.label)}</div>
        <div class="point-bar-wrap">
          <div class="point-bar" style="width:0%;background:${r.color};transition:width .8s ease"
               data-w="${pct}"></div>
        </div>
      </div>
      <div class="point-row-val">${r.val.toLocaleString()}</div>
    </div>`;
    })
    .join("");

  // Animate bars after paint
  setTimeout(() => {
    document.querySelectorAll(".point-bar").forEach((b) => {
      b.style.width = b.dataset.w + "%";
    });
  }, 200);
}

/* ═══════════════════════════════════════════════════════════
   RENDER — BADGES / ACHIEVEMENTS
═══════════════════════════════════════════════════════════ */
function renderBadges(badges) {
  const el = document.getElementById("badges-grid");
  if (!el) return;

  el.innerHTML = badges
    .map(
      (b) => `
    <div class="badge-item ${b.locked ? "locked" : ""}">
      <div class="badge-emoji">${b.emoji}</div>
      <div class="badge-name">${escapeHTML(b.name)}</div>
      <div class="badge-pts">${b.pts}</div>
    </div>`,
    )
    .join("");
}

/* ═══════════════════════════════════════════════════════════
   RENDER — HOBBIES / CRAFTS
═══════════════════════════════════════════════════════════ */
function renderHobbies(hobbies = []) {
  const el = document.getElementById("hobbies-wrap");
  if (!el) return;

  if (!hobbies.length) {
    el.innerHTML = `<p style="color:var(--text-light);font-size:.84rem;">No hobbies added yet — click <strong>+ Add</strong> to add some.</p>`;
    return;
  }

  el.innerHTML = hobbies
    .map(
      (h) =>
        `<div class="hobby-tag"><span class="htag-dot"></span>${escapeHTML(h)}</div>`,
    )
    .join("");
}

/* ═══════════════════════════════════════════════════════════
   RENDER — FRIENDS STRIP
═══════════════════════════════════════════════════════════ */
function renderFriends(friends = [], total = 0) {
  const el = document.getElementById("friends-strip");
  if (!el) return;

  // Update the count in the section title
  const countEl = document.querySelector(".friends-count");
  if (countEl) countEl.textContent = `(${total})`;

  if (!friends.length) {
    el.innerHTML = `<p style="color:var(--text-light);font-size:.84rem;">No friends yet.</p>`;
    return;
  }

  el.innerHTML = friends
    .map((f) => {
      const bg = f.avatar ? "" : `background:${colorFor(String(f.id))};`;
      const body = f.avatar
        ? `<div class="friend-av" style="background-image:url(${f.avatar});background-size:cover;"></div>`
        : `<div class="friend-av" style="${bg}">${initials(f.name)}</div>`;
      return `
    <div class="friend-item" style="cursor:pointer"
         onclick="window.location.href='crafter-profile.html?id=${f.id}'">
      ${body}
      <div class="friend-name">${escapeHTML(f.name.split(" ")[0])}</div>
    </div>`;
    })
    .join("");
}

/* ═══════════════════════════════════════════════════════════
   RENDER — DETAILS PANEL
═══════════════════════════════════════════════════════════ */
function renderDetails(d) {
  const el = document.getElementById("details-list");
  if (!el) return;

  const rows = [
    {
      show: !!d.location,
      icon: '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>',
      label: "Location",
      value: d.location,
    },
    {
      show: !!d.website,
      icon: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
      label: "Website",
      value: `<a href="https://${d.website.replace(/^https?:\/\//, "")}" target="_blank" rel="noopener">${escapeHTML(d.website)}</a>`,
      raw: true,
    },
    {
      show: !!d.businessType,
      icon: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      label: "Business Type",
      value: d.businessType,
    },
    {
      show: !!d.memberSince,
      icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      label: "Member Since",
      value: d.memberSince,
    },
    {
      show: !!d.contact,
      icon: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.7 9.74 19.79 19.79 0 01.67 1.1 2 2 0 012.66 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L7.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>',
      label: "Contact",
      value: d.contact,
    },
    {
      show: !!d.instagram,
      icon: '<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>',
      label: "Instagram",
      value: d.instagram,
    },
  ].filter((r) => r.show);

  if (!rows.length) {
    el.innerHTML = `<p style="color:var(--text-light);font-size:.84rem;">No details added yet — click <strong>Edit</strong> to add your info.</p>`;
    return;
  }

  el.innerHTML = rows
    .map(
      (r) => `
    <div class="detail-row">
      <div class="detail-icon">
        <svg viewBox="0 0 24 24" stroke="var(--accent)" fill="none"
             stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          ${r.icon}
        </svg>
      </div>
      <div class="detail-content">
        <div class="detail-label">${r.label}</div>
        <div class="detail-value">${r.raw ? r.value : escapeHTML(r.value)}</div>
      </div>
    </div>`,
    )
    .join("");
}

/* ═══════════════════════════════════════════════════════════
   LOAD + RENDER — POSTS GRID  (with filter/tab)
═══════════════════════════════════════════════════════════ */
async function loadPosts(filter = "all") {
  const grid = document.getElementById("posts-grid");
  if (!grid) return;

  // Show shimmer
  grid.innerHTML = `
    <div class="loading-shimmer" style="height:140px;border-radius:14px;"></div>
    <div class="loading-shimmer" style="height:140px;border-radius:14px;"></div>
    <div class="loading-shimmer" style="height:140px;border-radius:14px;"></div>`;

  // Use cache if already fetched
  if (_postsCache[filter]) {
    renderPosts(_postsCache[filter]);
    return;
  }

  try {
    const { posts } = await api(`/profile/posts?filter=${filter}`);
    _postsCache[filter] = posts;
    renderPosts(posts);
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--text-light);padding:20px;">Could not load posts.</p>`;
    console.error("[loadPosts]", err);
  }
}

function renderPosts(posts) {
  const grid = document.getElementById("posts-grid");
  if (!grid) return;

  if (!posts.length) {
    grid.innerHTML = `<p style="color:var(--text-light);padding:20px;grid-column:1/-1;">No posts yet in this category.</p>`;
    return;
  }

  const SEV_STYLE = {
    High: { bg: "#fce8e1", color: "#d35b3a" },
    Medium: { bg: "#fdf3e0", color: "#9a6d1e" },
    Low: { bg: "#e5ecda", color: "#6b7a50" },
  };

  grid.innerHTML = posts
    .map((p) => {
      const sev = p.severity ? SEV_STYLE[p.severity] : null;
      const isDistress = p.type === "sos";
      const cardBg = isDistress
        ? "rgba(122,143,82,0.15)"
        : "rgba(122,143,82,0.08)";

      return `
    <div class="post-card" style="cursor:pointer"
         onclick="window.location.href='post-detail.html?id=${p.id}'">
      <div class="post-card-img" style="background:${cardBg};position:relative;">
        ${
          sev
            ? `<span class="post-card-badge"
                       style="background:${sev.bg};color:${sev.color};position:absolute;left:8px;top:8px;border-radius:20px;padding:2px 10px;font-size:.72rem;font-weight:600;">
                    ${p.severity}
                 </span>`
            : ""
        }
        ${
          p.resolved
            ? `<span class="post-card-badge"
                              style="background:#e5ecda;color:#6b7a50;position:absolute;right:8px;top:8px;border-radius:20px;padding:2px 10px;font-size:.72rem;font-weight:600;">
                           ✓ Resolved
                         </span>`
            : ""
        }
        <svg viewBox="0 0 24 24" style="width:36px;height:36px;opacity:.25;stroke:var(--accent);fill:none;stroke-width:1.5">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      <div class="post-card-body">
        <div style="font-size:.71rem;font-weight:600;color:var(--accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">
          ${escapeHTML(p.cat)}
        </div>
        <div class="post-card-title">${escapeHTML(p.title)}</div>
        <div class="post-card-meta">
          <span>${p.time}</span>
          <div class="post-card-stats">
            <span class="post-stat">
              <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              ${p.comments}
            </span>
            ${
              p.helps
                ? `<span class="post-stat">
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              ${p.helps}
            </span>`
                : ""
            }
          </div>
        </div>
      </div>
    </div>`;
    })
    .join("");
}

/* ═══════════════════════════════════════════════════════════
   LOAD + RENDER — ACTIVITY TIMELINE
═══════════════════════════════════════════════════════════ */
async function loadActivity() {
  const el = document.getElementById("timeline");
  if (!el) return;

  el.innerHTML = `
    <div class="loading-shimmer" style="height:44px;border-radius:10px;margin-bottom:10px;"></div>`.repeat(
    4,
  );

  try {
    const { activity } = await api("/profile/activity");
    renderTimeline(activity);
  } catch (err) {
    el.innerHTML = `<p style="color:var(--text-light);padding:12px;">Could not load activity.</p>`;
    console.error("[loadActivity]", err);
  }
}

function renderTimeline(items = []) {
  const el = document.getElementById("timeline");
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `<p style="color:var(--text-light);padding:12px;">No recent activity yet.</p>`;
    return;
  }

  el.innerHTML = items
    .map(
      (t, i) => `
    <div class="tl-item">
      <div class="tl-left">
        <div class="tl-dot" style="background:var(--accent-light);font-size:1rem">${t.emoji}</div>
        ${i < items.length - 1 ? '<div class="tl-line"></div>' : ""}
      </div>
      <div class="tl-content">
        <div class="tl-text">${t.text}</div>
        <div class="tl-time">${t.timeAgo}</div>
      </div>
    </div>`,
    )
    .join("");
}

/* ═══════════════════════════════════════════════════════════
   POST TAB SWITCH
═══════════════════════════════════════════════════════════ */
function switchTab(el, filter) {
  document
    .querySelectorAll(".ptab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  loadPosts(filter);
}

/* ═══════════════════════════════════════════════════════════
   PAGE-LEVEL ERROR
═══════════════════════════════════════════════════════════ */
function showError(msg) {
  document.getElementById("main").innerHTML =
    `<div style="padding:60px;text-align:center;color:#666;font-family:sans-serif;">
      <h2>Oops</h2><p>${msg}</p>
      <a href="../index.html" style="color:#7a8f52">← Back to feed</a>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  // Wire Edit Profile button
  const editBtn = document.querySelector(".btn-primary");
  if (editBtn) editBtn.onclick = () => (window.location.href = "settings.html");
  // ── Edit Banner button (top-right of banner) ────────────
  const editBannerBtn = document.querySelector(".edit-banner-btn");
  if (editBannerBtn)
    editBannerBtn.onclick = () => {
      window.location.href = "settings.html#sec-banner";
    };

  // ── Avatar edit overlay (pencil icon over avatar) ───────
  const avatarEditBtn = document.querySelector(".hero-avatar-edit");
  if (avatarEditBtn)
    avatarEditBtn.onclick = () => {
      window.location.href = "settings.html#sec-avatar";
    };

  // ── Sidebar profile avatar (also opens settings) ────────
  const sbAv = document.querySelector(".sb-prof-av");
  if (sbAv)
    sbAv.onclick = () => {
      window.location.href = "settings.html";
    };

  // Wire + Add hobbies link
  const addHobbyBtn = document.querySelector(
    ".section-edit[data-action='hobbies']",
  );
  if (addHobbyBtn)
    addHobbyBtn.onclick = () =>
      (window.location.href = "settings.html#sec-craft");

  // Wire Distress Call button
  const distressBtn = document.querySelector(".distress-btn");
  if (distressBtn)
    distressBtn.onclick = () => (window.location.href = "create-post.html");

  // Share button
  const shareBtn = document.querySelector(".btn-outline");
  if (shareBtn)
    shareBtn.onclick = () =>
      navigator.clipboard?.writeText(window.location.href);

  loadProfile();
});
