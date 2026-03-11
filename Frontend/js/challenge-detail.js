// Frontend/js/challenge-detail.js
// Powers challenge-detail.html — a single-challenge view page.
//
// On load:
//   1. Reads ?id= from URL
//   2. Fetches GET /api/challenges/:id/detail
//   3. Fetches GET /api/challenges/:id/board
//   4. Fetches GET /api/challenges/:id/feed
//   5. Renders all sections and wires up all interactions

/* ════════════════════════════════════════════════════════════
   CONFIG & STATE
════════════════════════════════════════════════════════════ */
const BASE = "http://localhost:5000/api/challenges";

let _cid = null; // challenge id from URL
let _c = null; // challenge object from server
let _myState = null; // current user's state
let _board = [];
let _feed = [];
let _feedPage = 1;
let _feedTotal = 0;
let _leaveId = null; // for the leave-confirm modal

/* ── Auth header ─────────────────────────────────────────── */
const auth = () => {
  const t = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: "Bearer " + t } : {}),
  };
};
const isLoggedIn = () => !!localStorage.getItem("token");

/* ════════════════════════════════════════════════════════════
   BOOT
════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  _cid = new URLSearchParams(window.location.search).get("id");
  if (!_cid) {
    document.getElementById("main").innerHTML =
      `<div class="error-state"><div class="err-ico">🔍</div>
       <div class="err-title">Challenge not found</div>
       <a href="challenges.html" class="btn btn-primary" style="margin-top:16px">Back to Challenges</a></div>`;
    return;
  }

  initSidebarFromStorage();
  await Promise.all([loadDetail(), loadBoard(), loadFeed()]);
  bindComposer();
});

/* ════════════════════════════════════════════════════════════
   DATA FETCHING
════════════════════════════════════════════════════════════ */
async function loadDetail() {
  try {
    const res = await fetch(`${BASE}/${_cid}/detail`, { headers: auth() });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) throw new Error("Server error");
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    _c = data.challenge;
    _myState = data.myState;
    renderAll();
  } catch (err) {
    console.error("[loadDetail]", err);
    showToast("Could not load challenge — " + err.message, "error");
  }
}

async function loadBoard() {
  try {
    const res = await fetch(`${BASE}/${_cid}/board`, { headers: auth() });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return;
    const data = await res.json();
    if (!data.success) return;
    _board = data.board;
    renderBoard(data.myEntry, data.total);
  } catch (err) {
    console.warn("[loadBoard]", err.message);
  }
}

