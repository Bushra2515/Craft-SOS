/* ═══════════════════════════════════════════════════════════
   CRAFT-SOS  ADMIN.JS
   All API calls go to /api/admin/*
   Token is stored in localStorage.adminToken
═══════════════════════════════════════════════════════════ */

const API = "/api/admin";

/* ─── Auth helpers ─── */
const token = () => localStorage.getItem("adminToken") || "";
const headers = () => ({
  "Content-Type": "application/json",
  Authorization: "Bearer " + token(),
});

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { ...headers(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

/* ─── Toast ─── */
function toast(msg, type = "ok") {
  const tc = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast t-${type}`;
  const icon = type === "ok" ? "✓" : type === "err" ? "✕" : "ℹ";
  el.innerHTML = `<span>${icon}</span> ${esc(msg)}`;
  tc.appendChild(el);
  setTimeout(() => (el.style.opacity = "0"), 2800);
  setTimeout(() => el.remove(), 3100);
}

/* ─── Utilities ─── */
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

function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function userStatus(u) {
  if (!u.isActive) return "suspended";
  if (!u.isEmailVerified) return "pending";
  return "active";
}

function statusPill(status) {
  const map = {
    active: "p-green",
    resolved: "p-green",
    pending: "p-blue",
    draft: "p-blue",
    suspended: "p-amber",
    closed: "p-amber",
    banned: "p-red",
    sent: "p-green",
  };
  return `<span class="pill ${map[status] || "p-amber"}">${esc(status)}</span>`;
}

function rolePill(role) {
  const map = { admin: "r-admin", moderator: "r-mod", user: "r-user" };
  return `<span class="role-pill ${map[role] || "r-user"}">${esc(role)}</span>`;
}

function initials(u) {
  if (u.handle) return u.handle.slice(0, 2).toUpperCase();
  return ((u.firstName || "?")[0] + (u.lastName || "?")[0]).toUpperCase();
}

/* ─── Navigation ─── */
const ALL_SECTIONS = [
  "dashboard",
  "users",
  "posts",
  "reports",
  "moderation",
  "verification",
  "analytics",
  "badges",
  "challenges",
  "announcements",
  "tags",
  "logs",
  "system",
];

const _loaded = {};

function goSection(name, navEl) {
  ALL_SECTIONS.forEach((s) => {
    const el = document.getElementById("s-" + s);
    if (el) el.style.display = "none";
  });
  const target = document.getElementById("s-" + name);
  if (target) {
    target.style.display = "";
    target.style.animation = "fadeUp .3s ease both";
  }
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  if (navEl) {
    navEl.classList.add("active");
  } else {
    document.querySelectorAll(".nav-item").forEach((i) => {
      if ((i.getAttribute("onclick") || "").includes("'" + name + "'"))
        i.classList.add("active");
    });
  }
  window.scrollTo({ top: 0, behavior: "smooth" });

  // Auto-load on first open
  const loaders = {
    dashboard: loadDashboard,
    users: loadUsers,
    posts: loadPosts,
    reports: loadReports,
    verification: loadVerification,
    badges: loadBadges,
    challenges: loadChallenges,
    announcements: loadAnnouncements,
    analytics: loadAnalytics,
    logs: loadLogs,
  };
  if (!_loaded[name] && loaders[name]) {
    _loaded[name] = true;
    loaders[name]();
  }
}

/* ─── Modals ─── */
function openModal(id) {
  document.getElementById(id).classList.add("on");
  document.body.style.overflow = "hidden";
}
function closeModal(id) {
  document.getElementById(id).classList.remove("on");
  document.body.style.overflow = "";
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document
      .querySelectorAll(".modal-ov.on")
      .forEach((m) => m.classList.remove("on"));
    document.body.style.overflow = "";
  }
});

/* ─── Toggles / misc ─── */
function togBtn(btn) {
  btn.classList.toggle("on");
  btn.classList.toggle("off");
}
function globalSearch(q) {
  if (!q) return;
  const ql = q.toLowerCase();
  if (ql.includes("user")) goSection("users", null);
  else if (ql.includes("report")) goSection("reports", null);
  else if (ql.includes("post") || ql.includes("sos")) goSection("posts", null);
}
function addTagFn() {
  const t = prompt("New tag (without #):");
  if (!t?.trim()) return;
  const list = document.getElementById("tag-list");
  const chip = document.createElement("div");
  chip.className = "tag-chip";
  chip.innerHTML = `#${esc(t.trim())} <span>0</span><button class="tag-x" onclick="this.closest('.tag-chip').remove()">✕</button>`;
  list.appendChild(chip);
}
function addKeyword() {
  const t = prompt("New blocked keyword:");
  if (!t?.trim()) return;
  const list = document.getElementById("keyword-list");
  const chip = document.createElement("div");
  chip.className = "tag-chip";
  chip.innerHTML = `${esc(t.trim())} <span>0 hits</span><button class="tag-x" onclick="this.closest('.tag-chip').remove()">✕</button>`;
  list.appendChild(chip);
}

/* ═══════════════════════════════════════════════════════════
   1. DASHBOARD
═══════════════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const [statsData, recentData, awardsData] = await Promise.all([
      apiFetch("/dashboard/stats"),
      apiFetch("/dashboard/recent"),
      apiFetch("/badges/recent-awards"),
    ]);

    if (statsData.success) renderDashStats(statsData);
    if (recentData.success) renderDashRecent(recentData);
    if (awardsData.success) renderDashAwards(awardsData.awards);
  } catch (err) {
    toast("Dashboard load failed: " + err.message, "err");
  }
}

function renderDashStats(d) {
  const s = d.stats;
  document.getElementById("nb-users").textContent = s.totalUsers;
  document.getElementById("nb-posts").textContent = s.activePosts;
  document.getElementById("nb-verify").textContent = s.pendingVerification;

  const cards = [
    {
      icon: "👥",
      color: "--blue",
      val: s.totalUsers,
      label: "Total Users",
      sub: `+${s.newSignupsToday} today · ${s.pendingVerification} pending`,
    },
    {
      icon: "⚡",
      color: "--high",
      val: s.activePosts,
      label: "Active SOS Posts",
      sub: `${s.zeroReplyPosts} with 0 replies`,
    },
    {
      icon: "✅",
      color: "--low",
      val: s.resolvedPosts,
      label: "SOS Resolved",
      sub: `${s.closedPosts} closed`,
    },
    {
      icon: "💬",
      color: "--accent",
      val: s.totalComments,
      label: "Total Comments",
      sub: "across all posts",
    },
    {
      icon: "🔔",
      color: "--purple",
      val: s.newSignupsToday,
      label: "New Signups Today",
      sub: `${s.pendingVerification} awaiting verify`,
    },
    {
      icon: "📚",
      color: "--med",
      val: s.tutorialsShared,
      label: "Tutorials Shared",
      sub: "community resources",
    },
  ];

  document.getElementById("dash-stats").innerHTML = cards
    .map(
      (c, i) => `
    <div class="sc" style="animation-delay:${i * 0.05}s">
      <div class="sc-top">
        <div class="sc-ico" style="background:var(${c.color}-bg,var(--accent-pale));color:var(${c.color});">${c.icon}</div>
      </div>
      <div class="sc-val">${Number(c.val).toLocaleString()}</div>
      <div class="sc-label">${c.label}</div>
      <div class="sc-sub">${c.sub}</div>
    </div>
  `,
    )
    .join("");

  // Chart
  const chart = document.getElementById("dash-chart");
  if (d.sevenDayChart?.length) {
    const max = Math.max(...d.sevenDayChart.map((x) => x.count), 1);
    chart.innerHTML = d.sevenDayChart
      .map(
        (x) => `
      <div class="bar-wrap">
        <div class="bar" style="height:${Math.max(8, (x.count / max) * 100)}%;background:var(--accent);"></div>
        <div class="bar-lbl">${esc(x._id)}</div>
      </div>
    `,
      )
      .join("");
  } else {
    chart.innerHTML = `<div class="empty" style="width:100%">No activity data yet</div>`;
  }

  // Metrics strip
  const total = s.activePosts + s.resolvedPosts + s.closedPosts;
  const rate = total ? Math.round((s.resolvedPosts / total) * 100) : 0;
  document.getElementById("dash-metrics").innerHTML = `
    <div class="metric-tile"><div class="m-val">${total}</div><div class="m-lbl">Total Posts</div></div>
    <div class="metric-tile"><div class="m-val">${rate}%</div><div class="m-lbl">Resolution Rate</div></div>
    <div class="metric-tile"><div class="m-val">${s.zeroReplyPosts}</div><div class="m-lbl">Need Replies</div><div class="m-trend" style="color:var(--high)">Urgent</div></div>
  `;

  // Skills donut
  const skillEl = document.getElementById("dash-skills");
  if (d.skillBreakdown?.length) {
    const colors = [
      "#7a8f52",
      "#3a6ea8",
      "#c0432a",
      "#b07820",
      "#7258b0",
      "#3d7a3d",
    ];
    skillEl.innerHTML = `
      <div class="donut-legend">
        ${d.skillBreakdown
          .map(
            (s, i) => `
          <div class="dl">
            <div class="dl-dot" style="background:${colors[i % colors.length]}"></div>
            ${esc(s._id)} <div class="dl-val">${s.count}</div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  } else {
    skillEl.innerHTML = `<div class="empty">No skill data yet</div>`;
  }
}

function renderDashRecent(d) {
  const ub = document.getElementById("dash-recent-users");
  if (!d.recentUsers?.length) {
    ub.innerHTML = `<tr><td colspan="3" class="empty">No recent signups</td></tr>`;
    return;
  }
  ub.innerHTML = d.recentUsers
    .map(
      (u) => `
    <tr>
      <td><div class="uc"><div class="av" style="background:var(--accent)">${initials(u)}</div>
        <div><div class="u-name">@${esc(u.handle)}</div><div class="u-sub">${timeAgo(u.createdAt)}</div></div>
      </div></td>
      <td>${statusPill(userStatus(u))}</td>
      <td>
        ${
          !u.isEmailVerified
            ? `<button class="btn btn-primary btn-xs" onclick="quickVerify('${u._id}',this)">Verify</button>`
            : `<button class="btn btn-ghost btn-xs" onclick="openUserDetail('${u._id}')">View</button>`
        }
      </td>
    </tr>
  `,
    )
    .join("");

  const pb = document.getElementById("dash-recent-posts");
  if (!d.recentPosts?.length) {
    pb.innerHTML = `<tr><td colspan="3" class="empty">No recent posts</td></tr>`;
    return;
  }
  pb.innerHTML = d.recentPosts
    .map(
      (p) => `
    <tr>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;">
        ${esc(p.title)}
      </td>
      <td>${statusPill(p.status)}</td>
      <td>${p.replyCount}</td>
    </tr>
  `,
    )
    .join("");
}

function renderDashAwards(awards) {
  const tb = document.getElementById("dash-recent-awards");
  if (!awards?.length) {
    tb.innerHTML = `<tr><td colspan="3" class="empty">No awards yet</td></tr>`;
    return;
  }
  tb.innerHTML = awards
    .slice(0, 5)
    .map(
      (a) => `
    <tr>
      <td><span style="font-weight:600;">@${esc(a.user)}</span></td>
      <td>${esc(a.badge)}</td>
      <td style="color:var(--text-dim);font-size:0.76rem;">${timeAgo(a.awardedAt)}</td>
    </tr>
  `,
    )
    .join("");
}

/* ═══════════════════════════════════════════════════════════
   2. USERS
═══════════════════════════════════════════════════════════ */
let _userPage = 1;

async function loadUsers() {
  try {
    const search = document.getElementById("user-search")?.value || "";
    const role = document.getElementById("user-role-filter")?.value || "";

    const data = await apiFetch(
      `/users?search=${encodeURIComponent(search)}&role=${role}&page=${_userPage}&limit=20`,
    );
    if (!data.success) throw new Error(data.message);

    // Count stats
    const [activeData, pendingData, suspendedData] = await Promise.all([
      apiFetch("/users?isActive=true&isEmailVerified=true&limit=1"),
      apiFetch("/users?isActive=true&isEmailVerified=false&limit=1"),
      apiFetch("/users?isActive=false&limit=1"),
    ]);
    document.getElementById("ust-active").textContent = activeData.total ?? "—";
    document.getElementById("ust-pending").textContent =
      pendingData.total ?? "—";
    document.getElementById("ust-suspended").textContent =
      suspendedData.total ?? "—";

    document.getElementById("user-total-label").textContent =
      `${data.total} total users`;
    document.getElementById("user-pager-label").textContent =
      `Showing ${(_userPage - 1) * 20 + 1}–${Math.min(_userPage * 20, data.total)} of ${data.total}`;

    document.getElementById("user-prev").disabled = _userPage <= 1;
    document.getElementById("user-next").disabled = _userPage >= data.pages;

    const tb = document.getElementById("user-tbody");
    if (!data.users.length) {
      tb.innerHTML = `<tr><td colspan="7" class="empty"><div class="empty-icon">👥</div>No users found</td></tr>`;
      return;
    }

    tb.innerHTML = data.users
      .map((u) => {
        const st = userStatus(u);
        return `
        <tr>
          <td><div class="uc">
            <div class="av" style="background:var(--accent)">${initials(u)}</div>
            <div><div class="u-name">@${esc(u.handle)}</div><div class="u-sub">${esc(u.email)}</div></div>
          </div></td>
          <td style="font-size:0.76rem;color:var(--text-dim);">${(u.skills || []).slice(0, 2).map(esc).join(", ") || "—"}</td>
          <td style="font-size:0.76rem;">${u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "—"}</td>
          <td>${rolePill(u.role)}</td>
          <td style="font-weight:600;">${u.points ?? 0}</td>
          <td>${statusPill(st)}</td>
          <td>
            <div class="act-row">
              <button class="btn btn-ghost btn-xs" onclick="openUserDetail('${u._id}')">View</button>
              ${
                st === "active" || st === "pending"
                  ? `<button class="btn btn-amber btn-xs" onclick="suspendUser('${u._id}','${esc(u.handle)}',this)">Suspend</button>`
                  : `<button class="btn btn-ghost btn-xs" onclick="reinstateUser('${u._id}','${esc(u.handle)}',this)">Reinstate</button>`
              }
              ${
                !u.isEmailVerified
                  ? `<button class="btn btn-primary btn-xs" onclick="quickVerify('${u._id}',this)">Verify</button>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    toast("Failed to load users: " + err.message, "err");
  }
}

function searchUsers() {
  _userPage = 1;
  loadUsers();
}
function userPage(dir) {
  _userPage = Math.max(1, _userPage + dir);
  loadUsers();
}
function filterUsersByStatus() {
  _userPage = 1;
  loadUsers();
}

async function quickVerify(uid, btn) {
  try {
    btn.textContent = "…";
    btn.disabled = true;
    await apiFetch(`/users/${uid}/verify`, { method: "PATCH" });
    toast("User verified ✓", "ok");
    loadUsers();
    if (_loaded["dashboard"]) {
      delete _loaded["dashboard"];
      loadDashboard();
    }
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = "Verify";
    btn.disabled = false;
  }
}

async function suspendUser(uid, handle, btn) {
  if (!confirm(`Suspend @${handle}?`)) return;
  try {
    btn.textContent = "…";
    btn.disabled = true;
    await apiFetch(`/users/${uid}/suspend`, {
      method: "PATCH",
      body: JSON.stringify({ reason: "Admin action" }),
    });
    toast(`@${handle} suspended`, "ok");
    loadUsers();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = "Suspend";
    btn.disabled = false;
  }
}

async function reinstateUser(uid, handle, btn) {
  try {
    btn.textContent = "…";
    btn.disabled = true;
    await apiFetch(`/users/${uid}/reinstate`, { method: "PATCH" });
    toast(`@${handle} reinstated ✓`, "ok");
    loadUsers();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = "Reinstate";
    btn.disabled = false;
  }
}

async function openUserDetail(uid) {
  openModal("m-user");
  const mc = document.getElementById("m-user-content");
  mc.innerHTML = `<div class="empty"><div class="empty-icon">⏳</div>Loading…</div>`;
  try {
    const d = await apiFetch(`/users/${uid}`);
    const u = d.user;
    const st = userStatus(u);
    mc.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
        <div class="av av-lg" style="background:var(--accent);width:48px;height:48px;font-size:1rem;">${initials(u)}</div>
        <div>
          <div style="font-family:'Lora',serif;font-weight:700;font-size:1.1rem;">@${esc(u.handle)}</div>
          <div style="font-size:0.78rem;color:var(--text-dim);">${esc(u.email)} · Joined ${u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"}</div>
          <div style="display:flex;gap:6px;margin-top:6px;">${statusPill(st)} ${rolePill(u.role)}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
        <div style="background:rgba(255,255,255,0.5);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-family:'Lora',serif;font-weight:700;font-size:1.3rem;">${u.helpedCount ?? 0}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);">SOS Helped</div>
        </div>
        <div style="background:rgba(255,255,255,0.5);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-family:'Lora',serif;font-weight:700;font-size:1.3rem;">${u.points ?? 0}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);">Points</div>
        </div>
        <div style="background:rgba(255,255,255,0.5);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-family:'Lora',serif;font-weight:700;font-size:1.3rem;">${(u.badges || []).length}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);">Badges</div>
        </div>
      </div>
      ${(u.badges || []).length ? `<div style="margin-bottom:14px;font-size:0.8rem;color:var(--text-dim);">Badges: ${u.badges.map(esc).join(", ")}</div>` : ""}
      <div style="display:flex;gap:7px;flex-wrap:wrap;">
        ${
          st === "active" || st === "pending"
            ? `<button class="btn btn-amber btn-sm" onclick="suspendUser('${u._id}','${esc(u.handle)}',this);closeModal('m-user')">Suspend</button>
             <button class="btn btn-danger btn-sm" onclick="banUser('${u._id}','${esc(u.handle)}');closeModal('m-user')">Ban User</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="reinstateUser('${u._id}','${esc(u.handle)}',this);closeModal('m-user')">Reinstate</button>`
        }
        ${!u.isEmailVerified ? `<button class="btn btn-primary btn-sm" onclick="quickVerify('${u._id}',this);closeModal('m-user')">✓ Verify</button>` : ""}
        <button class="btn btn-ghost btn-sm" onclick="closeModal('m-user')">Close</button>
      </div>
    `;
  } catch (err) {
    mc.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>${esc(err.message)}</div>`;
  }
}

async function banUser(uid, handle) {
  if (!confirm(`PERMANENTLY BAN @${handle}? This sets isActive:false.`)) return;
  try {
    await apiFetch(`/users/${uid}/ban`, {
      method: "PATCH",
      body: JSON.stringify({ reason: "Admin ban" }),
    });
    toast(`@${handle} banned`, "ok");
    if (_loaded["users"]) loadUsers();
  } catch (err) {
    toast(err.message, "err");
  }
}

/* ═══════════════════════════════════════════════════════════
   3. POSTS
═══════════════════════════════════════════════════════════ */
let _postPage = 1;

async function loadPosts() {
  try {
    const search = document.getElementById("post-search")?.value || "";
    const status = document.getElementById("post-status-filter")?.value || "";
    const type = document.getElementById("post-type-filter")?.value || "";

    const [postsData, statsData] = await Promise.all([
      apiFetch(
        `/posts?search=${encodeURIComponent(search)}&status=${status}&type=${type}&page=${_postPage}&limit=20`,
      ),
      apiFetch("/posts/stats"),
    ]);

    if (statsData.success) {
      document.getElementById("pst-active").textContent = statsData.active;
      document.getElementById("pst-resolved").textContent = statsData.resolved;
      document.getElementById("pst-closed").textContent = statsData.closed;
      document.getElementById("pst-zero").textContent = statsData.zeroReply;
      document.getElementById("nb-posts").textContent = statsData.active;
    }

    document.getElementById("post-total-label").textContent =
      `${postsData.total} total posts`;
    document.getElementById("post-pager-label").textContent =
      `Showing ${(_postPage - 1) * 20 + 1}–${Math.min(_postPage * 20, postsData.total)} of ${postsData.total}`;
    document.getElementById("post-prev").disabled = _postPage <= 1;
    document.getElementById("post-next").disabled =
      _postPage >= postsData.pages;

    const tb = document.getElementById("post-tbody");
    if (!postsData.posts.length) {
      tb.innerHTML = `<tr><td colspan="6" class="empty"><div class="empty-icon">📋</div>No posts found</td></tr>`;
      return;
    }

    const typeLabels = {
      sos: "SOS 🆘",
      tut: "Tutorial 📚",
      com: "Community 💬",
      res: "Resource 📦",
    };
    tb.innerHTML = postsData.posts
      .map(
        (p) => `
      <tr>
        <td style="max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;color:var(--text);">${esc(p.title)}</td>
        <td style="font-size:0.79rem;">@${esc(p.author?.handle || "—")}</td>
        <td><span class="pill p-blue" style="font-size:0.7rem;">${typeLabels[p.type] || p.type}</span></td>
        <td>${p.replyCount}</td>
        <td>${statusPill(p.status)}</td>
        <td>
          <div class="act-row">
            ${
              p.status === "active"
                ? `<button class="btn btn-ghost btn-xs" onclick="resolvePost('${p._id}',this)">Resolve</button>
                 <button class="btn btn-amber btn-xs" onclick="closePost('${p._id}',this)">Close</button>`
                : `<button class="btn btn-ghost btn-xs" onclick="reopenPost('${p._id}',this)">Reopen</button>`
            }
            <button class="btn btn-danger btn-xs" onclick="deletePost('${p._id}','${esc(p.title).slice(0, 30)}',this)">Delete</button>
          </div>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (err) {
    toast("Failed to load posts: " + err.message, "err");
  }
}

function searchPosts() {
  _postPage = 1;
  loadPosts();
}
function postPage(dir) {
  _postPage = Math.max(1, _postPage + dir);
  loadPosts();
}

async function resolvePost(pid, btn) {
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/posts/${pid}/resolve`, { method: "PATCH" });
    toast("Post resolved", "ok");
    loadPosts();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = "Resolve";
    btn.disabled = false;
  }
}
async function closePost(pid, btn) {
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/posts/${pid}/close`, { method: "PATCH" });
    toast("Post closed", "ok");
    loadPosts();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = "Close";
    btn.disabled = false;
  }
}
async function reopenPost(pid, btn) {
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/posts/${pid}/reopen`, { method: "PATCH" });
    toast("Post reopened", "ok");
    loadPosts();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = "Reopen";
    btn.disabled = false;
  }
}
async function deletePost(pid, title, btn) {
  if (!confirm(`Delete post "${title}…"? This is permanent.`)) return;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/posts/${pid}`, { method: "DELETE" });
    toast("Post deleted", "ok");
    btn.closest("tr").style.opacity = "0";
    setTimeout(() => btn.closest("tr").remove(), 400);
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = "Delete";
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════
   4. REPORTS
═══════════════════════════════════════════════════════════ */
async function loadReports() {
  try {
    const data = await apiFetch("/reports?status=pending&limit=20");
    if (!data.success) throw new Error(data.message);

    const counts = data.counts || {};
    const pending = data.total;

    document.getElementById("nb-reports").textContent = pending;
    document.getElementById("tb-reports-count").textContent = pending;
    document.getElementById("report-pending-pill").textContent =
      `${pending} pending`;
    document.getElementById("rc-spam").textContent = counts.spam || 0;
    document.getElementById("rc-harassment").textContent =
      counts.harassment || 0;
    document.getElementById("rc-scam").textContent = counts.scam || 0;

    const list = document.getElementById("reports-list");
    if (!data.reports.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">✅</div>No pending reports — all clear!</div>`;
      return;
    }

    const iconMap = {
      spam: "🚩",
      harassment: "⚠️",
      scam: "💰",
      misleading: "🔞",
      other: "📋",
    };
    list.innerHTML = data.reports
      .map(
        (r) => `
      <div class="list-item" id="report-${r._id}">
        <div class="rep-ico" style="background:var(--high-bg)">${iconMap[r.reason] || "🚩"}</div>
        <div class="rep-info">
          <div class="rep-title">${esc(r.detail || r.reason)} — ${esc(r.targetType)} #${esc(String(r.targetId).slice(-6))}</div>
          <div class="rep-meta">Reported by ${(r.reportedBy || []).map((x) => "@" + esc(x.handle || x)).join(", ") || "—"} · ${timeAgo(r.createdAt)}</div>
          <div class="rep-reason">${esc(r.reason)}</div>
        </div>
        <div class="act-row">
          ${
            r.targetType === "post"
              ? `<button class="btn btn-danger btn-xs" onclick="resolveReport('${r._id}','remove_post',this)">Remove Post</button>`
              : `<button class="btn btn-danger btn-xs" onclick="resolveReport('${r._id}','ban_user',this)">Ban User</button>`
          }
          <button class="btn btn-amber btn-xs" onclick="resolveReport('${r._id}','warn_user',this)">Warn</button>
          <button class="btn btn-ghost btn-xs" onclick="resolveReport('${r._id}','dismiss',this)">Dismiss</button>
        </div>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    toast("Failed to load reports: " + err.message, "err");
  }
}

async function resolveReport(rid, action, btn) {
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/reports/${rid}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    toast(`Report ${action.replace("_", " ")} ✓`, "ok");
    const row = document.getElementById("report-" + rid);
    if (row) {
      row.style.opacity = "0";
      setTimeout(() => row.remove(), 400);
    }
    loadReports();
  } catch (err) {
    toast(err.message, "err");
    btn.disabled = false;
  }
}

async function dismissAllReports() {
  if (!confirm("Dismiss all pending reports?")) return;
  try {
    const d = await apiFetch("/reports/dismiss-all", { method: "PATCH" });
    toast(d.message, "ok");
    loadReports();
  } catch (err) {
    toast(err.message, "err");
  }
}

/* ═══════════════════════════════════════════════════════════
   5. VERIFICATION QUEUE
═══════════════════════════════════════════════════════════ */
async function loadVerification() {
  try {
    const data = await apiFetch("/users/verification-queue");
    const list = document.getElementById("verify-list");
    document.getElementById("nb-verify").textContent = data.total;
    document.getElementById("verify-count-pill").textContent =
      `${data.total} pending`;

    if (!data.queue?.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">✅</div>Verification queue is empty!</div>`;
      return;
    }

    list.innerHTML = data.queue
      .map(
        (u) => `
      <div class="v-item" id="verify-${u._id}">
        <div class="av" style="background:var(--accent)">${initials(u)}</div>
        <div class="v-info">
          <div class="v-name">@${esc(u.handle)}</div>
          <div class="v-sub">${(u.skills || []).join(" · ") || "No skills listed"} · ${esc(u.location || "Location unknown")} · Applied ${timeAgo(u.createdAt)}</div>
        </div>
        <span class="v-type">${esc(u.communityRole || "seeker")}</span>
        <div class="act-row">
          <button class="btn btn-primary btn-xs" onclick="verifyQueueUser('${u._id}','${esc(u.handle)}',this)">✓ Approve</button>
          <button class="btn btn-danger btn-xs" onclick="rejectQueueUser('${u._id}','${esc(u.handle)}',this)">Reject</button>
        </div>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    toast("Failed to load verification queue: " + err.message, "err");
  }
}

async function verifyQueueUser(uid, handle, btn) {
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/users/${uid}/verify`, { method: "PATCH" });
    toast(`@${handle} verified ✓`, "ok");
    document.getElementById("verify-" + uid)?.remove();
    loadVerification();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = "Approve";
    btn.disabled = false;
  }
}

