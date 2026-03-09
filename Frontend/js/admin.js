/* ═══════════════════════════════════════════════════════════════════════════
   CRAFT-SOS  —  admin.js  (Frontend)
   Drop this file in:  Frontend/js/admin.js
   Reference in HTML:  <script src="/js/admin.js"></script>

   TOKEN SETUP:
     After logging in as admin, run once in browser console:
       localStorage.setItem("adminToken", "your-jwt-here")
     The JWT must have payload: { id, handle, role }
     where role === "admin" or "moderator"

   API BASE:  All calls go to  /api/admin/*  (same origin, any port)
═══════════════════════════════════════════════════════════════════════════ */

/* ─── Config ─────────────────────────────────────────────── */
const API = "/api/admin";

/* ─── Auth helpers ───────────────────────────────────────── */
const getToken = () => localStorage.getItem("adminToken") || "";
const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: "Bearer " + getToken(),
});

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { ...authHeader(), ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

/* ─── Toast notifications ────────────────────────────────── */
function toast(msg, type = "ok") {
  let tc = document.getElementById("toast-container");
  if (!tc) {
    tc = document.createElement("div");
    tc.id = "toast-container";
    tc.style.cssText =
      "position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;";
    document.body.appendChild(tc);
  }
  const el = document.createElement("div");
  const icon = type === "ok" ? "✓" : type === "err" ? "✕" : "ℹ";
  const bg = type === "ok" ? "#3d7a3d" : type === "err" ? "#c0432a" : "#3a6ea8";
  el.style.cssText = `padding:10px 16px;background:#fff;border-radius:10px;
    border:1px solid #d8dfc8;box-shadow:0 4px 20px rgba(0,0,0,.12);
    font-size:0.83rem;color:#2c2c2c;display:flex;align-items:center;gap:8px;
    border-left:3px solid ${bg};max-width:300px;animation:fadeUp .25s ease both;`;
  el.innerHTML = `<span style="color:${bg};font-weight:700;">${icon}</span> ${esc(String(msg))}`;
  tc.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
  }, 2800);
  setTimeout(() => el.remove(), 3200);
}

/* ─── Utility helpers ────────────────────────────────────── */
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

function timeAgo(d) {
  if (!d) return "—";
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

// ─── MIGRATION-SAFE status derivation ────────────────────
// Old documents may lack isActive/isEmailVerified entirely.
// - isActive missing or true  → treat as active
// - isActive === false        → suspended
// - isEmailVerified missing or false → pending (if not suspended)
function userStatus(u) {
  if (u.isActive === false) return "suspended"; // ← explicit false only
  if (u.isEmailVerified !== true) return "pending"; // ← not yet verified
  return "active";
}

function statusPill(status) {
  const map = {
    active: "p-green",
    resolved: "p-green",
    sent: "p-green",
    pending: "p-blue",
    draft: "p-blue",
    suspended: "p-amber",
    closed: "p-amber",
    banned: "p-red",
    flagged: "p-red",
  };
  return `<span class="pill ${map[status] || "p-amber"}">${esc(status)}</span>`;
}

function rolePill(role) {
  const map = { admin: "r-admin", moderator: "r-mod", user: "r-user" };
  return `<span class="role-pill ${map[role] || "r-user"}">${esc(role || "user")}</span>`;
}

function initials(u) {
  if (u.handle) return u.handle.slice(0, 2).toUpperCase();
  if (u.firstName)
    return ((u.firstName[0] || "") + (u.lastName?.[0] || "")).toUpperCase();
  return "??";
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */
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

// Track which sections have been loaded already
const _loaded = {};

// Section → loader function map (populated after functions are defined)
const LOADERS = {};

function goSection(name, navEl) {
  // Hide all sections
  ALL_SECTIONS.forEach((s) => {
    const el = document.getElementById("s-" + s);
    if (el) el.style.display = "none";
  });

  // Show target section
  const target = document.getElementById("s-" + name);
  if (target) {
    target.style.display = "";
    target.style.animation = "fadeUp .3s ease both";
  }

  // Update nav active state
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
  if (navEl) {
    navEl.classList.add("active");
  } else {
    // Find the matching nav item by its onclick attribute
    document.querySelectorAll(".nav-item").forEach((i) => {
      const oc = i.getAttribute("onclick") || "";
      if (oc.includes("'" + name + "'") || oc.includes('"' + name + '"')) {
        i.classList.add("active");
      }
    });
  }

  window.scrollTo({ top: 0, behavior: "smooth" });

  // Auto-load data on first visit
  if (!_loaded[name] && LOADERS[name]) {
    _loaded[name] = true;
    LOADERS[name]().catch((err) => {
      // Reset so user can retry by navigating away and back
      _loaded[name] = false;
      toast(err.message, "err");
    });
  }
}

/* ─── Modals ─────────────────────────────────────────────── */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("on");
    document.body.style.overflow = "hidden";
  }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove("on");
    document.body.style.overflow = "";
  }
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document
      .querySelectorAll(".modal-ov.on")
      .forEach((m) => m.classList.remove("on"));
    document.body.style.overflow = "";
  }
});

