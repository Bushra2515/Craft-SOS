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
//     GET   /api/post-detail/:id/replies      → paginated + sorted replies
//     PATCH /api/post-detail/:id/replies/:rid/helpful → helpful toggle
//     GET   /api/post-detail/:id/related      → related posts sidebar
//     POST  /api/posts/:id/replies            → submit new reply (existing route)
//     PATCH /api/posts/:id/save               → save/unsave post
//     PATCH /api/dashboard/follow/:id         → follow/unfollow
//
//   Socket events (via window.craftSocket from socket-client.js):
//     EMIT  post:join     → join the post room on load
//     EMIT  comment:new   → notify others when user posts a reply
//     ON    comment:new   → receive others' replies live
//     ON    post:resolved → show resolved banner if author marks it solved
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:5000/api";

/* ═══════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════ */
const token = localStorage.getItem("token");
const _me = JSON.parse(localStorage.getItem("user") || "{}");

if (!token) window.location.href = "login.html";

const POST_ID = new URLSearchParams(window.location.search).get("id");
if (!POST_ID) {
  document.body.innerHTML = `<div style="padding:60px;text-align:center;color:#666">No post ID.<br><a href="../index.html">← Back to feed</a></div>`;
}

/* ═══════════════════════════════════════════════════════════
   FETCH HELPER
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
   STATE
═══════════════════════════════════════════════════════════ */
let _post = null;
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
   SOCKET — join room + live reply listener
   All socket wiring is done here, after DOMContentLoaded,
   so window.craftSocket (set by socket-client.js) is ready.
═══════════════════════════════════════════════════════════ */
function initSocket() {
  const sock = window.craftSocket;
  if (!sock || !POST_ID) return;

  // 1. Join this post's room — server will broadcast events here
  sock.emit("post:join", { postId: POST_ID });

  // 2. Live reply: someone else posted while you're on the page
  sock.on("comment:new", (reply) => {
    // Don't double-add own reply (already added by postComment() reload)
    if (reply?.author?.id?.toString() === _me?.id?.toString()) return;
    appendLiveReply(reply);
  });

  // 3. Post resolved by author
  sock.on("post:resolved", ({ postId }) => {
    if (postId !== POST_ID) return;
    const heroType = document.querySelector(".hero-cover-type");
    if (heroType && !heroType.querySelector(".resolved-badge")) {
      const badge = document.createElement("span");
      badge.className = "resolved-badge";
      badge.style.cssText =
        "margin-left:10px;background:#e5ecda;color:#4a6741;padding:2px 10px;border-radius:20px;font-size:.78rem;font-weight:700;";
      badge.textContent = "✅ Resolved";
      heroType.appendChild(badge);
    }
  });
}

/* Append a reply card received via socket (identical layout to loadReplies) */
function appendLiveReply(r) {
  const feed = document.getElementById("resp-feed");
  if (!feed) return;

  const a = r.author;
  const avHtml = a?.avatar
    ? `<div class="resp-card-av" style="background-image:url(${a.avatar});background-size:cover;background-position:center;"></div>`
    : `<div class="resp-card-av" style="background:${colorFor(a?.id)}">${initials(a?.name)}</div>`;

  const rank = a?.badges?.[0] ? badge(a.badges[0]) : "🌱 Member";

  const div = document.createElement("div");
  div.className = "resp-card live-reply";
  div.id = `reply-${r.id}`;
  div.style.cssText =
    "animation:fadeIn .35s ease;border-left:3px solid var(--accent);";
  div.innerHTML = `
    ${avHtml}
    <div class="resp-card-body">
      <div class="resp-card-header">
        <span class="resp-card-name">${escapeHTML(a?.name ?? "Unknown")}</span>
        <span class="resp-card-rank">${rank}</span>
        <span class="resp-card-time">Just now</span>
        <span style="font-size:.7rem;color:var(--accent);font-weight:600;margin-left:6px;">● Live</span>
      </div>
      <div class="resp-card-text">${sanitizeHTML(r.body)}</div>
      <div class="resp-card-footer">
        <button class="resp-action" onclick="toggleHelpful('${r.id}',this)">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          <span id="hv-${r.id}">0</span>
        </button>
        <button class="resp-action" onclick="replyTo('${escapeAttr(a?.name ?? "")}')">
          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          Reply
        </button>
      </div>
    </div>`;

  // Insert before the existing first card (most-recent at top for "recent" sort)
  // or append if sorted by "top" (no natural position)
  if (_repliesSort === "recent") {
    const first = feed.querySelector(".resp-card");
    first ? feed.insertBefore(div, first) : feed.appendChild(div);
  } else {
    feed.appendChild(div);
  }

  // Bump reply count
  const cCount = document.getElementById("c-count");
  const respNum = document.getElementById("resp-num");
  if (cCount) cCount.textContent = parseInt(cCount.textContent || "0") + 1;
  if (respNum) respNum.textContent = parseInt(respNum.textContent || "0") + 1;
}

