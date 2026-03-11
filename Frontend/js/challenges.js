// Frontend/js/challenges.js
// Handles all dynamic behaviour for challenges.html:
//   - Fetches challenges from GET /api/challenges
//   - Fetches leaderboard from GET /api/challenges/leaderboard
//   - Join / Leave via PATCH /api/challenges/:id/join
//   - Tab switching, search, sort (all client-side after initial fetch)
//   - Live countdown timer for next upcoming challenge
//   - Toast notifications

const API = "http://localhost:5000/api/challenges";

/* ── Auth header ─────────────────────────────────────────── */
const authHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
};

/* ════════════════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════════════════ */
let _allChallenges = []; // full list fetched from server
let _activeTab = "all";
let _searchQ = "";
let _sortBy = "default";

/* ════════════════════════════════════════════════════════════
   BOOT
════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  loadChallenges();
  loadLeaderboard();
  initSidebarFromStorage();
});

/* ════════════════════════════════════════════════════════════
   DATA FETCHING
════════════════════════════════════════════════════════════ */
async function loadChallenges() {
  try {
    showGridSkeleton();
    const res = await fetch(`${API}?limit=50`, { headers: authHeaders() });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    _allChallenges = data.challenges || data.data || [];
    updateTabBadges();
    renderCards();
    initCountdown(); // set countdown to next upcoming
  } catch (err) {
    console.error("[loadChallenges]", err);
    showToast("Could not load challenges — " + err.message, "error");
    document.getElementById("challenges-grid").innerHTML = "";
    document.getElementById("empty-state").classList.add("show");
  }
}

async function loadLeaderboard() {
  try {
    const res = await fetch(`${API}/leaderboard`, { headers: authHeaders() });
    // Guard: server might return HTML (404) if route not yet registered
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return;
    const data = await res.json();
    if (!data.success) return;
    renderLeaderboard(data.leaderboard, data.myRank);
  } catch (err) {
    // Silent fail — leaderboard is non-critical
    console.warn("[loadLeaderboard]", err.message);
  }
}

/* ════════════════════════════════════════════════════════════
   JOIN / LEAVE
════════════════════════════════════════════════════════════ */
async function joinChallenge(id, btn) {
  if (!localStorage.getItem("token")) {
    showToast("Sign in to join challenges!", "error");
    return;
  }
  const orig = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = "…";
  }

  try {
    const res = await fetch(`${API}/${id}/join`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    // Update local state
    const c = _allChallenges.find((x) => x.id === id);
    if (c) {
      c.joined = data.joined;
      c.totalP = data.participantCount;
    }

    showToast(data.message, "success");
    renderCards(); // re-render with updated state
    loadLeaderboard(); // refresh leaderboard pts
  } catch (err) {
    showToast(err.message || "Could not join", "error");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = orig;
    }
  }
}

/* ════════════════════════════════════════════════════════════
   RENDER — CARDS
════════════════════════════════════════════════════════════ */
function renderCards() {
  const grid = document.getElementById("challenges-grid");
  const empty = document.getElementById("empty-state");

  let list = [..._allChallenges];

  // Tab filter
  if (_activeTab !== "all") {
    list = list.filter((c) => c.status === _activeTab);
  }

  // Search filter
  if (_searchQ.trim()) {
    const q = _searchQ.toLowerCase();
    list = list.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.niche.toLowerCase().includes(q),
    );
  }

  // Sort
  if (_sortBy === "points") {
    list.sort((a, b) => (b.pointsReward || 0) - (a.pointsReward || 0));
  } else if (_sortBy === "participants") {
    list.sort((a, b) => b.totalP - a.totalP);
  } else if (_sortBy === "deadline") {
    list.sort((a, b) => {
      const da = a.endsAt ? new Date(a.endsAt) : Infinity;
      const db = b.endsAt ? new Date(b.endsAt) : Infinity;
      return da - db;
    });
  }

  if (!list.length) {
    grid.innerHTML = "";
    empty.classList.add("show");
    return;
  }
  empty.classList.remove("show");
  grid.innerHTML = list.map((c, i) => buildCard(c, i)).join("");

  // Animate progress bars after paint
  setTimeout(() => {
    document.querySelectorAll(".cp-fill[data-w]").forEach((el) => {
      el.style.width = el.dataset.w + "%";
    });
  }, 80);
}