/* ─── Toggle switches ────────────────────────────────────── */
function togBtn(btn) {
  btn.classList.toggle("on");
  btn.classList.toggle("off");
}

/* ─── Global search ──────────────────────────────────────── */
function globalSearch(q) {
  if (!q || q.length < 2) return;
  const ql = q.toLowerCase();
  if (ql.includes("user")) goSection("users", null);
  else if (ql.includes("report")) goSection("reports", null);
  else if (ql.includes("post") || ql.includes("sos")) goSection("posts", null);
  else if (ql.includes("badge")) goSection("badges", null);
  else if (ql.includes("challenge")) goSection("challenges", null);
  else if (ql.includes("log")) goSection("logs", null);
}

/* ─── Tag / keyword helpers ──────────────────────────────── */
function addTagFn() {
  const t = prompt("New tag (without #):");
  if (!t?.trim()) return;
  const list = document.getElementById("tag-list");
  if (!list) return;
  const chip = document.createElement("div");
  chip.className = "tag-chip";
  chip.innerHTML = `#${esc(t.trim())} <span>0</span>
    <button class="tag-x" onclick="this.closest('.tag-chip').remove()">✕</button>`;
  list.appendChild(chip);
}
function addKeyword() {
  const t = prompt("New blocked keyword:");
  if (!t?.trim()) return;
  const list = document.getElementById("keyword-list");
  if (!list) return;
  const chip = document.createElement("div");
  chip.className = "tag-chip";
  chip.innerHTML = `${esc(t.trim())} <span>0 hits</span>
    <button class="tag-x" onclick="this.closest('.tag-chip').remove()">✕</button>`;
  list.appendChild(chip);
}