/* ═══════════════════════════════════════════════════════════
   LOAD FULL POST
═══════════════════════════════════════════════════════════ */
async function loadPost() {
  try {
    const { post } = await api(`/post-detail/${POST_ID}`);
    _post = post;

    document.title = `${post.title} — Craft-SOS`;

    renderBreadcrumb(post);
    renderHero(post);
    renderCoverPills(post);
    renderAuthorBar(post);
    renderPostBody(post);
    renderReactions(post.reactions);
    renderEngageCounts(post);
    renderTOC();
    renderSidebarAuthor(post.author);
    renderResources(post.resources);
    renderTags(post.tags);
    // populateUserAvatar();
    initSidebar(_me);

    // Parallel loads
    loadReplies();
    loadRelated(post.id);

    // Join socket room for live updates
    initSocket();

    // Increment views (fire-and-forget, deduplicated server-side)
    api(`/post-detail/${POST_ID}/views`, { method: "PATCH" }).catch(() => {});
  } catch (err) {
    console.error("[loadPost]", err);
    document.getElementById("post-col").innerHTML =
      `<div style="padding:60px;text-align:center;color:#666">Could not load post.<br><a href="../index.html">← Back to feed</a></div>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — BREADCRUMB
═══════════════════════════════════════════════════════════ */
function renderBreadcrumb(post) {
  const el = document.querySelector(".breadcrumb");
  if (!el) return;

  const TYPE_LABELS = {
    sos: { label: "Distress Calls", filter: "distress" },
    tut: { label: "Tutorials", filter: "tutorial" },
    com: { label: "Community", filter: "community" },
    res: { label: "Resources", filter: "resource" },
  };
  const t = TYPE_LABELS[post.type] ?? { label: "Posts", filter: "all" };
  const shortTitle =
    post.title.length > 48 ? post.title.slice(0, 45) + "…" : post.title;

  el.innerHTML = `
    <a href="../index.html">Home</a>
    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
    <a href="explore.html?filter=${t.filter}">${t.label}</a>
    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
    <span>${escapeHTML(shortTitle)}</span>`;
}

/* ═══════════════════════════════════════════════════════════
   RENDER — COVER PILLS
═══════════════════════════════════════════════════════════ */
function renderCoverPills(post) {
  const el = document.querySelector(".cover-pills");
  if (!el) return;

  const TYPE_PILL = {
    sos: "🆘 Needs Help",
    tut: "📚 Tutorial",
    com: "💬 Discussion",
    res: "📦 Resource",
  };
  const statusPill =
    post.status === "resolved"
      ? `<span class="cover-pill">✅ Resolved</span>`
      : "";
  const tagPills = (post.tags || [])
    .slice(0, 2)
    .map((t) => `<span class="cover-pill">#${escapeHTML(t)}</span>`)
    .join("");

  el.innerHTML = `
    <span class="cover-pill">${TYPE_PILL[post.type] ?? "📄 Post"}</span>
    ${statusPill}${tagPills}`;
}

/* ═══════════════════════════════════════════════════════════
   RENDER — POST BODY (markdown-lite)
═══════════════════════════════════════════════════════════ */
// function renderPostBody(post) {
//   const el = document.getElementById("post-body");
//   if (!el) return;

//   const paras = (post.body || "").split(/\n\n+/);
//   const html = paras
//     .map((para) => {
//       const line = para.trim();
//       if (!line) return "";
//       if (/^##\s/.test(line)) {
//         return `<h3 class="post-section-heading">${escapeHTML(line.replace(/^##\s+/, ""))}</h3>`;
//       }
//       if (/^#\s/.test(line)) {
//         return `<h2 class="post-main-heading">${escapeHTML(line.replace(/^#\s+/, ""))}</h2>`;
//       }
//       const formatted = escapeHTML(line)
//         .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
//         .replace(/\*(.+?)\*/g, "<em>$1</em>")
//         .replace(/\n/g, "<br>");
//       return `<p class="post-para">${formatted}</p>`;
//     })
//     .join("\n");

//   el.innerHTML =
//     html ||
//     `<p style="color:var(--text-light);font-style:italic;">No content.</p>`;
// }
/* ═══════════════════════════════════════════════════════════
   RENDER — POST BODY (supports both HTML and markdown)
═══════════════════════════════════════════════════════════ */
function renderPostBody(post) {
  const el = document.getElementById("post-body");
  if (!el) return;

  const body = post.body || "";

  // Check if content contains HTML tags (from rich text editor)
  const hasHTMLTags = /<\/?[a-z][\s\S]*>/i.test(body);

  if (hasHTMLTags) {
    // Content is HTML from rich text editor - sanitize and render directly
    el.innerHTML = sanitizeHTML(body);
  } else {
    // Content is plain text/markdown - apply markdown parsing
    const paras = body.split(/\n\n+/);
    const html = paras
      .map((para) => {
        const line = para.trim();
        if (!line) return "";
        if (/^##\s/.test(line)) {
          return `<h3 class="post-section-heading">${escapeHTML(line.replace(/^##\s+/, ""))}</h3>`;
        }
        if (/^#\s/.test(line)) {
          return `<h2 class="post-main-heading">${escapeHTML(line.replace(/^#\s+/, ""))}</h2>`;
        }
        const formatted = escapeHTML(line)
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(/\n/g, "<br>");
        return `<p class="post-para">${formatted}</p>`;
      })
      .join("\n");

    el.innerHTML =
      html ||
      `<p style="color:var(--text-light);font-style:italic;">No content.</p>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   SANITIZE HTML - Remove dangerous tags/attributes but keep formatting
═══════════════════════════════════════════════════════════ */
function sanitizeHTML(html) {
  // Create a temporary div to parse HTML
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // List of allowed tags
  const allowedTags = [
    "P",
    "BR",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "S",
    "MARK",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "UL",
    "OL",
    "LI",
    "BLOCKQUOTE",
    "PRE",
    "CODE",
    "A",
    "HR",
    "DIV",
    "SPAN",
    "TABLE",
    "THEAD",
    "TBODY",
    "TR",
    "TH",
    "TD",
  ];

  // Recursive function to clean nodes
  function cleanNode(node) {
    // If it's a text node, keep it
    if (node.nodeType === 3) return node.cloneNode(true);

    // If it's an element node
    if (node.nodeType === 1) {
      const tagName = node.tagName.toUpperCase();

      // Remove dangerous tags
      if (!allowedTags.includes(tagName)) {
        const frag = document.createDocumentFragment();
        Array.from(node.childNodes).forEach((child) => {
          const cleaned = cleanNode(child);
          if (cleaned) frag.appendChild(cleaned);
        });
        return frag;
      }

      // Create a clean copy of the element
      const cleaned = document.createElement(tagName);

      // Copy safe attributes
      if (tagName === "A") {
        const href = node.getAttribute("href");
        if (
          href &&
          (href.startsWith("http://") ||
            href.startsWith("https://") ||
            href.startsWith("/"))
        ) {
          cleaned.setAttribute("href", href);
          cleaned.setAttribute("target", "_blank");
          cleaned.setAttribute("rel", "noopener noreferrer");
        }
      }

      // Copy style attribute for specific elements (limited CSS)
      if (["DIV", "SPAN", "P"].includes(tagName)) {
        const style = node.getAttribute("style");
        if (style) {
          // Only allow safe style properties
          const safeStyles = style
            .split(";")
            .map((s) => s.trim())
            .filter((s) => {
              const prop = s.split(":")[0]?.trim().toLowerCase();
              return [
                "color",
                "background-color",
                "font-weight",
                "font-style",
                "text-decoration",
                "text-align",
                "margin",
                "padding",
              ].includes(prop);
            })
            .join(";");
          if (safeStyles) cleaned.setAttribute("style", safeStyles);
        }
      }

      // Recursively clean child nodes
      Array.from(node.childNodes).forEach((child) => {
        const cleanedChild = cleanNode(child);
        if (cleanedChild) cleaned.appendChild(cleanedChild);
      });

      return cleaned;
    }

    return null;
  }

  // Clean the entire tree
  const cleaned = document.createElement("div");
  Array.from(temp.childNodes).forEach((node) => {
    const cleanedNode = cleanNode(node);
    if (cleanedNode) cleaned.appendChild(cleanedNode);
  });

  return cleaned.innerHTML;
}
/* ═══════════════════════════════════════════════════════════
   RENDER — HERO
═══════════════════════════════════════════════════════════ */
function renderHero(post) {
  const TYPE_LABELS = {
    sos: "🆘 Distress Call",
    tut: "📚 Tutorial",
    com: "💬 Community",
    res: "📦 Resource",
  };

  const coverType = document.querySelector(".hero-cover-type");
  if (coverType) coverType.textContent = TYPE_LABELS[post.type] ?? post.type;

  const coverTitle = document.querySelector(".hero-cover-title");
  if (coverTitle) coverTitle.textContent = post.title;

  const wordCount = (post.body || "").split(/\s+/).filter(Boolean).length;
  const readMins = Math.max(1, Math.round(wordCount / 200));

  const metaEl = document.querySelector(".hero-cover-meta");
  if (metaEl) {
    metaEl.innerHTML = `
      <div class="hcm-item">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${readMins} min read
      </div>
      <div class="hcm-item">
        <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        ${(post.views || 0).toLocaleString()} views
      </div>
      <div class="hcm-item">
        <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        ${post.replyCount ?? 0} responses
      </div>
      <div class="hcm-item">🗓 Posted ${timeAgo(post.createdAt)}</div>`;
  }
}

/* ═══════════════════════════════════════════════════════════
   RENDER — AUTHOR BAR
═══════════════════════════════════════════════════════════ */
function renderAuthorBar(post) {
  const a = post.author;
  const av = document.querySelector(".author-av");
  if (av) {
    if (a.avatar) {
      av.style.backgroundImage = `url(${a.avatar})`;
      av.style.backgroundSize = "cover";
      av.style.backgroundPosition = "center";
      av.innerHTML = "";
    } else {
      av.textContent = initials(a.name);
      av.style.background = colorFor(String(a.id));
      av.style.color = "#fff";
    }
  }

  const nameEl = document.querySelector(".author-name");
  const subEl = document.querySelector(".author-sub");
  if (nameEl) nameEl.textContent = a.name;
  if (subEl) {
    subEl.innerHTML = `
      <span>${escapeHTML(a.handle)}</span>
      <span class="dot-sep"></span>
      <span>${escapeHTML(a.location || "Craft Community")}</span>
      <span class="dot-sep"></span>
      <span class="author-pts">
        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        ${(a.points ?? 0).toLocaleString()} pts · ${a.badges?.[0] ?? "Member"}
      </span>`;
  }

  // Wire author avatar click → their public profile
  if (av) av.style.cursor = "pointer";
  av?.addEventListener("click", () => {
    if (a.id) window.location.href = `crafter-profile.html?id=${a.id}`;
  });
  if (nameEl) {
    nameEl.style.cursor = "pointer";
    nameEl.addEventListener("click", () => {
      if (a.id) window.location.href = `crafter-profile.html?id=${a.id}`;
    });
  }

  const saveBtn = document.getElementById("save-btn");
  if (saveBtn && post.isSaved) saveBtn.classList.add("on");

  const followLabel = document.getElementById("follow-label");
  if (followLabel && post.author.isFollowed) {
    followLabel.textContent = "Following ✓";
    document.querySelector(".ab-btn:nth-child(2)")?.classList.add("on");
  }

  // ← REPLACE the old author-actions block with this:
  const authorActions = document.querySelector(".author-bar-actions");
  if (authorActions) {
    const reportBtn = document.createElement("button");
    reportBtn.className = "ab-btn";
    reportBtn.innerHTML = "⚑ Report";
    reportBtn.style.cssText =
      "color:#c0392b;border-color:rgba(192,67,42,.25);font-size:.78rem;";
    reportBtn.onclick = () => openReportModal(POST_ID, "post");
    authorActions.appendChild(reportBtn);
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
      <span>${escapeHTML(r.label)}</span>
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
   RENDER — ENGAGEMENT COUNTS
═══════════════════════════════════════════════════════════ */
function renderEngageCounts(post) {
  const viewsEl = document.getElementById("views-num");
  const respEl = document.getElementById("resp-num");
  const saveNumEl = document.getElementById("save-num");
  const cCount = document.getElementById("c-count");

  if (viewsEl) viewsEl.textContent = (post.views || 0).toLocaleString();
  if (respEl) respEl.textContent = post.replyCount;
  if (saveNumEl) saveNumEl.textContent = (post.saveCount || 0).toLocaleString();
  if (cCount) cCount.textContent = post.replyCount;
}

/* ═══════════════════════════════════════════════════════════
   RENDER — TABLE OF CONTENTS
═══════════════════════════════════════════════════════════ */
function renderTOC() {
  const body = document.getElementById("post-body");
  const tocList = document.getElementById("toc-list");
  if (!body || !tocList) return;

  const headings = Array.from(body.querySelectorAll("h3,.step-title"));
  if (!headings.length) {
    tocList.innerHTML = `<p style="color:var(--text-light);font-size:.82rem;">No sections</p>`;
    return;
  }

  tocList.innerHTML = headings
    .map((h, i) => {
      const id = h.id || `section-${i}`;
      h.id = id;
      return `<div class="toc-item ${i === 0 ? "active" : ""}"
               onclick="scrollToSection('${id}',this)">
      <span class="toc-num">${i + 1}</span>${escapeHTML(h.textContent.trim())}
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
      miniAv.style.backgroundPosition = "center";
      miniAv.innerHTML = "";
    } else {
      miniAv.textContent = initials(a.name);
      miniAv.style.background = colorFor(String(a.id));
      miniAv.style.color = "#fff";
    }
    // Click → crafter profile
    miniAv.style.cursor = "pointer";
    miniAv.onclick = () => {
      if (a.id) window.location.href = `crafter-profile.html?id=${a.id}`;
    };
  }

  if (miniName) {
    miniName.textContent = a.name;
    miniName.style.cursor = "pointer";
    miniName.onclick = () => {
      if (a.id) window.location.href = `crafter-profile.html?id=${a.id}`;
    };
  }
  if (miniHdl)
    miniHdl.textContent = `${escapeHTML(a.handle)} · ${escapeHTML(a.location || "")}`;
  if (miniBio) miniBio.textContent = a.bio || "No bio yet.";

  if (msEls[0])
    msEls[0].querySelector("strong").textContent = a.friendCount ?? 0;
  if (msEls[1])
    msEls[1].querySelector("strong").textContent = (
      a.points ?? 0
    ).toLocaleString();
  if (msEls[2]) msEls[2].querySelector("strong").textContent = a.postCount ?? 0;

  if (followBtn) {
    followBtn.textContent = a.isFollowed ? "✓ Following" : "+ Follow";
    followBtn.classList.toggle("following", !!a.isFollowed);
    followBtn.dataset.id = a.id;
  }
  // ← REPLACE the old mini-card block with this:
  const miniCard = document.getElementById("follow-btn")?.parentElement;
  if (miniCard && a.id) {
    const rBtn = document.createElement("button");
    rBtn.style.cssText = `
      margin-top:8px;width:100%;background:none;border:none;
      cursor:pointer;font-size:.74rem;color:#ccc;padding:3px;
      font-family:'DM Sans',sans-serif;
    `;
    rBtn.textContent = "⚑ Report this user";
    rBtn.onclick = () => openReportModal(a.id, "user");
    miniCard.appendChild(rBtn);
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
        <div class="res-title">${escapeHTML(r.title)}</div>
        <div class="res-type">${escapeHTML(r.type || "")}</div>
      </div>
      <div class="res-dl" ${r.url ? `onclick="window.open('${r.url}','_blank')" style="cursor:pointer"` : ""}>
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </div>
    </div>`,
    )
    .join("");
}

/* ═══════════════════════════════════════════════════════════
   RENDER — RELATED POSTS
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
              <div class="rel-title">${escapeHTML(r.title)}</div>
              <div class="rel-meta">${escapeHTML(r.meta)}</div>
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
   RENDER — TAGS
═══════════════════════════════════════════════════════════ */
function renderTags(tags = []) {
  const el = document.getElementById("tags-wrap");
  if (!el) return;
  el.innerHTML = tags
    .map(
      (t) =>
        `<span class="tag-pill">#${escapeHTML(t.replace(/^#/, ""))}</span>`,
    )
    .join("");
}

