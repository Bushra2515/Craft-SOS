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

/* ═══════════════════════════════════════════════════════════
   REPORT CONTENT
   openReportModal(targetId, targetType)
   targetType: "post" | "comment" | "user"
═══════════════════════════════════════════════════════════ */
function openReportModal(targetId, targetType) {
  document.getElementById("_report-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "_report-overlay";
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(46,53,32,.5);z-index:10000;
    display:flex;align-items:center;justify-content:center;padding:16px;
  `;

  // Matches schema reason enum exactly
  const REASONS = [
    ["spam", "🚫 Spam or self-promotion"],
    ["harassment", "😡 Harassment or bullying"],
    ["scam", "💰 Scam or fraud"],
    ["misleading", "❌ Misleading / false info"],
    ["other", "💬 Other"],
  ];

  overlay.innerHTML = `
    <div style="
      background:#f5f7ee;border-radius:20px;padding:28px 26px 22px;
      width:100%;max-width:400px;
      box-shadow:0 20px 60px rgba(0,0,0,.22);
      font-family:'DM Sans',sans-serif;
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <h3 style="margin:0;font-size:1.05rem;color:#2d3520;font-family:'Lora',serif;">
          Report Content
        </h3>
        <button onclick="document.getElementById('_report-overlay').remove()"
          style="background:none;border:none;cursor:pointer;font-size:1.3rem;
                 color:#aaa;line-height:1;padding:0 4px;">&times;</button>
      </div>

      <p style="margin:0 0 16px;font-size:.81rem;color:#8a9a6a;line-height:1.5;">
        Help keep Craft-SOS safe. Reports are reviewed by our moderation team.
      </p>

      <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:14px;">
        ${REASONS.map(
          ([val, label]) => `
          <label style="
            display:flex;align-items:center;gap:10px;cursor:pointer;
            padding:9px 13px;border-radius:10px;
            border:1.5px solid rgba(122,143,82,.2);
            font-size:.84rem;color:#3d4a2a;
            transition:background .12s,border-color .12s;user-select:none;
          "
          onmouseover="this.style.background='rgba(122,143,82,.08)';this.style.borderColor='rgba(122,143,82,.4)'"
          onmouseout="this.style.background='';this.style.borderColor='rgba(122,143,82,.2)'"
          >
            <input type="radio" name="_report-reason" value="${val}"
                   style="accent-color:#7a8f52;width:15px;height:15px;flex-shrink:0;">
            ${label}
          </label>`,
        ).join("")}
      </div>

      <textarea id="_report-detail"
        placeholder="Optional: add more context…"
        maxlength="300"
        style="
          width:100%;box-sizing:border-box;padding:10px 13px;
          border-radius:10px;border:1.5px solid rgba(122,143,82,.2);
          font-size:.82rem;resize:none;height:72px;
          font-family:'DM Sans',sans-serif;outline:none;
          color:#3d4a2a;background:rgba(255,255,255,.7);
        "
        onfocus="this.style.borderColor='#7a8f52'"
        onblur="this.style.borderColor='rgba(122,143,82,.2)'"
      ></textarea>
      <div style="font-size:.72rem;color:#bbb;text-align:right;margin-top:3px;">
        <span id="_report-char">0</span> / 300
      </div>

      <div style="display:flex;gap:9px;margin-top:14px;justify-content:flex-end;">
        <button onclick="document.getElementById('_report-overlay').remove()"
          style="
            padding:8px 20px;border-radius:10px;
            border:1.5px solid rgba(122,143,82,.25);
            background:none;cursor:pointer;
            font-size:.83rem;color:#666;font-family:'DM Sans',sans-serif;
          ">Cancel</button>
        <button id="_report-submit-btn"
          onclick="_submitReport('${targetId}','${targetType}')"
          style="
            padding:8px 22px;border-radius:10px;
            background:#7a8f52;color:#fff;border:none;cursor:pointer;
            font-size:.83rem;font-weight:700;font-family:'DM Sans',sans-serif;
            box-shadow:0 3px 10px rgba(122,143,82,.3);
          ">Submit Report</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Char counter
  overlay
    .querySelector("#_report-detail")
    ?.addEventListener("input", function () {
      const counter = overlay.querySelector("#_report-char");
      if (counter) counter.textContent = this.value.length;
    });

  // Close on backdrop
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Close on Escape
  const escFn = (e) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", escFn);
    }
  };
  document.addEventListener("keydown", escFn);
}