/* ═══════════════════════════════════════════════════════════
   1. DASHBOARD
═══════════════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const [statsData, recentData, awardsData] = await Promise.allSettled([
      apiFetch("/dashboard/stats"),
      apiFetch("/dashboard/recent"),
      apiFetch("/badges/recent-awards"),
    ]);

    if (statsData.status === "fulfilled" && statsData.value.success) {
      renderDashStats(statsData.value);
    } else {
      console.error("[Dashboard/stats]", statsData.reason?.message);
      toast("Stats failed to load — check server logs", "err");
    }

    if (recentData.status === "fulfilled" && recentData.value.success) {
      renderDashRecent(recentData.value);
    }

    if (awardsData.status === "fulfilled" && awardsData.value.success) {
      renderDashAwards(awardsData.value.awards);
    }
  } catch (err) {
    console.error("[loadDashboard]", err);
    toast("Dashboard load error: " + err.message, "err");
  }
}

function renderDashStats(d) {
  const s = d.stats;

  // Update sidebar badges
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl("nb-users", s.totalUsers);
  setEl("nb-posts", s.activePosts);
  setEl("nb-verify", s.pendingVerification);

  // Stat cards
  const cards = [
    {
      icon: "👥",
      bg: "--blue-bg",
      color: "--blue",
      val: s.totalUsers,
      label: "Total Users",
      sub: `+${s.newSignupsToday} today`,
    },
    {
      icon: "⚡",
      bg: "--high-bg",
      color: "--high",
      val: s.activePosts,
      label: "Active SOS Posts",
      sub: `${s.zeroReplyPosts} need replies`,
    },
    {
      icon: "✅",
      bg: "--low-bg",
      color: "--low",
      val: s.resolvedPosts,
      label: "SOS Resolved",
      sub: `${s.closedPosts} closed`,
    },
    {
      icon: "📬",
      bg: "--accent-pale",
      color: "--accent",
      val: s.totalComments,
      label: "Total Comments",
      sub: "across all posts",
    },
    {
      icon: "🔔",
      bg: "--purple-bg",
      color: "--purple",
      val: s.pendingVerification,
      label: "Pending Verification",
      sub: "need email verify",
    },
    {
      icon: "📚",
      bg: "--low-bg",
      color: "--low",
      val: s.tutorialsShared,
      label: "Tutorials Shared",
      sub: "community resources",
    },
  ];

  const sg = document.getElementById("dash-stats");
  if (sg) {
    sg.innerHTML = cards
      .map(
        (c, i) => `
      <div class="sc" style="animation-delay:${i * 0.05}s">
        <div class="sc-top">
          <div class="sc-ico" style="background:var(${c.bg});color:var(${c.color});">${c.icon}</div>
        </div>
        <div class="sc-val">${Number(c.val ?? 0).toLocaleString()}</div>
        <div class="sc-label">${c.label}</div>
        <div class="sc-sub">${c.sub}</div>
      </div>
    `,
      )
      .join("");
  }

  // Bar chart
  const chart = document.getElementById("dash-chart");
  if (chart) {
    if (d.sevenDayChart?.length) {
      const max = Math.max(...d.sevenDayChart.map((x) => x.count), 1);
      chart.innerHTML = d.sevenDayChart
        .map(
          (x) => `
        <div class="bar-wrap">
          <div class="bar" style="height:${Math.max(6, (x.count / max) * 100)}%;background:var(--accent);"></div>
          <div class="bar-lbl">${esc(x._id)}</div>
        </div>
      `,
        )
        .join("");
    } else {
      chart.innerHTML = `<div style="width:100%;text-align:center;color:var(--text-dim);padding:20px 0;font-size:0.82rem;">No SOS posts in last 7 days</div>`;
    }
  }

  // Metrics strip
  const metrics = document.getElementById("dash-metrics");
  if (metrics) {
    const total =
      (s.activePosts || 0) + (s.resolvedPosts || 0) + (s.closedPosts || 0);
    const rate = total ? Math.round((s.resolvedPosts / total) * 100) : 0;
    metrics.innerHTML = `
      <div class="metric-tile"><div class="m-val">${total}</div><div class="m-lbl">Total Posts</div></div>
      <div class="metric-tile"><div class="m-val">${rate}%</div><div class="m-lbl">Resolution Rate</div></div>
      <div class="metric-tile"><div class="m-val">${s.zeroReplyPosts || 0}</div><div class="m-lbl">Need Replies</div><div class="m-trend" style="color:var(--high)">Urgent</div></div>
    `;
  }

  // Skills donut
  const skillEl = document.getElementById("dash-skills");
  if (skillEl) {
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
        <div style="font-size:0.82rem;color:var(--text-mid);display:flex;flex-direction:column;gap:10px;flex:1;padding:4px;">
          ${d.skillBreakdown
            .map(
              (s, i) => `
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:9px;height:9px;border-radius:50%;background:${colors[i % colors.length]};flex-shrink:0;"></div>
              <span style="flex:1;">${esc(s._id)}</span>
              <strong>${s.count}</strong>
            </div>
          `,
            )
            .join("")}
        </div>`;
    } else {
      skillEl.innerHTML = `<div style="padding:20px;color:var(--text-dim);font-size:0.82rem;">No skill data yet — users need skills in their profile</div>`;
    }
  }
}

function renderDashRecent(d) {
  const ub = document.getElementById("dash-recent-users");
  if (ub) {
    if (!d.recentUsers?.length) {
      ub.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-dim);">No recent signups</td></tr>`;
    } else {
      ub.innerHTML = d.recentUsers
        .map(
          (u) => `
        <tr>
          <td><div class="uc">
            <div class="av" style="background:var(--accent)">${initials(u)}</div>
            <div><div class="u-name">@${esc(u.handle)}</div><div class="u-sub">${timeAgo(u.createdAt)}</div></div>
          </div></td>
          <td>${statusPill(userStatus(u))}</td>
          <td>
            ${
              u.isEmailVerified !== true
                ? `<button class="btn btn-primary btn-xs" onclick="quickVerify('${u._id}',this)">Verify</button>`
                : `<button class="btn btn-ghost btn-xs" onclick="openUserDetail('${u._id}')">View</button>`
            }
          </td>
        </tr>
      `,
        )
        .join("");
    }
  }

  const pb = document.getElementById("dash-recent-posts");
  if (pb) {
    if (!d.recentPosts?.length) {
      pb.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-dim);">No active posts</td></tr>`;
    } else {
      pb.innerHTML = d.recentPosts
        .map(
          (p) => `
        <tr>
          <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;">${esc(p.title)}</td>
          <td>${statusPill(p.status)}</td>
          <td>${p.replyCount ?? 0}</td>
        </tr>
      `,
        )
        .join("");
    }
  }
}

function renderDashAwards(awards) {
  const tb = document.getElementById("dash-recent-awards");
  if (!tb) return;
  if (!awards?.length) {
    tb.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-dim);">No awards yet</td></tr>`;
    return;
  }
  tb.innerHTML = awards
    .slice(0, 5)
    .map(
      (a) => `
    <tr>
      <td><strong>@${esc(a.user || "—")}</strong></td>
      <td>${esc(a.badge || "—")}</td>
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
    const search = (document.getElementById("user-search")?.value || "").trim();
    const role = document.getElementById("user-role-filter")?.value || "";
    const status = document.getElementById("user-status-filter")?.value || "";

    const qs = new URLSearchParams({ page: _userPage, limit: 20 });
    if (search) qs.set("search", search);
    if (role) qs.set("role", role);
    if (status) qs.set("status", status);

    const data = await apiFetch(`/users?${qs}`);
    if (!data.success) throw new Error(data.message);

    // Summary counts
    const [activeD, pendingD, suspendedD] = await Promise.allSettled([
      apiFetch("/users?status=active&limit=1"),
      apiFetch("/users?status=pending&limit=1"),
      apiFetch("/users?status=suspended&limit=1"),
    ]);
    const setEl = (id, d) => {
      const el = document.getElementById(id);
      if (el)
        el.textContent =
          d.status === "fulfilled" ? (d.value.total ?? "—") : "—";
    };
    setEl("ust-active", activeD);
    setEl("ust-pending", pendingD);
    setEl("ust-suspended", suspendedD);

    const totalLabel = document.getElementById("user-total-label");
    if (totalLabel) totalLabel.textContent = `${data.total} total users`;

    const pagerLabel = document.getElementById("user-pager-label");
    if (pagerLabel)
      pagerLabel.textContent = `Showing ${(_userPage - 1) * 20 + 1}–${Math.min(_userPage * 20, data.total)} of ${data.total}`;

    const prevBtn = document.getElementById("user-prev");
    const nextBtn = document.getElementById("user-next");
    if (prevBtn) prevBtn.disabled = _userPage <= 1;
    if (nextBtn) nextBtn.disabled = _userPage >= data.pages;

    const tb = document.getElementById("user-tbody");
    if (!tb) return;
    if (!data.users.length) {
      tb.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-dim);">No users found</td></tr>`;
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
          <td><div class="act-row">
            <button class="btn btn-ghost btn-xs" onclick="openUserDetail('${u._id}')">View</button>
            ${
              st !== "suspended"
                ? `<button class="btn btn-amber btn-xs" onclick="suspendUser('${u._id}','${esc(u.handle)}',this)">Suspend</button>`
                : `<button class="btn btn-ghost btn-xs" onclick="reinstateUser('${u._id}','${esc(u.handle)}',this)">Reinstate</button>`
            }
            ${
              u.isEmailVerified !== true
                ? `<button class="btn btn-primary btn-xs" onclick="quickVerify('${u._id}',this)">Verify</button>`
                : ""
            }
          </div></td>
        </tr>
      `;
      })
      .join("");
  } catch (err) {
    console.error("[loadUsers]", err);
    toast("Failed to load users: " + err.message, "err");
  }
}

function searchUsers() {
  _userPage = 1;
  loadUsers();
}
function filterUsersByStatus() {
  _userPage = 1;
  loadUsers();
}
function userPage(dir) {
  _userPage = Math.max(1, _userPage + dir);
  loadUsers();
}

async function quickVerify(uid, btn) {
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/users/${uid}/verify`, { method: "PATCH" });
    toast("User verified ✓", "ok");
    loadUsers();
    _loaded["dashboard"] = false;
    loadDashboard();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
    btn.disabled = false;
  }
}

async function suspendUser(uid, handle, btn) {
  if (!confirm(`Suspend @${handle}?`)) return;
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/users/${uid}/suspend`, {
      method: "PATCH",
      body: JSON.stringify({ reason: "Admin action" }),
    });
    toast(`@${handle} suspended`, "ok");
    loadUsers();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
    btn.disabled = false;
  }
}

async function reinstateUser(uid, handle, btn) {
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/users/${uid}/reinstate`, { method: "PATCH" });
    toast(`@${handle} reinstated ✓`, "ok");
    loadUsers();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
    btn.disabled = false;
  }
}

async function openUserDetail(uid) {
  openModal("m-user");
  const mc = document.getElementById("m-user-content");
  if (!mc) return;
  mc.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-dim);">⏳ Loading…</div>`;
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
        <div style="background:rgba(255,255,255,.5);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-weight:700;font-size:1.3rem;">${u.helpedCount ?? 0}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);">SOS Helped</div>
        </div>
        <div style="background:rgba(255,255,255,.5);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-weight:700;font-size:1.3rem;">${u.points ?? 0}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);">Points</div>
        </div>
        <div style="background:rgba(255,255,255,.5);border-radius:10px;padding:12px;text-align:center;">
          <div style="font-weight:700;font-size:1.3rem;">${(u.badges || []).length}</div>
          <div style="font-size:0.72rem;color:var(--text-dim);">Badges</div>
        </div>
      </div>
      ${(u.skills || []).length ? `<p style="margin-bottom:12px;font-size:0.8rem;color:var(--text-dim);">Skills: ${u.skills.map(esc).join(", ")}</p>` : ""}
      <div style="display:flex;gap:7px;flex-wrap:wrap;">
        ${
          st !== "suspended"
            ? `<button class="btn btn-amber btn-sm" onclick="suspendUser('${u._id}','${esc(u.handle)}',this);closeModal('m-user')">Suspend</button>
             <button class="btn btn-danger btn-sm" onclick="banUserDirect('${u._id}','${esc(u.handle)}')">Ban</button>`
            : `<button class="btn btn-ghost btn-sm" onclick="reinstateUser('${u._id}','${esc(u.handle)}',this);closeModal('m-user')">Reinstate</button>`
        }
        ${
          u.isEmailVerified !== true
            ? `<button class="btn btn-primary btn-sm" onclick="quickVerify('${u._id}',this);closeModal('m-user')">✓ Verify</button>`
            : ""
        }
        <button class="btn btn-ghost btn-sm" onclick="closeModal('m-user')">Close</button>
      </div>`;
  } catch (err) {
    if (mc)
      mc.innerHTML = `<div style="text-align:center;padding:32px;color:var(--high);">⚠️ ${esc(err.message)}</div>`;
  }
}

async function banUserDirect(uid, handle) {
  if (!confirm(`PERMANENTLY BAN @${handle}?`)) return;
  try {
    await apiFetch(`/users/${uid}/ban`, {
      method: "PATCH",
      body: JSON.stringify({ reason: "Admin ban" }),
    });
    toast(`@${handle} banned`, "ok");
    closeModal("m-user");
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
    const search = (document.getElementById("post-search")?.value || "").trim();
    const status = document.getElementById("post-status-filter")?.value || "";
    const type = document.getElementById("post-type-filter")?.value || "";

    const qs = new URLSearchParams({ page: _postPage, limit: 20 });
    if (search) qs.set("search", search);
    if (status) qs.set("status", status);
    if (type) qs.set("type", type);

    const [postsData, statsData] = await Promise.allSettled([
      apiFetch(`/posts?${qs}`),
      apiFetch("/posts/stats"),
    ]);

    if (statsData.status === "fulfilled" && statsData.value.success) {
      const st = statsData.value;
      const setEl = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      setEl("pst-active", st.active);
      setEl("pst-resolved", st.resolved);
      setEl("pst-closed", st.closed);
      setEl("pst-zero", st.zeroReply);
      setEl("nb-posts", st.active);
    }

    if (postsData.status !== "fulfilled" || !postsData.value.success) {
      throw new Error(postsData.reason?.message || "Failed to load posts");
    }

    const data = postsData.value;
    const totalLabel = document.getElementById("post-total-label");
    if (totalLabel) totalLabel.textContent = `${data.total} total posts`;

    const pagerLabel = document.getElementById("post-pager-label");
    if (pagerLabel)
      pagerLabel.textContent = `Showing ${(_postPage - 1) * 20 + 1}–${Math.min(_postPage * 20, data.total)} of ${data.total}`;

    const prevBtn = document.getElementById("post-prev");
    const nextBtn = document.getElementById("post-next");
    if (prevBtn) prevBtn.disabled = _postPage <= 1;
    if (nextBtn) nextBtn.disabled = _postPage >= data.pages;

    const tb = document.getElementById("post-tbody");
    if (!tb) return;
    if (!data.posts.length) {
      tb.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-dim);">No posts found</td></tr>`;
      return;
    }

    const typeLabel = {
      sos: "SOS 🆘",
      tut: "Tutorial 📚",
      com: "Community 💬",
      res: "Resource 📦",
    };
    tb.innerHTML = data.posts
      .map(
        (p) => `
      <tr>
        <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;">${esc(p.title)}</td>
        <td style="font-size:0.79rem;">@${esc(p.author?.handle || "—")}</td>
        <td><span class="pill p-blue" style="font-size:0.7rem;">${typeLabel[p.type] || esc(p.type)}</span></td>
        <td>${p.replyCount ?? 0}</td>
        <td>${statusPill(p.status)}</td>
        <td><div class="act-row">
          ${
            p.status === "active"
              ? `<button class="btn btn-ghost btn-xs" onclick="resolvePost('${p._id}',this)">Resolve</button>
               <button class="btn btn-amber btn-xs" onclick="closePost('${p._id}',this)">Close</button>`
              : `<button class="btn btn-ghost btn-xs" onclick="reopenPost('${p._id}',this)">Reopen</button>`
          }
          <button class="btn btn-danger btn-xs" onclick="deletePost('${p._id}','${esc(p.title.slice(0, 30))}',this)">Delete</button>
        </div></td>
      </tr>
    `,
      )
      .join("");
  } catch (err) {
    console.error("[loadPosts]", err);
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
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/posts/${pid}/resolve`, { method: "PATCH" });
    toast("Post resolved ✓", "ok");
    loadPosts();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
    btn.disabled = false;
  }
}
async function closePost(pid, btn) {
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/posts/${pid}/close`, { method: "PATCH" });
    toast("Post closed", "ok");
    loadPosts();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
    btn.disabled = false;
  }
}
async function reopenPost(pid, btn) {
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/posts/${pid}/reopen`, { method: "PATCH" });
    toast("Post reopened", "ok");
    loadPosts();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
    btn.disabled = false;
  }
}
async function deletePost(pid, title, btn) {
  if (!confirm(`Delete "${title}…"? This is permanent.`)) return;
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/posts/${pid}`, { method: "DELETE" });
    toast("Post deleted", "ok");
    const row = btn.closest("tr");
    if (row) {
      row.style.opacity = "0";
      row.style.transition = "opacity .3s";
      setTimeout(() => row.remove(), 320);
    }
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
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

    const setEl = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    setEl("nb-reports", pending);
    setEl("tb-reports-count", pending);
    setEl("report-pending-pill", `${pending} pending`);
    setEl("rc-spam", counts.spam || 0);
    setEl("rc-harassment", counts.harassment || 0);
    setEl("rc-scam", counts.scam || 0);

    const list = document.getElementById("reports-list");
    if (!list) return;
    if (!data.reports.length) {
      list.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-dim);">✅ No pending reports — all clear!</div>`;
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
          <div class="rep-meta">Reported ${timeAgo(r.createdAt)}</div>
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
    console.error("[loadReports]", err);
    toast("Failed to load reports: " + err.message, "err");
  }
}

async function resolveReport(rid, action, btn) {
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/reports/${rid}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ action }),
    });
    toast(`Report: ${action.replace(/_/g, " ")} ✓`, "ok");
    const row = document.getElementById("report-" + rid);
    if (row) {
      row.style.opacity = "0";
      row.style.transition = "opacity .3s";
      setTimeout(() => row.remove(), 320);
    }
    loadReports();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
    btn.disabled = false;
  }
}

async function dismissAllReports() {
  if (!confirm("Dismiss ALL pending reports?")) return;
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
    if (!data.success) throw new Error(data.message);

    const setEl = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    setEl("nb-verify", data.total);
    setEl("verify-count-pill", `${data.total} pending`);

    const list = document.getElementById("verify-list");
    if (!list) return;
    if (!data.queue?.length) {
      list.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-dim);">✅ Verification queue is empty!</div>`;
      return;
    }

    list.innerHTML = data.queue
      .map(
        (u) => `
      <div class="v-item" id="verify-${u._id}">
        <div class="av" style="background:var(--accent)">${initials(u)}</div>
        <div class="v-info">
          <div class="v-name">@${esc(u.handle)}</div>
          <div class="v-sub">
            ${(u.skills || []).join(" · ") || "No skills listed"} ·
            ${esc(u.location || "Location unknown")} ·
            Applied ${timeAgo(u.createdAt)}
          </div>
        </div>
        <span class="v-type">${esc(u.communityRole || "user")}</span>
        <div class="act-row">
          <button class="btn btn-primary btn-xs" onclick="verifyQueueUser('${u._id}','${esc(u.handle)}',this)">✓ Approve</button>
          <button class="btn btn-danger btn-xs"  onclick="rejectQueueUser('${u._id}','${esc(u.handle)}',this)">Reject</button>
        </div>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    console.error("[loadVerification]", err);
    toast("Failed to load queue: " + err.message, "err");
  }
}

async function verifyQueueUser(uid, handle, btn) {
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/users/${uid}/verify`, { method: "PATCH" });
    toast(`@${handle} verified ✓`, "ok");
    document.getElementById("verify-" + uid)?.remove();
    loadVerification();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
    btn.disabled = false;
  }
}

async function rejectQueueUser(uid, handle, btn) {
  const note = prompt(`Reason for rejecting @${handle}?`) || "";
  const orig = btn.textContent;
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
    btn.textContent = orig;
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════════════════════
   6. BADGES
═══════════════════════════════════════════════════════════ */
let _currentBadgeId = null;