/* ═══════════════════════════════════════════════════════════
   RENDER — REPLIES FEED
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
          ? `<div class="resp-card-av" style="background-image:url(${a.avatar});background-size:cover;background-position:center;"></div>`
          : `<div class="resp-card-av" style="background:${colorFor(a?.id)}">${initials(a?.name)}</div>`;

        const rank = a?.badges?.[0] ? badge(a.badges[0]) : "🌱 Member";
        const isOwn = a?.id?.toString() === _me?.id?.toString();

        return `
      <div class="resp-card ${isOwn ? "own" : ""}" id="reply-${r.id}">
        ${avHtml}
        <div class="resp-card-body">
          <div class="resp-card-header">
            <span class="resp-card-name" style="cursor:pointer"
                  onclick="window.location.href='crafter-profile.html?id=${a?.id}'">${escapeHTML(a?.name ?? "Unknown")}</span>
            <span class="resp-card-rank">${rank}</span>
            <span class="resp-card-time">${timeAgo(r.createdAt)}</span>
          </div>
          <div class="resp-card-text">${sanitizeHTML(r.body)}</div>
        
          <div class="resp-card-footer">
            <button class="resp-action ${r.hasVoted ? "liked" : ""}"
                    onclick="toggleHelpful('${r.id}',this)">
              <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              <span id="hv-${r.id}">${r.helpfulCount}</span>
            </button>
            <button class="resp-action" onclick="replyTo('${escapeAttr(a?.name ?? "")}')">
              <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Reply
            </button>
            <button class="resp-action"
              onclick="openReportModal('${r.id}','comment')"
              title="Report this reply"
              style="margin-left:auto;color:#ddd;font-size:.77rem;padding:4px 6px;">
              ⚑
            </button>
          </div>
        </div>
      </div>`;
      })
      .join("");

    if (append) {
      feed.querySelectorAll(".loading-shimmer").forEach((e) => e.remove());
      feed.insertAdjacentHTML("beforeend", html);
    } else {
      feed.innerHTML =
        html ||
        `<p style="color:var(--text-light);padding:20px 0;font-size:.88rem;">No responses yet — be the first to help 🌿</p>`;
    }

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
async function toggleSave() {
  const saveBtn = document.getElementById("save-btn");
  const saveNumEl = document.getElementById("save-num");
  const isNowSaved = !saveBtn?.classList.contains("on");

  saveBtn?.classList.toggle("on", isNowSaved);
  if (saveNumEl) {
    const cur = parseInt(saveNumEl.textContent.replace(/,/g, "")) || 0;
    saveNumEl.textContent = (cur + (isNowSaved ? 1 : -1)).toLocaleString();
  }
  try {
    await api(`/posts/${POST_ID}/save`, { method: "PATCH" });
  } catch {
    saveBtn?.classList.toggle("on", !isNowSaved);
    if (saveNumEl) {
      const cur = parseInt(saveNumEl.textContent.replace(/,/g, "")) || 0;
      saveNumEl.textContent = (cur + (isNowSaved ? -1 : 1)).toLocaleString();
    }
  }
}

// ── Follow author ─────────────────────────────────────────
// async function toggleFollow(btn) {
//   const authorId = _post?.author?.id;
//   if (!authorId) return;
//   const isNowFollowing = !btn?.classList.contains("on");
//   const followLabel = document.getElementById("follow-label");
//   const followBtn2 = document.getElementById("follow-btn");

//   btn?.classList.toggle("on", isNowFollowing);
//   if (followLabel)
//     followLabel.textContent = isNowFollowing ? "Following ✓" : "Follow";
//   if (followBtn2) {
//     followBtn2.textContent = isNowFollowing ? "✓ Following" : "+ Follow";
//     followBtn2.classList.toggle("following", isNowFollowing);
//   }
//   try {
//     await api(`/crafter/${authorId}/follow`, { method: "POST" });
//   } catch {
//     btn?.classList.toggle("on", !isNowFollowing);
//     if (followLabel)
//       followLabel.textContent = isNowFollowing ? "Follow" : "Following ✓";
//     if (followBtn2) {
//       followBtn2.textContent = isNowFollowing ? "+ Follow" : "✓ Following";
//       followBtn2.classList.toggle("following", !isNowFollowing);
//     }
//   }
// }
async function toggleFollow(btn) {
  const authorId = _post?.author?.id;
  if (!authorId) return;

  const followLabel = document.getElementById("follow-label");
  const followBtn2 = document.getElementById("follow-btn");

  // Optimistic UI
  const wasOn = btn?.classList.contains("on");
  btn?.classList.toggle("on", !wasOn);
  if (followLabel) followLabel.textContent = !wasOn ? "Following ✓" : "Follow";
  if (followBtn2) {
    followBtn2.textContent = !wasOn ? "✓ Following" : "+ Follow";
    followBtn2.classList.toggle("following", !wasOn);
  }

  try {
    const { friendStatus } = await api(`/crafter/${authorId}/follow`, {
      method: "POST",
    });

    // Sync UI to actual server state
    const isFriend = friendStatus === "friends";
    const isPending = friendStatus === "pending_sent";
    const label = isFriend ? "Following ✓" : isPending ? "Pending…" : "Follow";
    const isOn = isFriend || isPending;

    btn?.classList.toggle("on", isOn);
    if (followLabel) followLabel.textContent = label;
    if (followBtn2) {
      followBtn2.textContent = isFriend
        ? "✓ Following"
        : isPending
          ? "⏳ Pending"
          : "+ Follow";
      followBtn2.classList.toggle("following", isOn);
    }
  } catch {
    // Rollback
    btn?.classList.toggle("on", wasOn);
    if (followLabel) followLabel.textContent = wasOn ? "Following ✓" : "Follow";
    if (followBtn2) {
      followBtn2.textContent = wasOn ? "✓ Following" : "+ Follow";
      followBtn2.classList.toggle("following", wasOn);
    }
  }
}

// ── Reaction toggle ───────────────────────────────────────
async function toggleReaction(emoji, btn) {
  const strong = btn?.querySelector("strong");
  const wasActive = btn?.classList.contains("active");

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
    renderReactions(reactions);
  } catch {
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
    // Server already emitted "comment:new" to all other viewers.
    // We just reload to show our own reply cleanly.
    ta.value = "";
    ta.style.height = "auto";
    updateCharCount();
    updateSendBtn();

    _repliesPage = 1;
    setTimeout(async () => {
      hideTyping();
      await loadReplies(false);
      // Bump counts
      const cCount = document.getElementById("c-count");
      const respNum = document.getElementById("resp-num");
      const cur = parseInt(cCount?.textContent || "0") + 1;
      if (cCount) cCount.textContent = cur;
      if (respNum) respNum.textContent = cur;
    }, 800);
  } catch (err) {
    hideTyping();
    console.error("[postComment]", err);
  } finally {
    btn.disabled = false;
  }
}

// ── Helpful vote ──────────────────────────────────────────
async function toggleHelpful(replyId, btn) {
  const countEl = document.getElementById(`hv-${replyId}`);
  const wasVoted = btn.classList.contains("liked");

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

// ── Load more ─────────────────────────────────────────────
function loadMore() {
  if (!_repliesHasMore) return;
  _repliesPage += 1;
  loadReplies(true);
}

function sortComments(val) {
  _repliesSort = val;
  _repliesPage = 1;
  loadReplies(false);
}

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
   SIDEBAR / NAV
═══════════════════════════════════════════════════════════ */
// function populateUserAvatar() {
//   const btn = document.querySelector(".profile-av-btn");
//   if (btn) {
//     if (_me?.avatar) {
//       btn.style.backgroundImage = `url(${_me.avatar})`;
//       btn.style.backgroundSize = "cover";
//       btn.style.backgroundPosition = "center";
//     } else {
//       btn.textContent = initials(_me?.name);
//       btn.style.display = "flex";
//       btn.style.alignItems = "center";
//       btn.style.justifyContent = "center";
//     }
//   }