async function loadFeed(page = 1) {
  try {
    const res = await fetch(`${BASE}/${_cid}/feed?page=${page}&limit=10`, {
      headers: auth(),
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return;
    const data = await res.json();
    if (!data.success) return;
    if (page === 1) {
      _feed = data.posts;
    } else {
      _feed.push(...data.posts);
    }
    _feedPage = page;
    _feedTotal = data.total;
    renderFeed();
    document.getElementById("feed-count").textContent =
      data.total + " posts from participants";
    // show/hide load more
    const lmBtn = document.getElementById("load-more-btn");
    if (lmBtn)
      lmBtn.style.display = _feed.length < data.total ? "flex" : "none";
  } catch (err) {
    console.warn("[loadFeed]", err.message);
  }
}

/* ════════════════════════════════════════════════════════════
   RENDER — ALL SECTIONS
════════════════════════════════════════════════════════════ */
function renderAll() {
  if (!_c) return;
  renderHero();
  renderCTA();
  renderProgressHero();
  renderTasks();
  renderRewards();
  renderRules();
  renderDeadlineRing();
  renderParticipants();
  renderRewardStatus();
  updateStickyBar();

  // Breadcrumb title
  const bc = document.getElementById("bc-title");
  if (bc) bc.textContent = _c.title;

  // Page title
  document.title = _c.title + " · Craft-SOS";
}

/* ── Hero ────────────────────────────────────────────────── */
function renderHero() {
  const cover = document.getElementById("hero-cover");
  if (cover) cover.style.background = _c.coverBg;

  setTxt("hero-emoji", _c.emoji);
  setTxt("hero-niche", _c.emoji + " " + _c.niche);
  setTxt("hero-title", _c.title);
  setTxt("hero-desc", _c.description);
  setTxt("hero-timeleft", _c.timeLabel);

  // Status badge
  const badge = document.getElementById("hero-status");
  if (badge) {
    const map = {
      active: { cls: "sb-active", txt: "In Progress" },
      upcoming: { cls: "sb-upcoming", txt: "Upcoming" },
      completed: { cls: "sb-completed", txt: "Completed" },
    };
    const s = map[_c.status] || map.active;
    badge.className = `hero-status-badge ${s.cls}`;
    badge.innerHTML = `<div class="sb-dot"></div>${s.txt}`;
  }

  // Difficulty chip
  const diff = document.getElementById("hero-diff");
  if (diff) {
    const map = { easy: "diff-easy", medium: "diff-medium", hard: "diff-hard" };
    const lbl = { easy: "🟢 Easy", medium: "🟡 Medium", hard: "🔴 Hard" };
    diff.className = `diff-chip ${map[_c.difficulty] || "diff-medium"}`;
    diff.textContent = lbl[_c.difficulty] || "Medium";
  }

  // Reward pills
  const pillsEl = document.getElementById("hero-pills");
  if (pillsEl) {
    const dateRange =
      _c.startsAt && _c.endsAt ? formatDateRange(_c.startsAt, _c.endsAt) : "";
    const pillsHtml =
      (_c.rewards || [])
        .map((r) => {
          const cls =
            r.type === "pts"
              ? "pill-gold"
              : r.type === "badge"
                ? "pill-purple"
                : r.type === "cert"
                  ? "pill-green"
                  : r.type === "top"
                    ? "pill-blue"
                    : "pill-muted";
          return `<span class="pill ${cls}">${r.label}</span>`;
        })
        .join("") +
      (dateRange ? `<span class="pill pill-amber">${dateRange}</span>` : "");
    pillsEl.innerHTML = pillsHtml;
  }

  // Bookmark button state
  const bmBtn = document.getElementById("bookmark-btn");
  if (bmBtn && _myState?.bookmarked) bmBtn.classList.add("active");
}

/* ── CTA strip ───────────────────────────────────────────── */
function renderCTA() {
  if (!_myState) return;

  const ctaWrap = document.getElementById("hero-cta");
  if (!ctaWrap) return;

  const { joined, progress, progressLabel, rank } = _myState;
  const daysLeft = _c.daysLeft ?? "—";
  const totalP = _c.totalP;

  if (joined) {
    setTxt("cta-pct", progress + "% complete");
    setTxt(
      "cta-sub",
      `${progressLabel} · ${rank ? "Rank #" + rank : "Unranked"} of ${totalP} · ${daysLeft} days remaining`,
    );
    // Show leave button, hide join
    setDisplay("cta-leave-btn", true);
    setDisplay("cta-join-btn", false);
    setDisplay("cta-joined-info", true);
  } else {
    setDisplay("cta-leave-btn", false);
    setDisplay("cta-join-btn", _c.status !== "completed");
    setDisplay("cta-joined-info", false);
  }
}

/* ── Progress hero (inside tasks card) ──────────────────── */
function renderProgressHero() {
  if (!_myState || !_c) return;
  const { progress, progressLabel, rank } = _myState;
  const daysLeft = _c.daysLeft ?? "—";
  const totalP = _c.totalP;

  setTxt("ph-pct", progress + "%");
  setTxt("ph-label", progressLabel || "0 tasks done");
  setTxt(
    "ph-sub",
    `${rank ? "Rank #" + rank : "Unranked"} of ${totalP} participants · ${daysLeft} days left`,
  );
  animateBar("ph-fill", progress);
  updateStickyBar();
}

/* ── Task list ───────────────────────────────────────────── */
function renderTasks() {
  const list = document.getElementById("task-list");
  if (!list || !_c?.tasks) return;
  if (!_c.tasks.length) {
    list.innerHTML = `<div class="empty-tasks">No tasks defined yet.</div>`;
    return;
  }

  const completedIds = _myState?.completedTasks || [];
  list.innerHTML = _c.tasks
    .map((t, i) => {
      const done = completedIds.includes(String(t.id));
      // active = first incomplete
      const active =
        !done &&
        !_c.tasks
          .slice(0, i)
          .some((prev) => !completedIds.includes(String(prev.id)));
      const rowCls = "task-row" + (done ? " completed" : "");
      const chkCls = "task-check" + (done ? " done" : active ? " active" : "");
      const tagHtml = t.tagCls
        ? `<span class="task-tag ${t.tagCls}">${t.tagText}</span>`
        : "";
      const upBtn =
        !done && active && isLoggedIn()
          ? `<div class="tick" onclick="markTaskDone('${t.id}', this)">
           <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
           <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
           Mark complete
         </div>`
          : "";
      const doneIcon = done
        ? `<svg class="tick" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`
        : "";
      const ringEl = !done && active ? `<div class="active-ring"></div>` : "";
      return `<div class="${rowCls}" id="task-${t.id}">
      <div class="${chkCls}" onclick="${!done && isLoggedIn() ? `markTaskDone('${t.id}',this)` : ""}">
        ${doneIcon}${ringEl}
      </div>
      <div class="task-body">
        <div class="task-title">${t.title}</div>
        <div class="task-desc">${t.description}</div>
        <div class="task-meta">
          <span class="task-due">${done ? "✓ " : "📅 "}${t.dueLabel}</span>
          ${tagHtml}
        </div>
        ${upBtn}
      </div>
    </div>`;
    })
    .join("");
}

/* ── Rewards grid ────────────────────────────────────────── */
function renderRewards() {
  const grid = document.getElementById("rewards-grid");
  if (!grid || !_c?.rewards) return;
  const progress = _myState?.progress ?? 0;
  grid.innerHTML = _c.rewards
    .map((r) => {
      const locked = r.topOnly && (_myState?.rank ?? 999) > 3;
      const unlocked = !locked && progress === 100;
      return `<div class="rw-card${locked ? " locked" : unlocked ? " unlocked" : ""}">
      <span class="rw-icon">${r.icon || "⭐"}</span>
      <div class="rw-label">${r.label}</div>
      <div class="rw-sub">${r.sub || ""}</div>
      ${unlocked ? `<div class="rw-unlocked-badge">✓ Earned</div>` : ""}
    </div>`;
    })
    .join("");
}

/* ── Rules list ──────────────────────────────────────────── */
function renderRules() {
  const list = document.getElementById("rules-list");
  if (!list || !_c?.rules) return;
  if (!_c.rules.length) {
    list.innerHTML = `<div class="empty-tasks">No rules specified.</div>`;
    return;
  }
  list.innerHTML = _c.rules
    .map(
      (r) =>
        `<div class="rule-item">
      <div class="rule-n">${r.order}</div>
      <div class="rule-text">${r.text}</div>
    </div>`,
    )
    .join("");
}

/* ── Leaderboard sidebar ─────────────────────────────────── */
function renderBoard(myEntry, total) {
  const list = document.getElementById("board-list");
  if (!list) return;
  const medals = ["🥇", "🥈", "🥉"];
  const mCls = ["gold", "silver", "bronze"];

  if (!_board.length) {
    list.innerHTML = `<div style="text-align:center;padding:16px;color:#aaa;font-size:.82rem">No one has completed tasks yet.</div>`;
    return;
  }

  list.innerHTML = _board
    .slice(0, 5)
    .map(
      (u, i) =>
        `<div class="lb-row${u.isMe ? " me" : ""}">
      <div class="lb-rank ${mCls[i] || ""}">${medals[i] || u.rank}</div>
      <div class="lb-av" style="background:${avatarColor(u.handle)}">${u.handle.slice(0, 2).toUpperCase()}</div>
      <div class="lb-info">
        <div class="lb-name${u.isMe ? ' style="color:var(--accent-dk)"' : ""}">${u.isMe ? "You" : u.handle}</div>
        <div class="lb-tasks">${u.tasksCompleted}/${_c?.tasks?.length ?? "?"} tasks</div>
      </div>
      <div class="lb-score${u.isMe ? ' style="color:var(--accent)"' : ""}">${u.tasksCompleted}</div>
    </div>`,
    )
    .join("");

  // My rank pill
  const rankEl = document.getElementById("my-rank-num");
  const subEl = document.getElementById("my-rank-sub");
  if (myEntry) {
    if (rankEl) rankEl.textContent = "#" + myEntry.rank;
    if (subEl)
      subEl.textContent = `Top ${Math.round((myEntry.rank / (total || 1)) * 100)}% · ${myEntry.tasksCompleted} tasks done`;
  }
  // View all button count
  const viewBtn = document.getElementById("view-all-btn");
  if (viewBtn) viewBtn.textContent = `View all ${total || ""}`;
}

/* ── Deadline ring ───────────────────────────────────────── */
function renderDeadlineRing() {
  const daysEl = document.getElementById("dl-days");
  const labelEl = document.getElementById("dl-label");
  const circle = document.getElementById("dl-circle");
  const alertEl = document.getElementById("dl-alert");
  const datesEl = document.getElementById("dl-dates");

  if (daysEl) daysEl.textContent = _c.daysLeft ?? "—";

  // Ring animation
  if (circle && _c.deadlineElapsed !== undefined) {
    const circ = 2 * Math.PI * 14; // r=14
    const offset = circ * (1 - _c.deadlineElapsed);
    setTimeout(() => {
      circle.style.strokeDashoffset = offset;
    }, 200);
  }

  if (datesEl && _c.startsAt && _c.endsAt) {
    const fmt = (d) =>
      new Date(d).toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      });
    datesEl.innerHTML = `<span>Started ${fmt(_c.startsAt)}</span><span>Ends ${fmt(_c.endsAt)}</span>`;
  }
}