async function loadBadges() {
  try {
    const [badgesData, awardsData] = await Promise.allSettled([
      apiFetch("/badges"),
      apiFetch("/badges/recent-awards"),
    ]);

    if (badgesData.status === "fulfilled" && badgesData.value.success) {
      const badges = badgesData.value.badges;
      const countLabel = document.getElementById("badge-count-label");
      if (countLabel) countLabel.textContent = `${badges.length} active`;

      const grid = document.getElementById("badge-grid");
      if (grid) {
        grid.innerHTML =
          badges
            .map(
              (b) => `
          <div class="badge-tile">
            <div class="badge-em">${esc(b.emoji || "🏅")}</div>
            <div class="badge-name">${esc(b.name)}</div>
            <div class="badge-cnt">${b.holderCount} holders · ${esc(b.trigger)}</div>
            <div class="act-row" style="justify-content:center;margin-top:8px;">
              <button class="btn btn-primary btn-xs" onclick="openAssignBadge('${b._id}','${esc(b.name)}','${esc(b.emoji || "🏅")}')">Assign</button>
            </div>
          </div>
        `,
            )
            .join("") +
          `<div class="badge-add-tile" onclick="openModal('m-badge')">+</div>`;
      }
    }

    if (awardsData.status === "fulfilled" && awardsData.value.success) {
      const tb = document.getElementById("badge-awards-tbody");
      const awards = awardsData.value.awards;
      if (tb) {
        if (!awards?.length) {
          tb.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-dim);">No awards yet</td></tr>`;
        } else {
          tb.innerHTML = awards
            .map(
              (a) => `
            <tr>
              <td><strong>@${esc(a.user || "—")}</strong></td>
              <td>${esc(a.badge || "—")}</td>
              <td>${esc(a.awardedBy || "—")}</td>
              <td style="font-size:0.76rem;">${a.awardedAt ? new Date(a.awardedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : "—"}</td>
              <td style="font-size:0.76rem;color:var(--text-dim);">${esc(a.reason || "—")}</td>
            </tr>
          `,
            )
            .join("");
        }
      }
    }
  } catch (err) {
    console.error("[loadBadges]", err);
    toast("Failed to load badges: " + err.message, "err");
  }
}