//   const sbName = document.querySelector(".sb-prof-name");
//   const sbSub = document.querySelector(".sb-prof-sub");
//   const sbAv = document.querySelector(".sb-prof-av");
//   if (sbName) sbName.textContent = _me?.name || "You";
//   if (sbSub) sbSub.textContent = _me?.handle ? `@${_me.handle}` : "";
//   if (sbAv) {
//     if (_me?.avatar) {
//       sbAv.style.backgroundImage = `url(${_me.avatar})`;
//       sbAv.style.backgroundSize = "cover";
//       sbAv.style.backgroundPosition = "center";
//     } else sbAv.textContent = initials(_me?.name);
//   }

//   const compAv = document.querySelector(".resp-composer-av");
//   if (compAv) {
//     if (_me?.avatar) {
//       compAv.style.backgroundImage = `url(${_me.avatar})`;
//       compAv.style.backgroundSize = "cover";
//       compAv.style.backgroundPosition = "center";
//     } else compAv.textContent = initials(_me?.name);
//   }
// }

// function syncNav(el) {
//   const label = el.textContent.trim();
//   document
//     .querySelectorAll(".tnav,.snav")
//     .forEach((l) =>
//       l.classList.toggle("active", l.textContent.trim() === label),
//     );
// }
// function pickNav(el) {
//   document
//     .querySelectorAll(".nav-item")
//     .forEach((i) => i.classList.remove("active"));
//   el.classList.add("active");
//   if (window.innerWidth <= 520) closeSidebar();
// }
// function toggleSidebar() {
//   const open = document.getElementById("sidebar").classList.toggle("open");
//   document.getElementById("overlay").classList.toggle("on", open);
// }
// function closeSidebar() {
//   document.getElementById("sidebar").classList.remove("open");
//   document.getElementById("overlay").classList.remove("on");
// }
// window.addEventListener("resize", () => {
//   if (window.innerWidth > 520) closeSidebar();
// });