function buildCard(c, i) {
  const delay = (i * 0.07).toFixed(2);

  /* Status badge */
  const statusBadge =
    c.status === "active"
      ? `<div class="ch-status-badge sb-active"><div class="sb-dot"></div>In Progress</div>`
      : c.status === "upcoming"
        ? `<div class="ch-status-badge sb-upcoming"><div class="sb-dot"></div>Upcoming</div>`
        : `<div class="ch-status-badge sb-completed"><div class="sb-dot"></div>Completed</div>`;

  /* Reward pills */
  const rewardPills = (c.rewards || [])
    .map((r) => {
      const cls =
        r.type === "pts"
          ? "rp-pts"
          : r.type === "badge"
            ? "rp-badge"
            : r.type === "cert"
              ? "rp-cert"
              : "rp-top";
      return `<span class="reward-pill ${cls}">${r.label}</span>`;
    })
    .join("");

  /* Progress bar (only for active + joined) */
  const progressHtml =
    c.status === "active" && c.joined
      ? `<div class="ch-progress">
           <div class="cp-row">
             <span>${c.progressLabel || "0 tasks done"}</span>
             <span style="color:var(--amber);font-weight:700">${c.progress}%</span>
           </div>
           <div class="cp-bar"><div class="cp-fill amber" data-w="${c.progress}" style="width:0%"></div></div>
         </div>`
      : "";

  /* Completed banner */
  let completedBanner = "";
  if (c.completed && c.joined && c.completed.rank) {
    const icon = c.completed.rank <= 3 ? "🏆" : "✅";
    const label =
      c.completed.rank <= 3
        ? `Rank #${c.completed.rank} — Top Finisher!`
        : `Completed · Rank #${c.completed.rank}`;
    completedBanner = `
      <div class="ch-completed-banner">
        <div class="ccb-icon">${icon}</div>
        <div>
          <div class="ccb-title">${label}</div>
        </div>
        <div class="ccb-pts">+${c.completed.ptsEarned} pts</div>
      </div>`;
  }

  /* Participant avatar stack */
  const avStack = (c.participantIds || [])
    .slice(0, 4)
    .map((_, j) => {
      const colours = ["#5e6e3b", "#8b6914", "#7054ae", "#3468a4"];
      return `<div class="av-mini" style="background:${colours[j % colours.length]}">··</div>`;
    })
    .join("");
  const moreAv =
    c.totalP > 4 ? `<div class="av-mini av-more">+${c.totalP - 4}</div>` : "";

  /* Footer buttons */
  let btns = "";
  if (c.status === "active") {
    btns = c.joined
      ? `<button class="btn btn-primary" onclick="viewChallenge('${c.id}')">
           <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>View Progress
         </button>`
      : `<button class="btn btn-ghost" onclick="viewChallenge('${c.id}')">
           <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Details
         </button>
         <button class="btn btn-primary" onclick="joinChallenge('${c.id}',this)">
           <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Join
         </button>`;
  } else if (c.status === "upcoming") {
    btns = c.joined
      ? `<button class="btn btn-ghost" onclick="viewChallenge('${c.id}')">
           <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>View
         </button>
         <button class="btn btn-ghost btn-disabled">✓ Joined</button>`
      : `<button class="btn btn-ghost" onclick="viewChallenge('${c.id}')">
           <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Details
         </button>
         <button class="btn btn-primary" onclick="joinChallenge('${c.id}',this)">
           <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Join
         </button>`;
  } else {
    // completed — always show View
    btns = `<button class="btn btn-ghost" onclick="viewChallenge('${c.id}')">
           <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${c.joined ? "View Results" : "View"}
         </button>`;
  }

  const diffClass =
    c.difficulty === "easy"
      ? "diff-easy"
      : c.difficulty === "medium"
        ? "diff-medium"
        : "diff-hard";
  const diffLabel =
    c.difficulty === "easy"
      ? "🟢 Easy"
      : c.difficulty === "medium"
        ? "🟡 Medium"
        : "🔴 Hard";

  return `
  <div class="ch-card st-${c.status}${c.featured ? " featured" : ""}" style="animation-delay:${delay}s">
    <div class="ch-cover" style="background:${c.coverBg}">
      <div class="ch-cover-emoji">${c.emoji}</div>
      ${statusBadge}
    </div>
    <div class="ch-body">
      <div class="ch-niche">${c.niche}</div>
      <div class="ch-title">${c.title}</div>
      <div class="ch-desc">${c.description}</div>
      <div class="ch-rewards">${rewardPills}</div>
      ${progressHtml}
      ${completedBanner}
      <div class="${c.urgent ? "ch-time urgent" : "ch-time"}">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${c.urgent ? "⚠ " : ""}${c.time}
      </div>
      <div class="ch-participants">
        <div class="av-stack">${avStack}${moreAv}</div>
        <div class="ch-part-label">${c.totalP.toLocaleString()} participants</div>
      </div>
    </div>
    <div class="ch-footer">
      <span class="ch-diff ${diffClass}">${diffLabel}</span>
      <div class="ch-btns">${btns}</div>
    </div>
  </div>`;
}