async function rejectQueueUser(uid, handle, btn) {
  const note = prompt(`Reason for rejecting @${handle}'s verification?`) || "";
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/users/${uid}/reject-verification`, {
      method: "PATCH",
      body: JSON.stringify({ note }),
    });
    toast(`@${handle} rejected`, "ok");
    document.getElementById("verify-" + uid)?.remove();
    loadVerification();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = "Reject";
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════
   6. BADGES
═══════════════════════════════════════════════════════════ */
let _currentBadgeId = null;

async function loadBadges() {
  try {
    const [badgesData, awardsData] = await Promise.all([
      apiFetch("/badges"),
      apiFetch("/badges/recent-awards"),
    ]);

    document.getElementById("badge-count-label").textContent =
      `${badgesData.badges.length} active`;

    const grid = document.getElementById("badge-grid");
    if (!badgesData.badges.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">No badges yet. Create one!</div>`;
    } else {
      grid.innerHTML =
        badgesData.badges
          .map(
            (b) => `
        <div class="badge-tile">
          <div class="badge-em">${esc(b.emoji)}</div>
          <div class="badge-name">${esc(b.name)}</div>
          <div class="badge-cnt">${b.holderCount} holders · ${esc(b.trigger)}</div>
          <div class="act-row" style="justify-content:center;margin-top:8px;">
            <button class="btn btn-primary btn-xs" onclick="openAssignBadge('${b._id}','${esc(b.name)}','${esc(b.emoji)}')">Assign</button>
          </div>
        </div>
      `,
          )
          .join("") +
        `<div class="badge-add-tile" onclick="openModal('m-badge')">+</div>`;
    }

    // Awards table
    const tb = document.getElementById("badge-awards-tbody");
    if (!awardsData.awards?.length) {
      tb.innerHTML = `<tr><td colspan="5" class="empty">No awards yet</td></tr>`;
    } else {
      tb.innerHTML = awardsData.awards
        .map(
          (a) => `
        <tr>
          <td><span style="font-weight:600;">@${esc(a.user)}</span></td>
          <td>${esc(a.badge)}</td>
          <td>${esc(a.awardedBy)}</td>
          <td style="font-size:0.76rem;">${new Date(a.awardedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</td>
          <td style="font-size:0.76rem;color:var(--text-dim);">${esc(a.reason || "—")}</td>
        </tr>
      `,
        )
        .join("");
    }
  } catch (err) {
    toast("Failed to load badges: " + err.message, "err");
  }
}