/* ═══════════════════════════════════════════════════════════
   INJECT RICH-TEXT STYLES
   CSS for all HTML elements the rich-text editor can produce
   inside #post-body. Called once on DOMContentLoaded so we
   don't need to touch the external CSS file.
═══════════════════════════════════════════════════════════ */
function injectRichTextStyles() {
  if (document.getElementById("rich-text-styles")) return; // already added
  const style = document.createElement("style");
  style.id = "rich-text-styles";
  style.textContent = `
    /* ── Core body container ── */
    #post-body { line-height: 1.8; color: var(--text-dark, #2a2a2a); font-size: .96rem; }

    /* ── Headings ── */
    #post-body h1 { font-size: 1.55rem; font-weight: 700; margin: 1.6em 0 .5em; line-height: 1.3; color: var(--text-dark, #1a1a1a); }
    #post-body h2 { font-size: 1.28rem; font-weight: 700; margin: 1.4em 0 .45em; line-height: 1.35; color: var(--text-dark, #1a1a1a); }
    #post-body h3 { font-size: 1.08rem; font-weight: 700; margin: 1.2em 0 .4em; line-height: 1.4; color: var(--text-dark, #1a1a1a); }
    #post-body h4, #post-body h5, #post-body h6 { font-size: .96rem; font-weight: 700; margin: 1em 0 .35em; }

    /* ── Paragraphs ── */
    #post-body p { margin: 0 0 .9em; }
    #post-body p:last-child { margin-bottom: 0; }

    /* ── Inline formatting ── */
    #post-body strong, #post-body b { font-weight: 700; }
    #post-body em, #post-body i { font-style: italic; }
    #post-body u { text-decoration: underline; }
    #post-body s { text-decoration: line-through; }
    #post-body mark { background: #fff9c4; color: inherit; padding: 0 2px; border-radius: 2px; }

    /* ── Lists ── */
    #post-body ul, #post-body ol { margin: .5em 0 .9em 1.5em; padding: 0; }
    #post-body ul { list-style: disc; }
    #post-body ol { list-style: decimal; }
    #post-body li { margin: .3em 0; line-height: 1.7; }
    #post-body li > ul, #post-body li > ol { margin: .2em 0 .2em 1.2em; }

    /* ── Blockquote ── */
    #post-body blockquote {
      margin: 1em 0;
      padding: .7em 1em .7em 1.1em;
      border-left: 3px solid var(--accent, #7a8f52);
      background: rgba(122,143,82,.07);
      border-radius: 0 6px 6px 0;
      font-style: italic;
      color: var(--text-mid, #555);
    }
    #post-body blockquote p { margin: 0; }

    /* ── Code ── */
    #post-body code {
      font-family: 'Courier New', Courier, monospace;
      font-size: .88em;
      background: rgba(0,0,0,.06);
      padding: .15em .4em;
      border-radius: 4px;
      color: #c0392b;
    }
    #post-body pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1em 1.2em;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1em 0;
      font-size: .85em;
      line-height: 1.6;
    }
    #post-body pre code {
      background: none;
      color: inherit;
      padding: 0;
      font-size: inherit;
      border-radius: 0;
    }

    /* ── Horizontal rule ── */
    #post-body hr {
      border: none;
      border-top: 1px solid rgba(0,0,0,.12);
      margin: 1.5em 0;
    }

    /* ── Links ── */
    #post-body a {
      color: var(--accent-dark, #4a6741);
      text-decoration: underline;
      word-break: break-word;
    }
    #post-body a:hover { opacity: .8; }

    /* ── Text alignment (from justify commands) ── */
    #post-body [style*="text-align: center"], #post-body [style*="text-align:center"] { text-align: center; }
    #post-body [style*="text-align: right"],  #post-body [style*="text-align:right"]  { text-align: right; }
    #post-body [style*="text-align: justify"],#post-body [style*="text-align:justify"]{ text-align: justify; }

    /* ── Highlight spans from editor ── */
    #post-body span[style*="background"] { border-radius: 2px; padding: 0 1px; }
  `;
  document.head.appendChild(style);
}