/* ── Participants mosaic ─────────────────────────────────── */
function renderParticipants() {
  const mosaic = document.getElementById("av-mosaic");
  const hdr = document.getElementById("participants-hdr");
  if (mosaic) {
    const tiles = (_c.participants || [])
      .slice(0, 9)
      .map(
        (u) =>
          `<div class="av-tile" style="background:${avatarColor(u.handle)}" title="${u.handle}">
        ${u.handle.slice(0, 2).toUpperCase()}
      </div>`,
      )
      .join("");
    const extra =
      _c.totalP > 9
        ? `<div class="av-tile av-more-tile">+${_c.totalP - 9}</div>`
        : "";
    mosaic.innerHTML = tiles + extra;
  }
  if (hdr) hdr.textContent = _c.totalP + " Participants";
}

/* ── Rewards status sidebar ──────────────────────────────── */
function renderRewardStatus() {
  const list = document.getElementById("reward-status-list");
  if (!list) return;
  const progress = _myState?.progress ?? 0;
  list.innerHTML = (_c.rewards || [])
    .slice(0, 3)
    .map((r) => {
      const unlocked = progress === 100 && !r.topOnly;
      const cls = unlocked ? "st-earned" : "st-locked";
      const label = unlocked ? "Earned ✓" : "Locked";
      return `<div class="rw-mini">
      <div class="rw-mini-ico">${r.icon || "⭐"}</div>
      <div class="rw-mini-info">
        <div class="rw-mini-label">${r.label}</div>
        <div class="rw-mini-sub">On full completion</div>
      </div>
      <span class="status-tag ${cls}">${label}</span>
    </div>`;
    })
    .join("");
}