/* ════════════════════════════════════════════════════════════
   RENDER — LEADERBOARD SIDEBAR
════════════════════════════════════════════════════════════ */
function renderLeaderboard(board, myRank) {
  const container = document.getElementById("leaderboard-list");
  if (!container) return;

  const medals = ["🥇", "🥈", "🥉"];
  const medalClass = ["gold", "silver", "bronze"];

  container.innerHTML = board
    .slice(0, 5)
    .map(
      (u, i) => `
    <div class="lb-item${u.isMe ? " lb-me" : ""}">
      <div class="lb-rank ${medalClass[i] || ""}">${medals[i] || u.rank}</div>
      <div class="lb-av" style="background:${avatarColor(u.handle)}">${u.handle.slice(0, 2).toUpperCase()}</div>
      <div class="lb-info">
        <div class="lb-name">${u.handle}</div>
        <div class="lb-handle">${u.niche || "Crafter"}</div>
      </div>
      <div class="lb-pts">${u.ptsTotal.toLocaleString()}</div>
    </div>`,
    )
    .join("");

  // Update "Your rank" pill
  const pill = document.getElementById("my-rank-num");
  const pillPts = document.getElementById("my-rank-pts");
  if (pill && myRank) {
    pill.textContent = "#" + myRank.rank;
    if (pillPts)
      pillPts.textContent = (myRank.ptsTotal || 0).toLocaleString() + " pts";
  }
}

function avatarColor(handle = "") {
  const colours = [
    "#5e6e3b",
    "#8b6914",
    "#7054ae",
    "#3468a4",
    "#a46818",
    "#c03828",
  ];
  let h = 0;
  for (const ch of handle) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return colours[Math.abs(h) % colours.length];
}

/* ════════════════════════════════════════════════════════════
   TAB BADGES
════════════════════════════════════════════════════════════ */
function updateTabBadges() {
  // Guard against undefined/non-array (e.g. old API shape)
  if (!Array.isArray(_allChallenges)) {
    _allChallenges = [];
    return;
  }
  const count = (status) =>
    status === "all"
      ? _allChallenges.length
      : _allChallenges.filter((c) => c.status === status).length;

  ["all", "active", "upcoming", "completed"].forEach((t) => {
    const el = document.getElementById("badge-" + t);
    if (el) el.textContent = count(t);
  });
}