/* ═══════════════════════════════════════════════════════════
   INIT — called when DOM is ready
═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
   NOTIFICATION PANEL  (Pinterest-style dropdown on bell click)
   • Opens as a panel anchored to the bell button
   • Loads real notifications from /api/dashboard/notifications
   • "Seen" (read) / "New" sections
   • Friend-request items show Accept/Decline inline
   • Closes on outside click or Escape
   • socket-client.js calls window._refreshNotifPanel() when new notif arrives
═══════════════════════════════════════════════════════════ */

// Track panel state so socket-client.js can call refresh
window._notifPanelOpen = false;
window._refreshNotifPanel = null; // set in initNotifPanel

function initNotifPanel() {
  // Target by the id we added in index.html
  const bellBtn = document.getElementById("notif-bell-btn");
  if (!bellBtn) return;

  // CRITICAL: removeAttribute("onclick") only removes the HTML attribute;
  // the browser already compiled it into an onclick property. Must null it.
  bellBtn.onclick = null;

  bellBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleNotifPanel(bellBtn);
  });
}

function toggleNotifPanel(anchor) {
  const existing = document.getElementById("notif-panel");
  if (existing) {
    existing.remove();
    window._notifPanelOpen = false;
    window._refreshNotifPanel = null;
    return;
  }
  openNotifPanel(anchor);
}

// openNotifPanel: always opens (called directly from sidebar nav onclick)
// Guard so double-calls from sidebar + bell don't double-render