async function _submitReport(targetId, targetType) {
  const reason = document.querySelector(
    'input[name="_report-reason"]:checked',
  )?.value;
  if (!reason) {
    showToast("Please select a reason", "error");
    return;
  }

  const detail = document.getElementById("_report-detail")?.value?.trim() || "";
  const btn = document.getElementById("_report-submit-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Submitting…";
  }

  try {
    await api("/reports", {
      method: "POST",
      body: JSON.stringify({ targetId, targetType, reason, detail }),
    });
    document.getElementById("_report-overlay")?.remove();
    showToast("Report submitted — thank you! 🙏", "success");
  } catch (e) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Submit Report";
    }
    showToast(e.message || "Could not submit report", "error");
  }
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
   ─ loadChallenges(tab)          list with tab filter
   ─ openViewChallenge(id)        read-only detail modal
   ─ openChallengeModal(id?)      create or edit modal
   ─ submitChallengeModal()       POST or PUT
   ─ endChallenge(id, title, btn)
   ─ reactivateChallenge(id, btn)
   ─ ch_addReward / ch_addTask / ch_addRule  dynamic rows
═══════════════════════════════════════════════════════════ */

let _chTab = "active"; // current tab
let _editingChallengeId = null; // null = create mode, id = edit mode

/* ── Tab switcher ────────────────────────────────────────── */
function chTab(tab, el) {
  _chTab = tab;
  document
    .querySelectorAll(".ch-tab")
    .forEach((t) => t.classList.remove("active"));
  if (el) el.classList.add("active");
  loadChallenges(tab);
}

async function loadChallenges(tab) {
  tab = tab || _chTab;
  try {
    const [listData, statsData] = await Promise.allSettled([
      apiFetch(`/challenges?status=${tab}`),
      apiFetch("/challenges/stats"),
    ]);

    // Stats bar
    if (statsData.status === "fulfilled" && statsData.value.success) {
      const st = statsData.value.stats;
      const setEl = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
      };
      setEl("ch-active", st.active);
      setEl("ch-upcoming", st.upcoming);
      setEl("ch-completed", st.completed);
      setEl("ch-participants", st.totalParticipants);
    }

    const list = document.getElementById("challenges-list");
    if (!list) return;

    if (listData.status !== "fulfilled" || !listData.value.challenges?.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">🏆</div>No challenges in this tab. <button class="btn btn-primary btn-sm" onclick="openChallengeModal()" style="margin-top:8px">Launch one</button></div>`;
      return;
    }

    const DIFF_CLS = { easy: "p-green", medium: "p-amber", hard: "p-red" };
    const STAT_CLS = {
      active: "p-green",
      upcoming: "p-blue",
      completed: "p-amber",
    };

    list.innerHTML = listData.value.challenges
      .map((c) => {
        const endsStr = c.endsAt
          ? new Date(c.endsAt).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
            })
          : "—";
        const startsStr = c.startsAt
          ? new Date(c.startsAt).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
            })
          : "—";
        const active = c.isActive && c.status !== "completed";
        return `
      <div class="ch-item" id="ch-row-${c.id}">
        <div class="ch-cover-swatch" style="background:${esc(c.coverBg || "var(--accent-pale)")}">
          <span style="font-size:1.5rem">${esc(c.emoji || "🎯")}</span>
        </div>
        <div class="ch-info">
          <div class="ch-title">${esc(c.title)}</div>
          <div class="ch-meta">
            <span class="pill ${STAT_CLS[c.status] || "p-amber"}" style="font-size:.7rem">${c.status}</span>
            <span class="pill ${DIFF_CLS[c.difficulty] || "p-amber"}" style="font-size:.7rem">${c.difficulty}</span>
            ${c.featured ? `<span class="pill p-blue" style="font-size:.7rem">⭐ Featured</span>` : ""}
            <span style="font-size:.75rem;color:var(--text-dim)">
              📅 ${startsStr} → ${endsStr}
            </span>
            <span style="font-size:.75rem;color:var(--text-dim)">
              👥 ${c.participantCount} · ✅ ${c.taskCount} tasks · 🎁 ${c.rewardCount} rewards
            </span>
          </div>
        </div>
        <div class="act-row">
          <button class="btn btn-ghost btn-xs" onclick="openViewChallenge('${c.id}')">👁 View</button>
          <button class="btn btn-ghost btn-xs" onclick="openChallengeModal('${c.id}')">✏️ Edit</button>
          ${
            active
              ? `<button class="btn btn-danger btn-xs" onclick="adminEndChallenge('${c.id}','${esc(c.title)}',this)">⏹ End</button>`
              : `<button class="btn btn-primary btn-xs" onclick="adminReactivateChallenge('${c.id}',this)">▶ Reactivate</button>`
          }
        </div>
      </div>`;
      })
      .join("");
  } catch (err) {
    console.error("[loadChallenges]", err);
    toast("Failed to load challenges: " + err.message, "err");
  }
}