/* ── Feed ────────────────────────────────────────────────── */
function renderFeed() {
  const list = document.getElementById("feed-list");
  if (!list) return;
  if (!_feed.length) {
    list.innerHTML = `<div class="feed-empty">Be the first to post an update!</div>`;
    return;
  }
  list.innerHTML = _feed.map((p) => buildFeedItem(p)).join("");
}

function buildFeedItem(p) {
  const attachHtml = p.attachLabel
    ? `<div class="feed-attach">
         <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/>
         <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
         <polyline points="21 15 16 10 5 21"/></svg>
         ${p.attachLabel}
       </div>`
    : "";

  const reactions = (p.reactions || [])
    .map(
      (r) =>
        `<span class="react-btn${r.reacted ? " active" : ""}"
       onclick="toggleReact('${p.id}','${r.emoji}',this)">
      ${r.emoji} ${r.count}
    </span>`,
    )
    .join("");

  const deleteBtn = p.isOwn
    ? `<button class="feed-del-btn" onclick="deleteFeedPost('${p.id}')" title="Delete">
         <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
       </button>`
    : "";

  return `<div class="feed-item" id="feed-post-${p.id}">
    <div class="feed-av" style="background:${avatarColor(p.handle)}">${p.handle.slice(0, 2).toUpperCase()}</div>
    <div class="feed-body">
      <div class="feed-top">
        <span class="feed-name">${p.handle}</span>
        <span class="feed-time">${p.timeLabel}</span>
        ${deleteBtn}
      </div>
      <div class="feed-text">${escapeHtml(p.text)}</div>
      ${attachHtml}
      <div class="feed-reacts">${reactions}</div>
    </div>
  </div>`;
}