async function openNotifPanel(anchor) {
  // Guard: if already open, close it (sidebar calling openNotifPanel acts as toggle)
  const existing = document.getElementById("notif-panel");
  if (existing) {
    existing.remove();
    window._notifPanelOpen = false;
    window._refreshNotifPanel = null;
    return;
  }
  const panel = document.createElement("div");
  panel.id = "notif-panel";
  panel.style.cssText = [
    "position:fixed;top:60px;right:16px;z-index:9990;",
    "width:360px;max-width:calc(100vw - 24px);max-height:80vh;",
    "background:#fff;border-radius:18px;",
    "box-shadow:0 12px 48px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.08);",
    "display:flex;flex-direction:column;overflow:hidden;",
    "animation:_npIn .22s cubic-bezier(.34,1.2,.64,1) both;",
  ].join("");

  panel.innerHTML = `
    <style>
      @keyframes _npIn { from{opacity:0;transform:translateY(-10px)} }
      #notif-panel .np-head {
        display:flex;align-items:center;justify-content:space-between;
        padding:16px 18px 10px;border-bottom:1px solid #f0f0ea;flex-shrink:0;
      }
      #notif-panel .np-title {
        font-weight:800;font-size:1.05rem;color:#2d3520;font-family:'Lora',serif;
      }
      #notif-panel .np-action {
        font-size:.76rem;color:#8fa45a;font-weight:600;cursor:pointer;
        background:none;border:none;padding:4px 8px;border-radius:6px;
        transition:background .15s;
      }
      #notif-panel .np-action:hover { background:#f4f7ed; }
      #notif-panel .np-body  { overflow-y:auto;flex:1;padding:4px 0 8px; }
      #notif-panel .np-section-label {
        font-size:.72rem;font-weight:700;color:#aaa;letter-spacing:.06em;
        text-transform:uppercase;padding:10px 18px 4px;
      }
      #notif-panel .np-item {
        display:flex;align-items:flex-start;gap:12px;
        padding:10px 18px;cursor:pointer;transition:background .12s;
        border-radius:0;position:relative;
      }
      #notif-panel .np-item:hover { background:#f8faf3; }
      #notif-panel .np-item.unread::before {
        content:'';position:absolute;left:6px;top:50%;transform:translateY(-50%);
        width:6px;height:6px;border-radius:50%;background:#7a8f52;
      }
      #notif-panel .np-av {
        width:40px;height:40px;border-radius:50%;flex-shrink:0;
        display:flex;align-items:center;justify-content:center;
        font-weight:700;font-size:.85rem;color:#fff;
      }
      #notif-panel .np-content { flex:1;min-width:0; }
      #notif-panel .np-msg {
        font-size:.84rem;color:#3d4a2a;line-height:1.4;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
      }
      #notif-panel .np-time { font-size:.73rem;color:#aaa;margin-top:2px; }
      #notif-panel .np-emoji { font-size:1.1rem;width:40px;height:40px;border-radius:50%;background:#f4f7ed;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
      /* Inline friend-request buttons */
      #notif-panel .np-freq-btns { display:flex;gap:6px;margin-top:6px; }
      #notif-panel .np-freq-btn {
        padding:5px 12px;border-radius:7px;font-size:.77rem;font-weight:700;
        cursor:pointer;border:none;transition:opacity .15s;
      }
      #notif-panel .np-freq-btn:hover { opacity:.82; }
      #notif-panel .np-freq-btn.accept { background:#7a8f52;color:#fff; }
      #notif-panel .np-freq-btn.decline { background:none;color:#c0392b;border:1.5px solid #e0b0a8; }
      /* Footer */
      #notif-panel .np-footer {
        border-top:1px solid #f0f0ea;padding:10px 18px;text-align:center;flex-shrink:0;
      }
      #notif-panel .np-footer a {
        font-size:.8rem;color:#8fa45a;font-weight:600;text-decoration:none;
      }
      #notif-panel .np-footer a:hover { text-decoration:underline; }
      #notif-panel .np-empty {
        text-align:center;padding:32px 24px;color:#bbb;font-size:.85rem;
      }
      #notif-panel .np-shimmer {
        height:58px;margin:4px 18px;border-radius:10px;
        background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);
        background-size:200% 100%;animation:shimmer 1.4s infinite;
      }
    </style>

    <div class="np-head">
      <span class="np-title">Updates</span>
      <button class="np-action" id="_np_mark_all">Mark all as seen</button>
    </div>
    <div class="np-body" id="_np_body">
      <div class="np-shimmer"></div>
      <div class="np-shimmer"></div>
      <div class="np-shimmer"></div>
    </div>
    <div class="np-footer">
      <a href="pages/dashboard.html#notifications">See all in Dashboard →</a>
    </div>`;

  document.body.appendChild(panel);
  window._notifPanelOpen = true;

  // Mark-all-read button
  panel.querySelector("#_np_mark_all")?.addEventListener("click", async () => {
    try {
      await api("/dashboard/notifications/read-all", { method: "PATCH" });
      panel
        .querySelectorAll(".np-item.unread")
        .forEach((el) => el.classList.remove("unread"));
      // Zero badge
      document.querySelectorAll("#notif-badge").forEach((b) => {
        b.textContent = "";
        b.style.display = "none";
      });
      document
        .querySelectorAll("#topbar-notif-dot")
        .forEach((d) => (d.style.display = "none"));
    } catch {
      /* silent */
    }
  });

  // Load notifications
  async function loadPanelNotifs() {
    const body = panel.querySelector("#_np_body");
    if (!body) return;
    try {
      const { data: notifs = [] } = await api("/dashboard/notifications");
      renderPanelNotifs(body, notifs);
    } catch {
      body.innerHTML = `<div class="np-empty">Could not load notifications.</div>`;
    }
  }

  function renderPanelNotifs(body, notifs) {
    if (!notifs.length) {
      body.innerHTML = `<div class="np-empty">You're all caught up! 🎉</div>`;
      return;
    }

    const EMOJI_MAP = {
      reply: "💬",
      helped: "✅",
      badge: "🏆",
      sos: "🆘",
      follow: "👤",
      milestone: "🎉",
      friend_request: "🤝",
      friend_accepted: "✅",
    };
    const COLORS_MAP = [
      "#b5c98a",
      "#a8c4d8",
      "#d4b8e0",
      "#f0c07a",
      "#c8a98a",
      "#9ec4a0",
      "#f7b8a2",
      "#c9d8b6",
    ];
    function colorFor(id) {
      let h = 0;
      for (const c of String(id || ""))
        h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
      return COLORS_MAP[h % COLORS_MAP.length];
    }
    function initials(n) {
      return (
        (n || "")
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2) || "?"
      ).toUpperCase();
    }
    function timeAgoShort(iso) {
      if (!iso) return "";
      const d = Date.now() - new Date(iso).getTime();
      const m = Math.floor(d / 60000);
      if (m < 1) return "Just now";
      if (m < 60) return m + "m ago";
      const h = Math.floor(m / 60);
      if (h < 24) return h + "h ago";
      const dy = Math.floor(h / 24);
      return dy === 1 ? "Yesterday" : dy + "d ago";
    }
    function esc2(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    // ── Deduplicate friend_request by actorId ─────────────────────────────
    // Multiple requests from the same person create multiple notifications.
    // Keep only the most recent one per actor so the panel shows one row.
    const deduped = [];
    const seenFreqActors = new Set();
    for (const n of notifs) {
      if (n.type === "friend_request") {
        const aid = String(n.actor?._id || n.actor?.id || "");
        if (aid && seenFreqActors.has(aid)) continue; // skip duplicate
        if (aid) seenFreqActors.add(aid);
      }
      deduped.push(n);
    }

    const newNotifs = deduped.filter((n) => !n.isRead);
    const seenNotifs = deduped.filter((n) => n.isRead);

    let html = "";

    function notifItemHTML(n) {
      const actor = n.actor || {};
      const actorId = String(actor._id || actor.id || "");
      const aName = actor.name || actor.handle || "";
      const emoji = EMOJI_MAP[n.type] || "🔔";
      const unreadCls = n.isRead ? "" : " unread";

      let avHTML;
      if (actor.avatar) {
        avHTML = `<div class="np-av" style="background:url(${actor.avatar}) center/cover no-repeat;"></div>`;
      } else if (aName) {
        avHTML = `<div class="np-av" style="background:${colorFor(actorId)};">${initials(aName)}</div>`;
      } else {
        avHTML = `<div class="np-emoji">${emoji}</div>`;
      }

      // Accept/Decline ONLY for unread friend requests.
      // After accepting/declining the notification becomes read — buttons won't reappear.
      let freqBtns = "";
      if (n.type === "friend_request" && actorId && !n.isRead) {
        freqBtns = `
          <div class="np-freq-btns">
            <button class="np-freq-btn accept" data-id="${esc2(actorId)}" onclick="npAcceptFreq(this)">Accept</button>
            <button class="np-freq-btn decline" data-id="${esc2(actorId)}" onclick="npDeclineFreq(this)">Decline</button>
          </div>`;
      }

      const profileLink = actorId
        ? `onclick="window.location.href='pages/crafter-profile.html?id=${esc2(actorId)}\'"`
        : "";

      return `
        <div class="np-item${unreadCls}" data-notif-id="${esc2(n._id || n.id || "")}" data-actor-id="${esc2(actorId)}">
          <div ${profileLink} style="cursor:${actorId ? "pointer" : "default"};">${avHTML}</div>
          <div class="np-content">
            <div class="np-msg" ${profileLink} style="cursor:${actorId ? "pointer" : "default"};">${esc2(n.message)}</div>
            <div class="np-time">${timeAgoShort(n.createdAt)}</div>
            ${freqBtns}
          </div>
        </div>`;
    }

    if (newNotifs.length) {
      html += `<div class="np-section-label">New</div>`;
      html += newNotifs.map(notifItemHTML).join("");
    }
    if (seenNotifs.length) {
      html += `<div class="np-section-label">Seen</div>`;
      html += seenNotifs.map(notifItemHTML).join("");
    }

    body.innerHTML = html;
  }
  // Expose refresh so socket-client.js can call it
  window._refreshNotifPanel = loadPanelNotifs;

  loadPanelNotifs();

  // Close on outside click
  function handleOutsideClick(e) {
    const bellBtn = document.getElementById("notif-bell-btn");
    const sidebarBtn = document.getElementById("sidebar-notif-btn");
    if (
      !panel.contains(e.target) &&
      e.target !== bellBtn &&
      !bellBtn?.contains(e.target) &&
      e.target !== sidebarBtn &&
      !sidebarBtn?.contains(e.target)
    ) {
      panel.remove();
      window._notifPanelOpen = false;
      window._refreshNotifPanel = null;
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    }
  }
  function handleEsc(e) {
    if (e.key === "Escape") {
      panel.remove();
      window._notifPanelOpen = false;
      window._refreshNotifPanel = null;
      document.removeEventListener("click", handleOutsideClick);
      document.removeEventListener("keydown", handleEsc);
    }
  }
  setTimeout(() => {
    document.addEventListener("click", handleOutsideClick);
    document.addEventListener("keydown", handleEsc);
  }, 0);
}

