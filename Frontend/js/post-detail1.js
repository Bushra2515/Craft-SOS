// Frontend/js/post-detail.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Drives the post detail page. Reads ?id=POSTID from the URL, fetches the
//   full post from the backend, renders every section (hero, reactions, replies,
//   TOC, author widget, resources, related posts, tags), and wires up all
//   interactions with real API calls.
//
//   Endpoints used:
//     GET   /api/post-detail/:id              → load full post + author
//     PATCH /api/post-detail/:id/views        → increment view counter
//     POST  /api/post-detail/:id/reactions    → toggle emoji reaction
//     GET   /api/post-detail/:id/replies?sort=&page= → paginated replies
//     PATCH /api/post-detail/:id/replies/:rid/helpful → helpful toggle
//     GET   /api/post-detail/:id/related      → related posts sidebar
//     POST  /api/posts/:id/replies            → submit new reply (existing route)
//     PATCH /api/posts/:id/save               → save/unsave post   (existing route)
//     PATCH /api/dashboard/follow/:id         → follow/unfollow    (existing route)
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:5000/api";

/* ═══════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════ */
const token = localStorage.getItem("token");
const _me = JSON.parse(localStorage.getItem("user") || "{}");

if (!token) window.location.href = "login.html";

// // ── Read post ID from ?id=xxxx in the URL ────────────────
// const POST_ID = new URLSearchParams(window.location.search).get("id");
// if (!POST_ID) {
//   document.body.innerHTML = `<div style="padding:60px;text-align:center;color:#666">No post ID provided.<br><a href="../index.html">← Back to feed</a></div>`;
// }
// const POST_ID = new URLSearchParams(window.location.search).get("id");

// if (!POST_ID) {
//   document.addEventListener("DOMContentLoaded", () => {
//     document.body.innerHTML = `
//       <div style="padding:60px;text-align:center;color:#666;font-family:sans-serif;">
//         <h2>No post selected</h2>
//         <p>Please open a post from the feed.</p>
//         <a href="../index.html" style="color:#7a8f52;">← Back to feed</a>
//       </div>`;
//   });
//   // ✅ stop — nothing below should run without a valid ID
//   throw new Error("No POST_ID in URL — halting script");
// }
const _raw = new URLSearchParams(window.location.search).get("id");
const POST_ID =
  _raw && _raw !== "undefined" && /^[a-f\d]{24}$/i.test(_raw) ? _raw : null;

if (!POST_ID) {
  document.addEventListener("DOMContentLoaded", () => {
    document.body.innerHTML = `
      <div style="padding:60px;text-align:center;font-family:sans-serif;color:#666">
        <h2>Post not found</h2>
        <p>The link you followed doesn't point to a valid post.</p>
        <a href="../index.html" style="color:#7a8f52">← Back to feed</a>
      </div>`;
  });
  throw new Error("Invalid or missing POST_ID — stopping script");
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
let _post = null; // full post object from API
let _repliesPage = 1;
let _repliesSort = "top";
let _repliesHasMore = false;

/* ═══════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════ */
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return `${Math.floor(d / 7)} week${Math.floor(d / 7) !== 1 ? "s" : ""} ago`;
}

function initials(name = "", handle = "") {
  return (name || handle || "?").replace("@", "").slice(0, 2).toUpperCase();
}