function openAssignBadge(bid, name, emoji) {
  _currentBadgeId = bid;
  document.getElementById("m-assign-badge-title").textContent =
    `${emoji} Assign "${name}"`;
  document.getElementById("assign-uid").value = "";
  document.getElementById("assign-reason").value = "";
  openModal("m-assign-badge");
}

async function submitAssignBadge() {
  const uid = document.getElementById("assign-uid").value.trim();
  const reason = document.getElementById("assign-reason").value.trim();
  if (!uid || !_currentBadgeId) {
    toast("User ID is required", "err");
    return;
  }
  try {
    const d = await apiFetch(`/badges/${_currentBadgeId}/assign`, {
      method: "POST",
      body: JSON.stringify({ userId: uid, reason }),
    });
    toast(d.message, "ok");
    closeModal("m-assign-badge");
    if (_loaded["badges"]) {
      delete _loaded["badges"];
      loadBadges();
    }
  } catch (err) {
    toast(err.message, "err");
  }
}

async function submitCreateBadge() {
  const name = document.getElementById("mb-name").value.trim();
  const emoji = document.getElementById("mb-emoji").value.trim() || "🏅";
  const trigger = document.getElementById("mb-trigger").value;
  const criteria = document.getElementById("mb-criteria").value.trim();
  const points = Number(document.getElementById("mb-points").value) || 0;
  if (!name) {
    toast("Badge name is required", "err");
    return;
  }
  try {
    const d = await apiFetch("/badges", {
      method: "POST",
      body: JSON.stringify({
        name,
        emoji,
        trigger,
        criteria,
        pointsReward: points,
      }),
    });
    toast(d.message, "ok");
    closeModal("m-badge");
    if (_loaded["badges"]) {
      delete _loaded["badges"];
      loadBadges();
    }
  } catch (err) {
    toast(err.message, "err");
  }
}