async function npAcceptFreq(btn) {
  const actorId = btn.dataset.id;
  if (!actorId) return;

  const panel = document.getElementById("notif-panel");
  const rows = panel
    ? [...panel.querySelectorAll(`.np-item[data-actor-id="${actorId}"]`)]
    : [];

  rows.forEach((item) => {
    item.querySelector(".np-freq-btns")?.remove();
    const msg = item.querySelector(".np-msg");
    if (msg) msg.textContent = "✓ Friend request accepted!";
    item.classList.remove("unread");
  });

  try {
    await api(`/crafter/${actorId}/accept`, { method: "POST" });

    api("/dashboard/notifications/read-all", { method: "PATCH" }).catch(
      () => {},
    );
    document.querySelectorAll("#notif-badge").forEach((b) => {
      b.textContent = "";
      b.style.display = "none";
    });

    showToast("Friend request accepted! 🎉", "success");
  } catch (e) {
    rows.forEach((item) => {
      const msg = item.querySelector(".np-msg");
      if (msg) msg.textContent = "sent you a friend request";
      item.classList.add("unread");
      const btns = document.createElement("div");
      btns.className = "np-freq-btns";
      btns.innerHTML = `
        <button class="np-freq-btn accept" data-id="${actorId}" onclick="npAcceptFreq(this)">Accept</button>
        <button class="np-freq-btn decline" data-id="${actorId}" onclick="npDeclineFreq(this)">Decline</button>`;
      item.querySelector(".np-content")?.appendChild(btns);
    });
    showToast(e.message || "Could not accept request", "error");
  }
}

async function npDeclineFreq(btn) {
  const actorId = btn.dataset.id;
  if (!actorId) return;

  const panel = document.getElementById("notif-panel");
  const rows = panel
    ? [...panel.querySelectorAll(`.np-item[data-actor-id="${actorId}"]`)]
    : [];

  const snapshots = rows.map((item) => ({
    item,
    parent: item.parentNode,
    next: item.nextSibling,
    btnsHTML: item.querySelector(".np-freq-btns")?.outerHTML || "",
  }));
  rows.forEach((item) => item.remove());

  try {
    await api(`/crafter/${actorId}/decline`, { method: "POST" });
    api("/dashboard/notifications/read-all", { method: "PATCH" }).catch(
      () => {},
    );
  } catch (e) {
    snapshots.forEach(({ item, parent, next, btnsHTML }) => {
      if (btnsHTML && !item.querySelector(".np-freq-btns")) {
        item
          .querySelector(".np-content")
          ?.insertAdjacentHTML("beforeend", btnsHTML);
      }
      item.classList.add("unread");
      parent?.insertBefore(item, next);
    });
  }
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
/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  // Notification panel
  initNotifPanel();

  injectRichTextStyles(); // ensure #post-body rich-text CSS is present
  const distressBtn = document.querySelector(".distress-btn");
  if (distressBtn)
    distressBtn.onclick = () => (window.location.href = "create-post.html");

  if (POST_ID) loadPost();
});