function openAssignBadge(bid, name, emoji) {
  _currentBadgeId = bid;
  const title = document.getElementById("m-assign-badge-title");
  if (title) title.textContent = `${emoji} Assign "${name}"`;
  const uidEl = document.getElementById("assign-uid");
  const rsnEl = document.getElementById("assign-reason");
  if (uidEl) uidEl.value = "";
  if (rsnEl) rsnEl.value = "";
  openModal("m-assign-badge");
}

async function submitAssignBadge() {
  const uid = (document.getElementById("assign-uid")?.value || "").trim();
  const reason = (document.getElementById("assign-reason")?.value || "").trim();
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
    _loaded["badges"] = false;
    loadBadges();
  } catch (err) {
    toast(err.message, "err");
  }
}

async function submitCreateBadge() {
  const name = (document.getElementById("mb-name")?.value || "").trim();
  const emoji = (document.getElementById("mb-emoji")?.value || "🏅").trim();
  const trigger = document.getElementById("mb-trigger")?.value || "manual";
  const criteria = (document.getElementById("mb-criteria")?.value || "").trim();
  const points = Number(document.getElementById("mb-points")?.value) || 0;
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
    _loaded["badges"] = false;
    loadBadges();
  } catch (err) {
    toast(err.message, "err");
  }
}