/* ═══════════════════════════════════════════════════════════
   7. CHALLENGES
═══════════════════════════════════════════════════════════ */
async function loadChallenges() {
  try {
    const [listData, statsData] = await Promise.all([
      apiFetch("/challenges?status=active"),
      apiFetch("/challenges/stats"),
    ]);

    if (statsData.success) {
      document.getElementById("ch-active").textContent = statsData.stats.active;
      document.getElementById("ch-ended").textContent = statsData.stats.ended;
      document.getElementById("ch-participants").textContent =
        statsData.stats.totalParticipants;
    }

    const list = document.getElementById("challenges-list");
    if (!listData.challenges?.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">🏆</div>No active challenges. Launch one!</div>`;
      return;
    }

    list.innerHTML = listData.challenges
      .map((c) => {
        const endsStr = c.endsAt
          ? `· Ends ${new Date(c.endsAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`
          : "";
        return `
        <div class="ch-item">
          <div class="ch-ico">${esc(c.icon || "🎯")}</div>
          <div class="ch-info">
            <div class="ch-title">${esc(c.title)}</div>
            <div class="ch-meta">${esc(c.meta || "")} · ${(c.participants || []).length} participants ${endsStr}</div>
          </div>
          <div class="act-row">
            <button class="btn btn-danger btn-xs" onclick="endChallenge('${c._id}','${esc(c.title)}',this)">End</button>
          </div>
        </div>
      `;
      })
      .join("");
  } catch (err) {
    toast("Failed to load challenges: " + err.message, "err");
  }
}