/* ── Sticky bar ──────────────────────────────────────────── */
function updateStickyBar() {
  const progress = _myState?.progress ?? 0;
  const rank = _myState?.rank ?? null;
  animateBar("sp-bar", progress);
  setTxt("sp-pct", progress + "%");
  if (rank) setTxt("sp-rank", "Rank #" + rank);
}

/* ════════════════════════════════════════════════════════════
   ACTIONS
════════════════════════════════════════════════════════════ */

/* Mark task done */
async function markTaskDone(taskId, el) {
  if (!isLoggedIn()) {
    showToast("Sign in to complete tasks!", "error");
    return;
  }
  if (el) {
    el.style.opacity = "0.5";
    el.style.pointerEvents = "none";
  }
  try {
    const res = await fetch(`${BASE}/${_cid}/tasks/${taskId}`, {
      method: "PATCH",
      headers: auth(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    _myState.progress = data.progress;
    _myState.progressLabel = data.progressLabel;
    _myState.completedTasks = data.completedTasks;
    if (data.rank) _myState.rank = data.rank;

    renderTasks();
    renderProgressHero();
    renderCTA();
    renderRewards();
    renderRewardStatus();
    updateStickyBar();

    if (data.justCompleted) {
      showToast(
        "🎉 Challenge complete! " +
          (data.ptsEarned ? `+${data.ptsEarned} pts earned!` : ""),
        "success",
      );
    } else {
      showToast("Task completed! Great work 🎉", "success");
    }
  } catch (err) {
    showToast(err.message || "Could not update task", "error");
    if (el) {
      el.style.opacity = "";
      el.style.pointerEvents = "";
    }
  }
}

/* Join challenge */
async function joinChallenge(btn) {
  if (!isLoggedIn()) {
    showToast("Sign in to join challenges!", "error");
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Joining…";
  }
  try {
    const res = await fetch(`${BASE}/${_cid}/join`, {
      method: "PATCH",
      headers: auth(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    _myState.joined = true;
    showToast(data.message, "success");
    await loadDetail();
    loadBoard();
  } catch (err) {
    showToast(err.message, "error");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Join Challenge";
    }
  }
}

/* Leave — opens modal */
function openLeaveModal() {
  if (!isLoggedIn()) return;
  document.getElementById("leave-modal").classList.add("open");
}
function closeLeaveModal() {
  document.getElementById("leave-modal").classList.remove("open");
}
async function confirmLeave() {
  closeLeaveModal();
  try {
    const res = await fetch(`${BASE}/${_cid}/leave`, {
      method: "PATCH",
      headers: auth(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    showToast(data.message, "");
    setTimeout(() => (window.location.href = "challenges.html"), 1600);
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* Bookmark */
async function toggleBookmark(btn) {
  if (!isLoggedIn()) {
    showToast("Sign in to bookmark", "error");
    return;
  }
  try {
    const res = await fetch(`${BASE}/${_cid}/bookmark`, {
      method: "PATCH",
      headers: auth(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    _myState.bookmarked = data.bookmarked;
    if (btn) btn.classList.toggle("active", data.bookmarked);
    showToast(
      data.bookmarked ? "Bookmarked!" : "Removed from bookmarks",
      "success",
    );
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* Toggle reaction */
async function toggleReact(postId, emoji, el) {
  if (!isLoggedIn()) {
    showToast("Sign in to react", "error");
    return;
  }
  try {
    const res = await fetch(`${BASE}/${_cid}/feed/${postId}/react`, {
      method: "PATCH",
      headers: auth(),
      body: JSON.stringify({ emoji }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    // Update local feed
    const post = _feed.find(
      (p) => p.id === postId || p.id === postId.toString(),
    );
    if (post) {
      const r = post.reactions.find((r) => r.emoji === emoji);
      if (r) {
        r.reacted = data.reacted;
        r.count = data.count;
      }
    }
    // Update just this button
    if (el) {
      el.classList.toggle("active", data.reacted);
      el.textContent = emoji + " " + data.count;
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* Post feed update */
async function postUpdate() {
  if (!isLoggedIn()) {
    showToast("Sign in to post", "error");
    return;
  }
  const ta = document.getElementById("comp-ta");
  const btn = document.getElementById("post-btn");
  const text = ta.value.trim();
  if (!text) return;

  btn.disabled = true;
  btn.textContent = "Posting…";
  try {
    const res = await fetch(`${BASE}/${_cid}/feed`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    ta.value = "";
    btn.textContent = "Post Update";
    _feed.unshift(data.post);
    _feedTotal++;
    renderFeed();
    showToast(data.message, "success");
    document.getElementById("feed-count").textContent =
      _feedTotal + " posts from participants";
  } catch (err) {
    showToast(err.message || "Could not post", "error");
    btn.disabled = false;
    btn.textContent = "Post Update";
  }
}

/* Delete own feed post */
async function deleteFeedPost(postId) {
  if (!confirm("Delete this post?")) return;
  try {
    const res = await fetch(`${BASE}/${_cid}/feed/${postId}`, {
      method: "DELETE",
      headers: auth(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    _feed = _feed.filter((p) => p.id !== postId && p.id !== postId.toString());
    renderFeed();
    showToast("Post deleted", "");
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* Copy link */
function copyLink() {
  navigator.clipboard.writeText(window.location.href).catch(() => {});
  showToast("Link copied!", "success");
}

/* Scroll to section */
function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ════════════════════════════════════════════════════════════
   COMPOSER BINDING
════════════════════════════════════════════════════════════ */
function bindComposer() {
  const ta = document.getElementById("comp-ta");
  const btn = document.getElementById("post-btn");
  if (ta && btn) {
    ta.addEventListener("input", () => {
      btn.disabled = !ta.value.trim();
    });
  }
}

/* ════════════════════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════════════════════ */
function initSidebarFromStorage() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setTxt("sb-prof-name", user.handle || "—");
    setTxt(
      "sb-prof-sub",
      (user.niche || "Crafter") + " · " + (user.points ?? 0) + " pts",
    );
    const av = document.getElementById("sb-prof-av");
    if (av && user.handle) {
      av.textContent = user.handle.slice(0, 2).toUpperCase();
      av.style.background = avatarColor(user.handle);
    }
  } catch (_) {}
}

function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("open");
  document.getElementById("overlay")?.classList.toggle("on");
}
function closeSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("overlay")?.classList.remove("on");
}

/* ════════════════════════════════════════════════════════════
   UTILITIES
════════════════════════════════════════════════════════════ */
function setTxt(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function setDisplay(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? "" : "none";
}
function animateBar(id, pct) {
  const el = document.getElementById(id);
  if (el)
    setTimeout(() => {
      el.style.width = pct + "%";
    }, 80);
}
function formatDateRange(start, end) {
  const fmt = (d) =>
    new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  return fmt(start) + " – " + fmt(end);
}
function avatarColor(handle = "") {
  const cols = [
    "#5e6e3b",
    "#8b6914",
    "#7054ae",
    "#3468a4",
    "#a46818",
    "#c03828",
  ];
  let h = 0;
  for (const ch of handle) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return cols[Math.abs(h) % cols.length];
}
function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Toast */
let _tt;
function showToast(msg, type = "") {
  if (typeof window.craftToast === "function") {
    window.craftToast(
      msg,
      type === "error" ? "error" : type === "success" ? "success" : "info",
    );
    return;
  }
  const t = document.getElementById("toast");
  const s = document.getElementById("toast-msg");
  if (!t || !s) return;
  s.textContent = msg;
  t.className = "toast show" + (type ? " " + type : "");
  clearTimeout(_tt);
  _tt = setTimeout(() => (t.className = "toast"), 3200);
}
document.addEventListener("DOMContentLoaded", () => {
  window.initSidebar();
});