/* ═══════════════════════════════════════════════════════════
   7. CHALLENGES
═══════════════════════════════════════════════════════════ */
async function loadChallenges() {
  try {
    const [listData, statsData] = await Promise.allSettled([
      apiFetch("/challenges?status=active"),
      apiFetch("/challenges/stats"),
    ]);

    if (statsData.status === "fulfilled" && statsData.value.success) {
      const st = statsData.value.stats;
      const setEl = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      setEl("ch-active", st.active);
      setEl("ch-ended", st.ended);
      setEl("ch-participants", st.totalParticipants);
    }

    const list = document.getElementById("challenges-list");
    if (!list) return;

    if (listData.status !== "fulfilled" || !listData.value.challenges?.length) {
      list.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-dim);">🏆 No active challenges — launch one!</div>`;
      return;
    }

    list.innerHTML = listData.value.challenges
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
    console.error("[loadChallenges]", err);
    toast("Failed to load challenges: " + err.message, "err");
  }
}

async function endChallenge(cid, title, btn) {
  if (!confirm(`End "${title}"?`)) return;
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    await apiFetch(`/challenges/${cid}/end`, { method: "PATCH" });
    toast("Challenge ended", "ok");
    _loaded["challenges"] = false;
    loadChallenges();
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
    btn.disabled = false;
  }
}