function badge(b) {
  return (
    { Mentor: "🏆 Mentor", "Top Responder": "🌟 Star", Sage: "🌿 Sage" }[b] ??
    "⭐ Responder"
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

/* ═══════════════════════════════════════════════════════════
   BOOTSTRAP — LOAD FULL POST
═══════════════════════════════════════════════════════════ */
async function loadPost() {
  try {
    const { post } = await api(`/post-detail/${POST_ID}`);
    _post = post;

    document.title = `${post.title} — Craft-SOS`;

    renderHero(post);
    renderAuthorBar(post);
    renderReactions(post.reactions);
    renderEngageCounts(post);
    renderTOC();
    renderSidebarAuthor(post.author);
    renderResources(post.resources);
    renderTags(post.tags);
    populateUserAvatar();

    // Parallel: replies + related
    loadReplies();
    loadRelated(post.id);

    // Increment views (fire-and-forget)
    api(`/post-detail/${POST_ID}/views`, { method: "PATCH" }).catch(() => {});
  } catch (err) {
    console.error("[loadPost]", err);
    document.getElementById("post-col").innerHTML =
      `<div style="padding:60px;text-align:center;color:#666">Could not load post.<br><a href="../index.html">← Back to feed</a></div>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — HERO SECTION
   Fills the dynamic parts: title, type, view/reply/save counts.
═══════════════════════════════════════════════════════════ */
function renderHero(post) {
  const typeLabels = {
    sos: "🆘 Distress Call",
    tut: "📚 Tutorial",
    com: "💬 Community",
    res: "📦 Resource",
  };

  const coverType = document.querySelector(".hero-cover-type");
  const coverTitle = document.querySelector(".hero-cover-title");

  if (coverType) coverType.textContent = typeLabels[post.type] ?? post.type;
  if (coverTitle) coverTitle.textContent = post.title;

  // Read time: ~200 words per minute
  const wordCount = post.body.split(/\s+/).length;
  const readMins = Math.max(1, Math.round(wordCount / 200));
  const readEl = document.querySelector(".hcm-item:first-child");
  if (readEl)
    readEl.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${readMins} min read`;

  // Posted time in hero
  const postedEl = document.querySelector(".hcm-item:last-child");
  if (postedEl) postedEl.textContent = `🗓 Posted ${timeAgo(post.createdAt)}`;

  // Counts
  const viewEl = document.querySelectorAll(".hcm-item")[1];
  if (viewEl)
    viewEl.innerHTML = `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> ${post.views.toLocaleString()} views`;

  const respEl = document.querySelectorAll(".hcm-item")[2];
  if (respEl)
    respEl.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg> ${post.replyCount} responses`;
}

/* ═══════════════════════════════════════════════════════════
   RENDER — AUTHOR BAR (below hero cover)
═══════════════════════════════════════════════════════════ */
function renderAuthorBar(post) {
  const a = post.author;
  const av = document.querySelector(".author-av");
  if (av) {
    if (a.avatar) {
      av.style.backgroundImage = `url(${a.avatar})`;
      av.style.backgroundSize = "cover";
      av.textContent = "";
    } else {
      av.textContent = initials(a.name);
    }
  }

  const nameEl = document.querySelector(".author-name");
  const subEl = document.querySelector(".author-sub");
  if (nameEl) nameEl.textContent = a.name;
  if (subEl) {
    subEl.innerHTML = `
      <span>${a.handle}</span>
      <span class="dot-sep"></span>
      <span>${a.location || "Craft Community"}</span>
      <span class="dot-sep"></span>
      <span class="author-pts">
        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        ${a.points?.toLocaleString() ?? 0} pts · ${a.badges?.[0] ?? "Member"}
      </span>`;
  }

  // Save button reflects actual saved state
  const saveBtn = document.getElementById("save-btn");
  if (saveBtn && post.isSaved) saveBtn.classList.add("on");

  // Follow button reflects actual follow state
  const followLabel = document.getElementById("follow-label");
  if (followLabel && post.author.isFollowed) {
    followLabel.textContent = "Following ✓";
    document.querySelector(".ab-btn:nth-child(2)")?.classList.add("on");
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — REACTIONS BAR
═══════════════════════════════════════════════════════════ */
function renderReactions(reactions) {
  const bar = document.getElementById("reactions-bar");
  if (!bar) return;

  const html = reactions
    .map(
      (r, i) => `
    <button class="reaction-btn ${r.reacted ? "active" : ""}"
            onclick="toggleReaction('${r.emoji}',this)">
      <span class="emoji">${r.emoji}</span>
      <span>${r.label}</span>
      <strong id="r-${i}">${r.count.toLocaleString()}</strong>
    </button>`,
    )
    .join("");

  bar.innerHTML =
    html +
    `<div class="reaction-sep"></div>
    <div class="share-row">
      <button class="share-btn" title="Copy link" onclick="copyLink(this)">
        <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
      <button class="share-btn" title="Bookmark" onclick="toggleSave()">
        <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
      </button>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════
   RENDER — ENGAGEMENT COUNTS (below reactions)
═══════════════════════════════════════════════════════════ */
function renderEngageCounts(post) {
  const viewsEl = document.querySelectorAll(".en")[0];
  const respEl = document.getElementById("resp-num");
  const saveNumEl = document.getElementById("save-num");
  if (viewsEl)
    viewsEl.innerHTML = `<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>${post.views.toLocaleString()} views`;
  if (respEl) respEl.textContent = post.replyCount;
  if (saveNumEl) saveNumEl.textContent = post.saveCount.toLocaleString();
  const cCount = document.getElementById("c-count");
  if (cCount) cCount.textContent = post.replyCount;
}

/* ═══════════════════════════════════════════════════════════
   RENDER — TABLE OF CONTENTS
   Built from actual <h3> elements inside .post-body
═══════════════════════════════════════════════════════════ */
function renderTOC() {
  const body = document.getElementById("post-body");
  const tocList = document.getElementById("toc-list");
  if (!body || !tocList) return;

  const headings = Array.from(body.querySelectorAll("h3, .step-title"));
  if (!headings.length) return;

  tocList.innerHTML = headings
    .map((h, i) => {
      const id = h.id || `section-${i}`;
      h.id = id;
      return `<div class="toc-item ${i === 0 ? "active" : ""}"
                 onclick="scrollToSection('${id}', this)">
      <span class="toc-num">${i + 1}</span>${h.textContent.trim()}
    </div>`;
    })
    .join("");
}

function scrollToSection(id, el) {
  document
    .querySelectorAll(".toc-item")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ═══════════════════════════════════════════════════════════
   RENDER — SIDEBAR AUTHOR WIDGET
═══════════════════════════════════════════════════════════ */
function renderSidebarAuthor(a) {
  const miniAv = document.querySelector(".mini-av");
  const miniName = document.querySelector(".mini-name");
  const miniHdl = document.querySelector(".mini-handle");
  const miniBio = document.querySelector(".mini-bio");
  const msEls = document.querySelectorAll(".ms");
  const followBtn = document.getElementById("follow-btn");

  if (miniAv) {
    if (a.avatar) {
      miniAv.style.backgroundImage = `url(${a.avatar})`;
      miniAv.style.backgroundSize = "cover";
      miniAv.textContent = "";
    } else {
      miniAv.textContent = initials(a.name);
    }
  }
  if (miniName) miniName.textContent = a.name;
  if (miniHdl) miniHdl.textContent = `${a.handle} · ${a.location || ""}`;
  if (miniBio) miniBio.textContent = a.bio || "No bio yet.";

  if (msEls[0]) {
    msEls[0].querySelector("strong").textContent = a.friendCount ?? 0;
  }
  if (msEls[1]) {
    msEls[1].querySelector("strong").textContent = (
      a.points ?? 0
    ).toLocaleString();
  }
  if (msEls[2]) {
    msEls[2].querySelector("strong").textContent = a.postCount ?? 0;
  }

  if (followBtn) {
    followBtn.textContent = a.isFollowed ? "✓ Following" : "+ Follow";
    followBtn.classList.toggle("following", a.isFollowed);
    followBtn.dataset.id = a.id;
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — FREE RESOURCES WIDGET
═══════════════════════════════════════════════════════════ */
function renderResources(resources = []) {
  const el = document.getElementById("resources-list");
  if (!el) return;

  if (!resources.length) {
    el.innerHTML = `<p style="color:var(--text-light);font-size:.83rem;padding:4px 0">No resources attached.</p>`;
    return;
  }

  el.innerHTML = resources
    .map(
      (r) => `
    <div class="resource-item">
      <div class="res-icon" style="background:var(--accent-light)">${r.emoji || "📄"}</div>
      <div class="res-body">
        <div class="res-title">${r.title}</div>
        <div class="res-type">${r.type || ""}</div>
      </div>
      <div class="res-dl" ${r.url ? `onclick="window.open('${r.url}','_blank')" style="cursor:pointer"` : ""}>
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </div>
    </div>`,
    )
    .join("");
}

/* ═══════════════════════════════════════════════════════════
   RENDER — RELATED POSTS WIDGET  (from API)
═══════════════════════════════════════════════════════════ */
async function loadRelated(postId) {
  const el = document.getElementById("related-list");
  if (!el) return;

  const TYPE_EMOJI = { sos: "🆘", tut: "📚", com: "💬", res: "📦" };
  try {
    const { related } = await api(`/post-detail/${postId}/related`);
    el.innerHTML = related.length
      ? related
          .map(
            (r) => `
          <div class="related-item" style="cursor:pointer"
               onclick="window.location.href='post-detail.html?id=${r.id}'">
            <div class="rel-thumb">${TYPE_EMOJI[r.type] ?? "📄"}</div>
            <div>
              <div class="rel-title">${r.title}</div>
              <div class="rel-meta">${r.meta}</div>
            </div>
          </div>`,
          )
          .join("")
      : `<p style="color:var(--text-light);font-size:.83rem;padding:4px 0">No related posts yet.</p>`;
  } catch {
    el.innerHTML = `<p style="color:var(--text-light);font-size:.83rem;">Could not load related posts.</p>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — TAGS WIDGET
═══════════════════════════════════════════════════════════ */
function renderTags(tags = []) {
  const el = document.getElementById("tags-wrap");
  if (!el) return;
  el.innerHTML = tags
    .map((t) => `<span class="tag-pill">#${t.replace(/^#/, "")}</span>`)
    .join("");
}

/* ═══════════════════════════════════════════════════════════
   RENDER — REPLIES FEED  (paginated, from API)
═══════════════════════════════════════════════════════════ */
async function loadReplies(append = false) {
  const feed = document.getElementById("resp-feed");
  if (!feed) return;

  if (!append) {
    feed.innerHTML =
      `<div class="loading-shimmer" style="height:80px;border-radius:12px;margin-bottom:12px;"></div>`.repeat(
        3,
      );
  }

  try {
    const { replies, hasMore } = await api(
      `/post-detail/${POST_ID}/replies?sort=${_repliesSort}&page=${_repliesPage}`,
    );
    _repliesHasMore = hasMore;

    const html = replies
      .map((r) => {
        const a = r.author;
        const avHtml = a?.avatar
          ? `<div class="resp-card-av" style="background-image:url(${a.avatar});background-size:cover;"></div>`
          : `<div class="resp-card-av" style="background:${colorFor(a?.id)}">${initials(a?.name)}</div>`;

        const rank = a?.badges?.[0] ? badge(a.badges[0]) : "🌱 Member";
        const isOwn = a?.id?.toString() === _me?.id;

        return `
      <div class="resp-card ${isOwn ? "own" : ""}" id="reply-${r.id}">
        ${avHtml}
        <div class="resp-card-body">
          <div class="resp-card-header">
            <span class="resp-card-name">${a?.name ?? "Unknown"}</span>
            <span class="resp-card-rank">${rank}</span>
            <span class="resp-card-time">${timeAgo(r.createdAt)}</span>
          </div>
          <div class="resp-card-text">${escapeHTML(r.body)}</div>
          <div class="resp-card-footer">
            <button class="resp-action ${r.hasVoted ? "liked" : ""}"
                    onclick="toggleHelpful('${r.id}', this)">
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              <span id="hv-${r.id}">${r.helpfulCount}</span>
            </button>
            <button class="resp-action" onclick="replyTo('${escapeAttr(a?.name ?? "")}')">
              <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Reply
            </button>
          </div>
        </div>
      </div>`;
      })
      .join("");

    if (append) {
      feed.querySelectorAll(".loading-shimmer").forEach((el) => el.remove());
      feed.insertAdjacentHTML("beforeend", html);
    } else {
      feed.innerHTML =
        html ||
        `<p style="color:var(--text-light);padding:20px 0;font-size:.88rem;">No responses yet — be the first to help 🌿</p>`;
    }

    // Show/hide "load more" button
    const loadMoreBtn = document.querySelector(".resp-load-btn");
    if (loadMoreBtn) loadMoreBtn.style.display = hasMore ? "block" : "none";
  } catch (err) {
    feed.innerHTML = `<p style="color:var(--text-light);">Could not load replies.</p>`;
    console.error("[loadReplies]", err);
  }
}

/* ═══════════════════════════════════════════════════════════
   INTERACTIONS
═══════════════════════════════════════════════════════════ */

// ── Save / bookmark ───────────────────────────────────────
async function toggleSave(btn) {
  const saveBtn = document.getElementById("save-btn");
  const saveNumEl = document.getElementById("save-num");
  const isNowSaved = !saveBtn?.classList.contains("on");

  // Optimistic
  saveBtn?.classList.toggle("on", isNowSaved);
  if (saveNumEl) {
    const cur = parseInt(saveNumEl.textContent.replace(/,/g, "")) || 0;
    saveNumEl.textContent = (cur + (isNowSaved ? 1 : -1)).toLocaleString();
  }

  try {
    await api(`/posts/${POST_ID}/save`, { method: "PATCH" });
  } catch {
    // Revert on failure
    saveBtn?.classList.toggle("on", !isNowSaved);
    if (saveNumEl) {
      const cur = parseInt(saveNumEl.textContent.replace(/,/g, "")) || 0;
      saveNumEl.textContent = (cur + (isNowSaved ? -1 : 1)).toLocaleString();
    }
  }
}

// ── Follow author ─────────────────────────────────────────
async function toggleFollow(btn) {
  const authorId = _post?.author?.id;
  if (!authorId) return;

  const isNowFollowing = !btn?.classList.contains("on");
  const followLabel = document.getElementById("follow-label");
  const followBtn2 = document.getElementById("follow-btn");

  // Optimistic
  btn?.classList.toggle("on", isNowFollowing);
  if (followLabel)
    followLabel.textContent = isNowFollowing ? "Following ✓" : "Follow";
  if (followBtn2) {
    followBtn2.textContent = isNowFollowing ? "✓ Following" : "+ Follow";
    followBtn2.classList.toggle("following", isNowFollowing);
  }

  try {
    await api(`/dashboard/follow/${authorId}`, { method: "PATCH" });
  } catch {
    btn?.classList.toggle("on", !isNowFollowing);
    if (followLabel)
      followLabel.textContent = isNowFollowing ? "Follow" : "Following ✓";
    if (followBtn2) {
      followBtn2.textContent = isNowFollowing ? "+ Follow" : "✓ Following";
      followBtn2.classList.toggle("following", !isNowFollowing);
    }
  }
}

// ── Reaction toggle ───────────────────────────────────────
async function toggleReaction(emoji, btn) {
  const strong = btn?.querySelector("strong");
  const wasActive = btn?.classList.contains("active");

  // Optimistic
  btn?.classList.toggle("active", !wasActive);
  if (strong)
    strong.textContent = (
      (parseInt(strong.textContent.replace(/,/g, "")) || 0) +
      (wasActive ? -1 : 1)
    ).toLocaleString();

  try {
    const { reactions } = await api(`/post-detail/${POST_ID}/reactions`, {
      method: "POST",
      body: JSON.stringify({ emoji }),
    });
    // Re-render the whole reactions bar with server truth
    renderReactions(reactions);
  } catch {
    // Revert
    btn?.classList.toggle("active", wasActive);
    if (strong)
      strong.textContent = (
        (parseInt(strong.textContent.replace(/,/g, "")) || 0) +
        (wasActive ? 1 : -1)
      ).toLocaleString();
  }
}

// ── Post a new reply ──────────────────────────────────────
async function postComment() {
  const ta = document.getElementById("reply-ta");
  const btn = document.getElementById("send-btn");
  const text = ta.value.trim();
  if (!text) return;

  btn.disabled = true;

  try {
    showTyping();
    await api(`/posts/${POST_ID}/replies`, {
      method: "POST",
      body: JSON.stringify({ body: text }),
    });

    ta.value = "";
    ta.style.height = "auto";
    updateCharCount();
    updateSendBtn();

    // Reload replies from server (shows the user's own new reply)
    _repliesPage = 1;
    setTimeout(async () => {
      hideTyping();
      await loadReplies(false);

      // Bump the reply count in the UI
      const cCount = document.getElementById("c-count");
      const respNum = document.getElementById("resp-num");
      const cur = parseInt(cCount?.textContent || "0") + 1;
      if (cCount) cCount.textContent = cur;
      if (respNum) respNum.textContent = cur;
    }, 800);
  } catch (err) {
    hideTyping();
    btn.disabled = false;
    console.error("[postComment]", err);
  }
}

// ── Helpful vote ──────────────────────────────────────────
async function toggleHelpful(replyId, btn) {
  const countEl = document.getElementById(`hv-${replyId}`);
  const wasVoted = btn.classList.contains("liked");

  // Optimistic
  btn.classList.toggle("liked", !wasVoted);
  if (countEl)
    countEl.textContent =
      (parseInt(countEl.textContent) || 0) + (wasVoted ? -1 : 1);

  try {
    const { helpfulCount, hasVoted } = await api(
      `/post-detail/${POST_ID}/replies/${replyId}/helpful`,
      { method: "PATCH" },
    );
    btn.classList.toggle("liked", hasVoted);
    if (countEl) countEl.textContent = helpfulCount;
  } catch {
    btn.classList.toggle("liked", wasVoted);
    if (countEl)
      countEl.textContent =
        (parseInt(countEl.textContent) || 0) + (wasVoted ? 1 : -1);
  }
}

// ── Load more replies ─────────────────────────────────────
function loadMore() {
  if (!_repliesHasMore) return;
  _repliesPage += 1;
  loadReplies(true);
}

// ── Sort replies ──────────────────────────────────────────
function sortComments(val) {
  _repliesSort = val;
  _repliesPage = 1;
  loadReplies(false);
}

// ── Prefix textarea with @name ────────────────────────────
function replyTo(name) {
  const ta = document.getElementById("reply-ta");
  ta.value = `@${name} `;
  ta.focus();
  updateCharCount();
  updateSendBtn();
  ta.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ── Typing indicator ──────────────────────────────────────
function showTyping() {
  const feed = document.getElementById("resp-feed");
  if (!feed) return;
  const t = document.createElement("div");
  t.className = "resp-typing";
  t.id = "typing-ind";
  t.innerHTML = `
    <div class="resp-typing-av">${initials(_me?.name)}</div>
    <div class="resp-typing-dots">
      <div class="resp-typing-dot"></div>
      <div class="resp-typing-dot"></div>
      <div class="resp-typing-dot"></div>
    </div>`;
  feed.appendChild(t);
  feed.scrollTop = feed.scrollHeight;
}

function hideTyping() {
  document.getElementById("typing-ind")?.remove();
}

// ── Textarea helpers ──────────────────────────────────────
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 110) + "px";
  updateCharCount();
  updateSendBtn();
}

function updateCharCount() {
  const ta = document.getElementById("reply-ta");
  const cnt = document.getElementById("char-count");
  if (ta && cnt) cnt.textContent = `${ta.value.length} / 600`;
}

function updateSendBtn() {
  const ta = document.getElementById("reply-ta");
  const btn = document.getElementById("send-btn");
  if (ta && btn) btn.disabled = ta.value.trim().length === 0;
}

function addEmoji(e) {
  const ta = document.getElementById("reply-ta");
  if (!ta) return;
  ta.value += e;
  ta.focus();
  updateCharCount();
  updateSendBtn();
}

function handleKey(evt) {
  if (evt.key === "Enter" && evt.ctrlKey) {
    evt.preventDefault();
    postComment();
  }
}

// ── Copy link ─────────────────────────────────────────────
function copyLink(btn) {
  navigator.clipboard?.writeText(window.location.href).catch(() => {});
  if (btn) {
    btn.style.background = "var(--accent)";
    btn.style.color = "white";
    setTimeout(() => {
      btn.style.background = "";
      btn.style.color = "";
    }, 900);
  }
}

// ── XSS helpers ───────────────────────────────────────────
function escapeHTML(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(str = "") {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

/* ═══════════════════════════════════════════════════════════
   READING PROGRESS BAR
═══════════════════════════════════════════════════════════ */
window.addEventListener("scroll", () => {
  const el = document.getElementById("post-body");
  const bar = document.getElementById("read-progress");
  if (!el || !bar) return;
  const rect = el.getBoundingClientRect();
  const scrolled = Math.max(0, -rect.top);
  const pct = Math.min(100, (scrolled / el.offsetHeight) * 100);
  bar.style.width = pct + "%";

  // Sync active TOC item
  const tocItems = document.querySelectorAll(".toc-item");
  if (tocItems.length) {
    const idx = Math.min(
      Math.floor(pct / (100 / tocItems.length)),
      tocItems.length - 1,
    );
    tocItems.forEach((t, i) => t.classList.toggle("active", i === idx));
  }
});

/* ═══════════════════════════════════════════════════════════
   SIDEBAR NAV
═══════════════════════════════════════════════════════════ */
function populateUserAvatar() {
  const btn = document.querySelector(".profile-av-btn");
  if (!btn) return;
  if (_me?.avatar) {
    btn.style.backgroundImage = `url(${_me.avatar})`;
    btn.style.backgroundSize = "cover";
  } else {
    btn.textContent = initials(_me?.name);
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
  }
  const sbName = document.querySelector(".sb-prof-name");
  const sbSub = document.querySelector(".sb-prof-sub");
  const sbAv = document.querySelector(".sb-prof-av");
  if (sbName) sbName.textContent = _me?.name || "You";
  if (sbSub) sbSub.textContent = _me?.handle || "";
  if (sbAv && _me?.avatar) {
    sbAv.style.backgroundImage = `url(${_me.avatar})`;
    sbAv.style.backgroundSize = "cover";
  } else if (sbAv) sbAv.textContent = initials(_me?.name);

  // Reply composer avatar
  const compAv = document.querySelector(".resp-composer-av");
  if (compAv) {
    compAv.textContent = initials(_me?.name);
  }
}

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
   INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Wire Distress Call button
  const distressBtn = document.querySelector(".distress-btn");
  if (distressBtn)
    distressBtn.onclick = () => (window.location.href = "create-post.html");

  if (POST_ID) loadPost();
});