async function endChallenge(cid, title, btn) {
  if (!confirm(`End challenge "${title}"?`)) return;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/challenges/${cid}/end`, { method: "PATCH" });
    toast("Challenge ended", "ok");
    loadChallenges();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = "End";
    btn.disabled = false;
  }
}

async function submitCreateChallenge() {
  const title = document.getElementById("mc-title").value.trim();
  const meta = document.getElementById("mc-meta").value.trim();
  const icon = document.getElementById("mc-icon").value.trim() || "🎯";
  const endsAt = document.getElementById("mc-ends").value;
  if (!title) {
    toast("Title is required", "err");
    return;
  }
  try {
    const d = await apiFetch("/challenges", {
      method: "POST",
      body: JSON.stringify({ title, meta, icon, endsAt: endsAt || null }),
    });
    toast(d.message, "ok");
    closeModal("m-challenge");
    if (_loaded["challenges"]) {
      delete _loaded["challenges"];
      loadChallenges();
    }
  } catch (err) {
    toast(err.message, "err");
  }
}

/* ═══════════════════════════════════════════════════════════
   8. ANNOUNCEMENTS
═══════════════════════════════════════════════════════════ */
async function loadAnnouncements() {
  try {
    const data = await apiFetch("/announcements?status=sent&limit=8");
    const list = document.getElementById("ann-list");
    if (!data.announcements?.length) {
      list.innerHTML = `<div class="empty">No announcements sent yet</div>`;
      return;
    }
    list.innerHTML = data.announcements
      .map(
        (a) => `
      <div class="ann-item">
        <div class="ann-top">
          <div class="ann-title">${esc(a.title)}</div>
          <div class="ann-time">${timeAgo(a.sentAt || a.createdAt)}</div>
        </div>
        <div class="ann-meta">${esc(a.audience)} · ${esc(a.type)} · <strong style="color:var(--low);">${a.seenCount} seen</strong></div>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    toast("Failed to load announcements: " + err.message, "err");
  }
}