/* ── View modal ──────────────────────────────────────────── */
async function openViewChallenge(id) {
  openModal("m-challenge-view");
  const mc = document.getElementById("m-cv-body");
  if (mc) mc.innerHTML = `<div class="empty">⏳ Loading…</div>`;
  try {
    const d = await apiFetch(`/challenges/${id}`);
    const c = d.challenge;
    const fmt = (dt) =>
      dt
        ? new Date(dt).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—";

    const rewardsHtml = (c.rewards || []).length
      ? c.rewards
          .map(
            (r) =>
              `<span class="pill p-blue" style="font-size:.75rem">${esc(r.icon || "")} ${esc(r.label)}</span>`,
          )
          .join(" ")
      : "<em>None</em>";

    const tasksHtml = (c.tasks || []).length
      ? `<ol style="margin:0;padding-left:18px;font-size:.83rem;color:var(--text-mid);line-height:1.8">
          ${c.tasks
            .sort((a, b) => a.order - b.order)
            .map(
              (t) =>
                `<li><strong>${esc(t.title)}</strong>${t.description ? ` — ${esc(t.description)}` : ""}${t.dueLabel ? ` <em style="color:var(--text-dim)">(${esc(t.dueLabel)})</em>` : ""}</li>`,
            )
            .join("")}</ol>`
      : "<em>No tasks defined</em>";

    const rulesHtml = (c.rules || []).length
      ? `<ol style="margin:0;padding-left:18px;font-size:.83rem;color:var(--text-mid);line-height:1.9">
          ${c.rules
            .sort((a, b) => a.order - b.order)
            .map((r) => `<li>${esc(r.text)}</li>`)
            .join("")}</ol>`
      : "<em>No rules defined</em>";

    mc.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
        <div style="width:54px;height:54px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:2rem;background:${esc(c.coverBg)}">
          ${esc(c.emoji || "🎯")}
        </div>
        <div>
          <div style="font-family:'Lora',serif;font-weight:700;font-size:1.1rem;">${esc(c.title)}</div>
          <div style="font-size:.75rem;color:var(--text-dim);margin-top:2px;">${esc(c.niche)} · ${c.difficulty} · ${c.status}</div>
        </div>
      </div>
      <p style="font-size:.84rem;color:var(--text-mid);line-height:1.65;margin-bottom:14px;">${esc(c.description || "No description.")}</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;">
        ${[
          { l: "Participants", v: c.participants?.length ?? 0 },
          { l: "Points Reward", v: c.pointsReward ?? 0 },
          { l: "Tasks", v: (c.tasks || []).length },
          { l: "Rewards", v: (c.rewards || []).length },
        ]
          .map(
            ({
              l,
              v,
            }) => `<div style="background:rgba(122,143,82,.07);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-weight:700;font-size:1.1rem">${v}</div>
          <div style="font-size:.68rem;color:var(--text-dim)">${l}</div>
        </div>`,
          )
          .join("")}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.78rem;color:var(--text-dim);margin-bottom:14px;">
        <div>📅 Starts: <strong style="color:var(--text)">${fmt(c.startsAt)}</strong></div>
        <div>🏁 Ends:   <strong style="color:var(--text)">${fmt(c.endsAt)}</strong></div>
        <div>🌟 Featured: <strong>${c.featured ? "Yes" : "No"}</strong></div>
        <div>🟢 isActive: <strong>${c.isActive ? "Yes" : "No"}</strong></div>
      </div>
      <div style="margin-bottom:12px"><div style="font-weight:700;font-size:.8rem;margin-bottom:6px">🎁 Rewards</div>${rewardsHtml}</div>
      <div style="margin-bottom:12px"><div style="font-weight:700;font-size:.8rem;margin-bottom:6px">✅ Tasks</div>${tasksHtml}</div>
      <div><div style="font-weight:700;font-size:.8rem;margin-bottom:6px">📋 Rules</div>${rulesHtml}</div>
    `;
  } catch (err) {
    const mc2 = document.getElementById("m-cv-body");
    if (mc2)
      mc2.innerHTML = `<div class="empty" style="color:var(--high)">⚠️ ${esc(err.message)}</div>`;
  }
}

/* ── Create / Edit modal ─────────────────────────────────── */
async function openChallengeModal(id) {
  _editingChallengeId = id || null;
  const titleEl = document.getElementById("m-ch-modal-title");
  const submitEl = document.getElementById("m-ch-submit-btn");
  if (titleEl)
    titleEl.textContent = id ? "✏️ Edit Challenge" : "🏆 New Challenge";
  if (submitEl) submitEl.textContent = id ? "Save Changes" : "🚀 Launch";

  // Reset form
  _chClearForm();

  if (id) {
    openModal("m-challenge");
    const formWrap = document.getElementById("m-ch-form");
    if (formWrap) formWrap.style.opacity = ".4";
    try {
      const d = await apiFetch(`/challenges/${id}`);
      _chPopulateForm(d.challenge);
      if (formWrap) formWrap.style.opacity = "1";
    } catch (err) {
      toast("Could not load challenge: " + err.message, "err");
      closeModal("m-challenge");
    }
  } else {
    openModal("m-challenge");
  }
}

function _chClearForm() {
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v;
  };
  const setChk = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.checked = v;
  };
  setVal("mch-emoji", "🎯");
  setVal("mch-coverbg", "linear-gradient(135deg,#7a8f52 0%,#3d5a20 100%)");
  setVal("mch-niche", "");
  setVal("mch-title", "");
  setVal("mch-desc", "");
  setVal("mch-difficulty", "medium");
  setVal("mch-status", "upcoming");
  setVal("mch-points", "0");
  setVal("mch-starts", "");
  setVal("mch-ends", "");
  setChk("mch-featured", false);

  // Clear dynamic lists
  const rw = document.getElementById("mch-rewards-list");
  const tk = document.getElementById("mch-tasks-list");
  const rl = document.getElementById("mch-rules-list");
  if (rw) rw.innerHTML = "";
  if (tk) tk.innerHTML = "";
  if (rl) rl.innerHTML = "";

  // Reset to first tab
  chModalTab("basic", document.querySelector(".mch-tab"));
}

function _chPopulateForm(c) {
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v ?? "";
  };
  const setChk = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!v;
  };
  const fmtDate = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");

  setVal("mch-emoji", c.emoji);
  setVal("mch-coverbg", c.coverBg);
  setVal("mch-niche", c.niche);
  setVal("mch-title", c.title);
  setVal("mch-desc", c.description);
  setVal("mch-difficulty", c.difficulty);
  setVal("mch-status", c.status);
  setVal("mch-points", c.pointsReward ?? 0);
  setVal("mch-starts", fmtDate(c.startsAt));
  setVal("mch-ends", fmtDate(c.endsAt));
  setChk("mch-featured", c.featured);

  // Rewards
  const rw = document.getElementById("mch-rewards-list");
  if (rw) {
    rw.innerHTML = "";
    (c.rewards || []).forEach((r) => ch_addReward(r));
  }
  // Tasks
  const tk = document.getElementById("mch-tasks-list");
  if (tk) {
    tk.innerHTML = "";
    [...(c.tasks || [])]
      .sort((a, b) => a.order - b.order)
      .forEach((t) => ch_addTask(t));
  }
  // Rules
  const rl = document.getElementById("mch-rules-list");
  if (rl) {
    rl.innerHTML = "";
    [...(c.rules || [])]
      .sort((a, b) => a.order - b.order)
      .forEach((r) => ch_addRule(r));
  }
}

/* ── Modal tab switcher ──────────────────────────────────── */
function chModalTab(tab, el) {
  document
    .querySelectorAll(".mch-tab-pane")
    .forEach((p) => (p.style.display = "none"));
  document
    .querySelectorAll(".mch-tab")
    .forEach((t) => t.classList.remove("active"));
  const pane = document.getElementById("mch-pane-" + tab);
  if (pane) pane.style.display = "";
  if (el) el.classList.add("active");
}

/* ── Submit (create or edit) ─────────────────────────────── */
async function submitChallengeModal() {
  const g = (id) => document.getElementById(id)?.value?.trim() ?? "";
  const title = g("mch-title");
  if (!title) {
    toast("Title is required", "err");
    return;
  }

  const payload = {
    emoji: g("mch-emoji") || "🎯",
    coverBg:
      g("mch-coverbg") || "linear-gradient(135deg,#7a8f52 0%,#3d5a20 100%)",
    niche: g("mch-niche"),
    title,
    description: g("mch-desc"),
    difficulty: document.getElementById("mch-difficulty")?.value || "medium",
    status: document.getElementById("mch-status")?.value || "upcoming",
    featured: document.getElementById("mch-featured")?.checked ?? false,
    pointsReward: Number(g("mch-points")) || 0,
    startsAt: g("mch-starts") || null,
    endsAt: g("mch-ends") || null,
    rewards: _chReadRewards(),
    tasks: _chReadTasks(),
    rules: _chReadRules(),
  };

  const btn = document.getElementById("m-ch-submit-btn");
  const orig = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Saving…";
  }

  try {
    let d;
    if (_editingChallengeId) {
      d = await apiFetch(`/challenges/${_editingChallengeId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      d = await apiFetch("/challenges", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    toast(d.message, "ok");
    closeModal("m-challenge");
    _loaded["challenges"] = false;
    loadChallenges(_chTab);
  } catch (err) {
    toast(err.message, "err");
    if (btn) {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }
}

/* ── End / Reactivate ────────────────────────────────────── */
async function adminEndChallenge(cid, title, btn) {
  if (
    !confirm(
      `End "${title}"? This marks it completed and hides it from active view.`,
    )
  )
    return;
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    const d = await apiFetch(`/challenges/${cid}/end`, { method: "PATCH" });
    toast(d.message, "ok");
    _loaded["challenges"] = false;
    loadChallenges(_chTab);
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
    btn.disabled = false;
  }
}

async function adminReactivateChallenge(cid, btn) {
  if (!confirm("Reactivate this challenge?")) return;
  const orig = btn.textContent;
  btn.textContent = "…";
  btn.disabled = true;
  try {
    const d = await apiFetch(`/challenges/${cid}/reactivate`, {
      method: "PATCH",
    });
    toast(d.message, "ok");
    _loaded["challenges"] = false;
    loadChallenges(_chTab);
  } catch (err) {
    toast(err.message, "err");
    btn.textContent = orig;
    btn.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════════
   DYNAMIC LIST HELPERS — Rewards, Tasks, Rules
══════════════════════════════════════════════════════════ */

/* REWARDS */
function ch_addReward(data) {
  const list = document.getElementById("mch-rewards-list");
  if (!list) return;
  const row = document.createElement("div");
  row.className = "mch-dyn-row";
  row.innerHTML = `
    <select class="sel sel-xs rw-type">
      ${["pts", "badge", "cert", "top", "sponsor"]
        .map(
          (t) =>
            `<option value="${t}"${data?.type === t ? " selected" : ""}>${t}</option>`,
        )
        .join("")}
    </select>
    <input class="inp inp-xs rw-label" placeholder="Label e.g. +500 pts" value="${esc(data?.label || "")}">
    <input class="inp inp-xs rw-icon"  placeholder="Icon emoji" value="${esc(data?.icon || "")}" style="width:60px">
    <input class="inp inp-xs rw-sub"   placeholder="Subtitle (optional)" value="${esc(data?.sub || "")}">
    <label style="font-size:.72rem;white-space:nowrap;cursor:pointer">
      <input type="checkbox" class="rw-toponly" ${data?.topOnly ? "checked" : ""}> Top-3 only
    </label>
    <button class="btn btn-ghost btn-xs mch-del-btn" onclick="this.closest('.mch-dyn-row').remove()">✕</button>
  `;
  list.appendChild(row);
}

function _chReadRewards() {
  return Array.from(document.querySelectorAll("#mch-rewards-list .mch-dyn-row"))
    .map((row) => ({
      type: row.querySelector(".rw-type")?.value || "pts",
      label: row.querySelector(".rw-label")?.value || "",
      icon: row.querySelector(".rw-icon")?.value || "",
      sub: row.querySelector(".rw-sub")?.value || "",
      topOnly: row.querySelector(".rw-toponly")?.checked || false,
    }))
    .filter((r) => r.label.trim());
}

/* TASKS */
function ch_addTask(data) {
  const list = document.getElementById("mch-tasks-list");
  if (!list) return;
  const order = list.children.length + 1;
  const row = document.createElement("div");
  row.className = "mch-dyn-row mch-task-row";
  row.innerHTML = `
    <div class="mch-task-num">${data?.order || order}</div>
    <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
      <input class="inp inp-xs tk-title" placeholder="Task title *" value="${esc(data?.title || "")}" style="font-weight:600">
      <input class="inp inp-xs tk-desc"  placeholder="Short description (optional)" value="${esc(data?.description || "")}">
      <div style="display:flex;gap:6px">
        <input class="inp inp-xs tk-due" placeholder="Due label e.g. Due Mar 22" value="${esc(data?.dueLabel || "")}" style="flex:1">
        <select class="sel sel-xs tk-tagcls">
          <option value="">No tag</option>
          ${["tag-pts", "tag-badge", "tag-req", "tag-final"]
            .map(
              (v) =>
                `<option value="${v}"${data?.tagCls === v ? " selected" : ""}>${v}</option>`,
            )
            .join("")}
        </select>
        <input class="inp inp-xs tk-tagtxt" placeholder="Tag text e.g. +100 pts" value="${esc(data?.tagText || "")}" style="width:110px">
      </div>
    </div>
    <button class="btn btn-ghost btn-xs mch-del-btn" onclick="this.closest('.mch-task-row').remove()">✕</button>
  `;
  list.appendChild(row);
}

function _chReadTasks() {
  return Array.from(document.querySelectorAll("#mch-tasks-list .mch-task-row"))
    .map((row, i) => ({
      order: i + 1,
      title: row.querySelector(".tk-title")?.value || "",
      description: row.querySelector(".tk-desc")?.value || "",
      dueLabel: row.querySelector(".tk-due")?.value || "",
      tagCls: row.querySelector(".tk-tagcls")?.value || "",
      tagText: row.querySelector(".tk-tagtxt")?.value || "",
    }))
    .filter((t) => t.title.trim());
}

/* RULES */
function ch_addRule(data) {
  const list = document.getElementById("mch-rules-list");
  if (!list) return;
  const order = list.children.length + 1;
  const row = document.createElement("div");
  row.className = "mch-dyn-row mch-rule-row";
  row.innerHTML = `
    <div class="mch-task-num">${data?.order || order}</div>
    <input class="inp inp-xs rl-text" placeholder="Rule text…" value="${esc(data?.text || "")}" style="flex:1">
    <button class="btn btn-ghost btn-xs mch-del-btn" onclick="this.closest('.mch-rule-row').remove()">✕</button>
  `;
  list.appendChild(row);
}

function _chReadRules() {
  return Array.from(document.querySelectorAll("#mch-rules-list .mch-rule-row"))
    .map((row, i) => ({
      order: i + 1,
      text: row.querySelector(".rl-text")?.value || "",
    }))
    .filter((r) => r.text.trim());
}

/* ── Keep old submitCreateChallenge as alias for compat ─── */
function submitCreateChallenge() {
  submitChallengeModal();
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

async function checkPendingReports() {
  const box = document.getElementById("sidebar-alert");
  const titleEl = box?.querySelector(".sb-alert-title");
  const subEl = box?.querySelector(".sb-alert-sub");
  if (!box) return;

  try {
    const data = await apiFetch("/reports?status=pending&limit=1");
    const total = data.total ?? 0;

    if (total > 0) {
      box.style.display = "";
      if (titleEl)
        titleEl.textContent = `⚠ ${total} Report${total !== 1 ? "s" : ""} Pending`;
      if (subEl)
        subEl.textContent = `${total} item${total !== 1 ? "s" : ""} require immediate review`;

      // Also update the topbar dot
      const dot = document.getElementById("tb-reports-count");
      if (dot) dot.textContent = total > 99 ? "99+" : total;
    } else {
      box.style.display = "none";
      const dot = document.getElementById("tb-reports-count");
      if (dot) dot.style.display = "none";
    }
  } catch {
    // Silent fail — don't break the page
    box.style.display = "none";
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

function adminLogout() {
  if (!confirm("Sign out of the admin dashboard?")) return;
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}
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

  // ← ADD THIS
  checkPendingReports();
  setInterval(checkPendingReports, 60_000);
});