async function submitCreateChallenge() {
  const title = (document.getElementById("mc-title")?.value || "").trim();
  const meta = (document.getElementById("mc-meta")?.value || "").trim();
  const icon = (document.getElementById("mc-icon")?.value || "🎯").trim();
  const endsAt = document.getElementById("mc-ends")?.value || null;
  if (!title) {
    toast("Title is required", "err");
    return;
  }
  try {
    const d = await apiFetch("/challenges", {
      method: "POST",
      body: JSON.stringify({ title, meta, icon, endsAt }),
    });
    toast(d.message, "ok");
    closeModal("m-challenge");
    _loaded["challenges"] = false;
    loadChallenges();
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
    if (!list) return;
    if (!data.announcements?.length) {
      list.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-dim);">No announcements sent yet</div>`;
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
        <div class="ann-meta">${esc(a.audience)} · ${esc(a.type)} · <strong style="color:var(--low);">${a.seenCount || 0} seen</strong></div>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    console.error("[loadAnnouncements]", err);
    toast("Failed to load announcements: " + err.message, "err");
  }
}

async function sendAnnouncement() {
  const title = (document.getElementById("ann-title")?.value || "").trim();
  const message = (document.getElementById("ann-message")?.value || "").trim();
  const audience = document.getElementById("ann-audience")?.value || "all";
  const type = document.getElementById("ann-type")?.value || "announcement";
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
    const titleEl = document.getElementById("ann-title");
    const msgEl = document.getElementById("ann-message");
    if (titleEl) titleEl.value = "";
    if (msgEl) msgEl.value = "";
    _loaded["announcements"] = false;
    loadAnnouncements();
  } catch (err) {
    toast(err.message, "err");
  }
}