/* ════════════════════════════════════════════════════════════
   INTERACTIONS — tabs / search / sort
════════════════════════════════════════════════════════════ */
function setTab(tab, el) {
  _activeTab = tab;
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  renderCards();
}

function filterCards(q) {
  _searchQ = q;
  renderCards();
}

function sortCards(val) {
  _sortBy = val;
  renderCards();
}

// NEW
function viewChallenge(id) {
  window.location.href = `challenge-detail.html?id=${id}`;
}

/* ════════════════════════════════════════════════════════════
   COUNTDOWN — targets next "upcoming" challenge's startsAt
════════════════════════════════════════════════════════════ */
let _countdownInterval = null;

function initCountdown() {
  const next = _allChallenges
    .filter((c) => c.status === "upcoming" && c.startsAt)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];

  if (!next) return;

  const titleEl = document.getElementById("countdown-title");
  if (titleEl) titleEl.textContent = next.title;

  const target = new Date(next.startsAt);
  if (_countdownInterval) clearInterval(_countdownInterval);

  function tick() {
    const diff = Math.max(0, target - Date.now());
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(v).padStart(2, "0");
    };
    set("cd-d", d);
    set("cd-h", h);
    set("cd-m", m);
    set("cd-s", s);
  }
  tick();
  _countdownInterval = setInterval(tick, 1000);
}

/* ════════════════════════════════════════════════════════════
   SKELETON LOADER
════════════════════════════════════════════════════════════ */
function showGridSkeleton() {
  const grid = document.getElementById("challenges-grid");
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 6 })
    .map(
      () => `
    <div class="ch-card" style="pointer-events:none;opacity:.5">
      <div class="ch-cover" style="background:#e8eed8;height:120px"></div>
      <div class="ch-body">
        <div class="skeleton" style="height:12px;width:60%;border-radius:6px;margin-bottom:8px;background:#e8eed8"></div>
        <div class="skeleton" style="height:18px;width:90%;border-radius:6px;margin-bottom:6px;background:#e8eed8"></div>
        <div class="skeleton" style="height:12px;width:80%;border-radius:6px;background:#e8eed8"></div>
      </div>
    </div>`,
    )
    .join("");
}

/* ════════════════════════════════════════════════════════════
   SIDEBAR — fill from localStorage (common.js pattern)
════════════════════════════════════════════════════════════ */
function initSidebarFromStorage() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const nameEl = document.querySelector(".sb-prof-name");
    const subEl = document.querySelector(".sb-prof-sub");
    const avEl = document.querySelector(".sb-prof-av");
    if (nameEl && user.handle) nameEl.textContent = user.handle;
    if (subEl && user.niche)
      subEl.textContent = user.niche + " · " + (user.points ?? 0) + " pts";
    if (avEl && user.handle) {
      avEl.textContent = user.handle.slice(0, 2).toUpperCase();
      avEl.style.background = avatarColor(user.handle);
    }
  } catch (_) {}
}

/* ════════════════════════════════════════════════════════════
   TOAST
════════════════════════════════════════════════════════════ */
let _toastTimer;
function showToast(msg, type = "") {
  // Delegate to window.craftToast if common.js / socket-client.js loaded it
  if (typeof window.craftToast === "function") {
    window.craftToast(
      msg,
      type === "error" ? "error" : type === "success" ? "success" : "info",
    );
    return;
  }
  const t = document.getElementById("toast");
  const txt = document.getElementById("toast-msg");
  if (!t || !txt) return;
  txt.textContent = msg;
  t.className = "toast show" + (type ? " " + type : "");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => (t.className = "toast"), 3200);
}

/* ════════════════════════════════════════════════════════════
   SIDEBAR TOGGLE (mobile)
════════════════════════════════════════════════════════════ */
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("on");
}
function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("on");
}
document.addEventListener("DOMContentLoaded", () => {
  window.initSidebar();
});