async function sendAnnouncement() {
  const title = document.getElementById("ann-title").value.trim();
  const message = document.getElementById("ann-message").value.trim();
  const audience = document.getElementById("ann-audience").value;
  const type = document.getElementById("ann-type").value;
  if (!title || !message) {
    toast("Title and message are required", "err");
    return;
  }
  try {
    const d = await apiFetch("/announcements/send-now", {
      method: "POST",
      body: JSON.stringify({ title, message, audience, type }),
    });
    toast(d.message, "ok");
    document.getElementById("ann-title").value = "";
    document.getElementById("ann-message").value = "";
    if (_loaded["announcements"]) {
      delete _loaded["announcements"];
      loadAnnouncements();
    }
  } catch (err) {
    toast(err.message, "err");
  }
}

/* ═══════════════════════════════════════════════════════════
   9. ANALYTICS
═══════════════════════════════════════════════════════════ */
async function loadAnalytics() {
  try {
    const [statsData, postStats, helpers] = await Promise.all([
      apiFetch("/dashboard/stats"),
      apiFetch("/posts/stats"),
      apiFetch("/users/top-helpers"),
    ]);

    if (statsData.success) {
      const s = statsData.stats;
      const total = s.activePosts + s.resolvedPosts + s.closedPosts;
      const rate = total ? Math.round((s.resolvedPosts / total) * 100) : 0;
      document.getElementById("an-resolution").textContent = rate + "%";
      document.getElementById("an-total-users").textContent = s.totalUsers;
      document.getElementById("an-tutorials").textContent = s.tutorialsShared;
    }
    if (postStats.success) {
      const t = postStats.active + postStats.resolved + postStats.closed;
      document.getElementById("an-total-posts").textContent = t;
      const kpi = document.getElementById("an-post-kpi");
      kpi.innerHTML = [
        { lbl: "Active", val: postStats.active, color: "var(--high)" },
        { lbl: "Resolved", val: postStats.resolved, color: "var(--low)" },
        {
          lbl: "Closed",
          val: postStats.closed,
          color: "var(--text-dim)",
        },
        { lbl: "0-Reply", val: postStats.zeroReply, color: "var(--med)" },
      ]
        .map(
          ({ lbl, val, color }) => `
        <div class="kpi-item">
          <div class="kpi-top">
            <span class="kpi-lbl">${lbl}</span>
            <span class="kpi-val" style="color:${color}">${val}</span>
          </div>
          <div class="kpi-bar"><div class="kpi-fill" style="width:${t ? Math.round((val / t) * 100) : 0}%;background:${color}"></div></div>
        </div>
      `,
        )
        .join("");
    }
    if (helpers.success) {
      const medals = ["🥇", "🥈", "🥉"];
      document.getElementById("an-top-helpers").innerHTML = helpers.helpers
        .map(
          (u, i) => `
        <tr>
          <td style="font-size:1rem;">${medals[i] || String(i + 1)}</td>
          <td><div class="uc"><div class="av" style="background:var(--accent)">${initials(u)}</div><div class="u-name">@${esc(u.handle)}</div></div></td>
          <td style="font-weight:700;">${u.helpedCount}</td>
          <td>${u.points}</td>
          <td style="font-size:0.76rem;">${(u.badges || []).slice(0, 2).join(", ") || "—"}</td>
        </tr>
      `,
        )
        .join("");
    }
  } catch (err) {
    toast("Failed to load analytics: " + err.message, "err");
  }
}