/* ═══════════════════════════════════════════════════════════
   9. ANALYTICS
═══════════════════════════════════════════════════════════ */
async function loadAnalytics() {
  try {
    const [statsData, postStats, helpersData] = await Promise.allSettled([
      apiFetch("/dashboard/stats"),
      apiFetch("/posts/stats"),
      apiFetch("/users/top-helpers"),
    ]);

    if (statsData.status === "fulfilled" && statsData.value.success) {
      const s = statsData.value.stats;
      const total =
        (s.activePosts || 0) + (s.resolvedPosts || 0) + (s.closedPosts || 0);
      const rate = total ? Math.round((s.resolvedPosts / total) * 100) : 0;
      const setEl = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      setEl("an-resolution", rate + "%");
      setEl("an-total-users", s.totalUsers);
      setEl("an-tutorials", s.tutorialsShared);
      setEl("an-total-posts", total);
    }

    if (postStats.status === "fulfilled" && postStats.value.success) {
      const st = postStats.value;
      const t = st.active + st.resolved + st.closed;
      const kpi = document.getElementById("an-post-kpi");
      if (kpi) {
        kpi.innerHTML = [
          { lbl: "Active", val: st.active, c: "var(--high)" },
          { lbl: "Resolved", val: st.resolved, c: "var(--low)" },
          { lbl: "Closed", val: st.closed, c: "var(--text-dim)" },
          { lbl: "0-Reply", val: st.zeroReply, c: "var(--med)" },
        ]
          .map(
            ({ lbl, val, c }) => `
          <div class="kpi-item">
            <div class="kpi-top"><span class="kpi-lbl">${lbl}</span><span class="kpi-val" style="color:${c}">${val}</span></div>
            <div class="kpi-bar"><div class="kpi-fill" style="width:${t ? Math.round((val / t) * 100) : 0}%;background:${c}"></div></div>
          </div>
        `,
          )
          .join("");
      }
    }

    if (helpersData.status === "fulfilled" && helpersData.value.success) {
      const medals = ["🥇", "🥈", "🥉"];
      const tb = document.getElementById("an-top-helpers");
      if (tb) {
        tb.innerHTML = helpersData.value.helpers
          .map(
            (u, i) => `
          <tr>
            <td style="font-size:1rem;">${medals[i] || i + 1}</td>
            <td><div class="uc"><div class="av" style="background:var(--accent)">${initials(u)}</div>
              <div class="u-name">@${esc(u.handle)}</div></div></td>
            <td style="font-weight:700;">${u.helpedCount || 0}</td>
            <td>${u.points || 0}</td>
            <td style="font-size:0.76rem;">${(u.badges || []).slice(0, 2).join(", ") || "—"}</td>
          </tr>
        `,
          )
          .join("");
      }
    }
  } catch (err) {
    console.error("[loadAnalytics]", err);
    toast("Analytics load failed: " + err.message, "err");
  }
}

/* ═══════════════════════════════════════════════════════════
   10. ACTIVITY LOGS
═══════════════════════════════════════════════════════════ */
const LOG_COLORS = {
  ban: "var(--high)",
  delete_post: "var(--med)",
  verify: "var(--blue)",
  promote: "var(--accent)",
  suspend: "var(--med)",
  reinstate: "var(--low)",
  assign_badge: "var(--purple)",
  create_challenge: "var(--accent)",
};

async function loadLogs() {
  try {
    const action = document.getElementById("log-action-filter")?.value || "";
    const [logsData, summaryData] = await Promise.allSettled([
      apiFetch(`/logs?action=${action}&limit=15`),
      apiFetch("/logs/summary"),
    ]);

    const tl = document.getElementById("log-timeline");
    if (tl) {
      if (logsData.status !== "fulfilled" || !logsData.value.logs?.length) {
        tl.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-dim);">No logs yet</div>`;
      } else {
        tl.innerHTML = logsData.value.logs
          .map(
            (l) => `
          <div class="tl-item">
            <div class="tl-dot" style="background:${LOG_COLORS[l.action] || "var(--text-dim)"}">${(l.action[0] || "?").toUpperCase()}</div>
            <div class="tl-info">
              <div class="tl-title"><strong>${esc(l.admin)}</strong> — ${esc(l.detail || l.action)}</div>
              <div class="tl-meta">${timeAgo(l.createdAt)}</div>
            </div>
          </div>
        `,
          )
          .join("");
      }
    }

    if (summaryData.status === "fulfilled" && summaryData.value.success) {
      const s = summaryData.value.summary;
      const kpi = document.getElementById("log-summary-kpi");
      if (kpi) {
        kpi.innerHTML = [
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
    }
  } catch (err) {
    console.error("[loadLogs]", err);
    toast("Failed to load logs: " + err.message, "err");
  }
}

/* ═══════════════════════════════════════════════════════════
   REGISTER LOADERS  (must come after function definitions)
═══════════════════════════════════════════════════════════ */
LOADERS.dashboard = loadDashboard;
LOADERS.users = loadUsers;
LOADERS.posts = loadPosts;
LOADERS.reports = loadReports;
LOADERS.verification = loadVerification;
LOADERS.badges = loadBadges;
LOADERS.challenges = loadChallenges;
LOADERS.announcements = loadAnnouncements;
LOADERS.analytics = loadAnalytics;
LOADERS.logs = loadLogs;

/* ═══════════════════════════════════════════════════════════
   INIT  —  runs after DOM is ready
═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Decode JWT and show admin handle in topbar
  try {
    const t = getToken();
    if (t) {
      const payload = JSON.parse(atob(t.split(".")[1]));
      const nameEl = document.getElementById("tb-admin-name");
      const avEl = document.getElementById("tb-admin-av");
      if (nameEl && payload.handle) nameEl.textContent = "@" + payload.handle;
      if (avEl && payload.handle)
        avEl.textContent = payload.handle.slice(0, 2).toUpperCase();
    }
  } catch (_) {
    /* token not set yet */
  }

  // Load dashboard immediately
  loadDashboard();
  _loaded["dashboard"] = true;
});