/* ═══════════════════════════════════════════════════════════
   10. LOGS
═══════════════════════════════════════════════════════════ */
const logColors = {
  ban: "var(--high)",
  delete_post: "var(--med)",
  verify: "var(--blue)",
  promote: "var(--accent)",
  suspend: "var(--med)",
  reinstate: "var(--low)",
  assign_badge: "var(--purple)",
  create_challenge: "var(--accent)",
  send_announcement: "var(--blue)",
};

async function loadLogs() {
  try {
    const action = document.getElementById("log-action-filter")?.value || "";
    const [logsData, summaryData] = await Promise.all([
      apiFetch(`/logs?action=${action}&limit=15`),
      apiFetch("/logs/summary"),
    ]);

    const tl = document.getElementById("log-timeline");
    if (!logsData.logs?.length) {
      tl.innerHTML = `<div class="empty">No logs yet</div>`;
    } else {
      tl.innerHTML = logsData.logs
        .map(
          (l) => `
        <div class="tl-item">
          <div class="tl-dot" style="background:${logColors[l.action] || "var(--text-dim)"}">${(l.action[0] || "?").toUpperCase()}</div>
          <div class="tl-info">
            <div class="tl-title"><strong>${esc(l.admin)}</strong> — ${esc(l.detail || l.action)}</div>
            <div class="tl-meta">${timeAgo(l.createdAt)}</div>
          </div>
        </div>
      `,
        )
        .join("");
    }

    if (summaryData.success) {
      const s = summaryData.summary;
      document.getElementById("log-summary-kpi").innerHTML = [
        {
          lbl: "Total admin actions",
          val: s.totalActions,
          w: Math.min(100, s.totalActions),
          c: "var(--accent)",
        },
        {
          lbl: "Bans issued",
          val: s.bansIssued,
          w: Math.min(100, s.bansIssued * 10),
          c: "var(--high)",
        },
        {
          lbl: "Posts removed",
          val: s.postsRemoved,
          w: Math.min(100, s.postsRemoved),
          c: "var(--med)",
        },
        {
          lbl: "Users verified",
          val: s.usersVerified,
          w: Math.min(100, s.usersVerified),
          c: "var(--low)",
        },
      ]
        .map(
          ({ lbl, val, w, c }) => `
        <div class="kpi-item">
          <div class="kpi-top"><span class="kpi-lbl">${lbl}</span><span class="kpi-val">${val}</span></div>
          <div class="kpi-bar"><div class="kpi-fill" style="width:${w}%;background:${c}"></div></div>
        </div>
      `,
        )
        .join("");
    }
  } catch (err) {
    toast("Failed to load logs: " + err.message, "err");
  }
}

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Show admin handle in topbar from JWT
  try {
    const t = token();
    if (t) {
      const payload = JSON.parse(atob(t.split(".")[1]));
      if (payload.handle) {
        document.getElementById("tb-admin-name").textContent =
          "@" + payload.handle;
        document.getElementById("tb-admin-av").textContent = payload.handle
          .slice(0, 2)
          .toUpperCase();
      }
    }
  } catch (_) {}

  // Load dashboard immediately
  loadDashboard();
  _loaded["dashboard"] = true;
});
