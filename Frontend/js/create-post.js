// Frontend/js/create-post.js
// Talks to:
//   POST /api/posts          → publish
//   (drafts saved to localStorage — Post model has no draft status)

/* ══════════════════════════════════════════════════
   CONFIG
══════════════════════════════════════════════════ */
const API_BASE = "http://localhost:5000/api";

// Token stored by auth.js after login
const token = localStorage.getItem("token");

// Guard: redirect to login if not authenticated
if (!token) {
  window.location.href = "login.html";
}

/* ══════════════════════════════════════════════════
   TYPE MAP  (HTML form value → Post model enum)
══════════════════════════════════════════════════ */
const TYPE_MAP = {
  sos: "sos",
  tutorial: "tut",
  community: "com",
  resource: "res",
};

/* ══════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════ */
let postType = null; // raw HTML value: "sos" | "tutorial" | "community" | "resource"
let priority = null; // "high" | "med" | "low"
let tags = [];
let audience = "friends";
const MAX_TAGS = 8;

const tagSuggestions = [
  "#pricing",
  "#wholesale",
  "#courier",
  "#etsy",
  "#financial",
  "#supplier",
  "#tutorial",
  "#hand-dyed",
  "#wool",
  "#knitting",
  "#crochet",
  "#dyeing",
  "#pattern",
  "#small-biz",
  "#uk-crafts",
  "#slow-fashion",
  "#natural-fibres",
  "#urgent",
  "#resolved",
  "#community",
];

const tipsByType = {
  sos: [
    {
      icon: "🆘",
      text: "State the problem clearly in your first sentence — date, platform, amounts.",
    },
    {
      icon: "💰",
      text: "Include specific figures (order count, money involved) — helps others assess urgency.",
    },
    {
      icon: "📸",
      text: "Screenshots of error messages or letters are extremely helpful.",
    },
    {
      icon: "⏱",
      text: "Mention your timeline — are you hours, days or weeks from a deadline?",
    },
  ],
  tutorial: [
    {
      icon: "🔢",
      text: "Break content into numbered steps — easier to follow and reference back to.",
    },
    {
      icon: "💡",
      text: 'Include a quick "Who is this for?" intro so readers know if it applies.',
    },
    {
      icon: "📊",
      text: "Real numbers and examples are worth 10x more than general advice.",
    },
    {
      icon: "📎",
      text: "Attach a template or spreadsheet if you can — it earns community points.",
    },
  ],
  community: [
    {
      icon: "💬",
      text: "Ask a single, clear question if you're looking for input or discussion.",
    },
    {
      icon: "🎉",
      text: 'Sharing a win? Tell the community what changed — inspire with the "how".',
    },
    {
      icon: "🤝",
      text: "Tag relevant community members who might want to weigh in.",
    },
    { icon: "📅", text: "Include dates and context so the post ages well." },
  ],
  resource: [
    {
      icon: "🔗",
      text: "Include a direct link and a brief description of why it's useful.",
    },
    {
      icon: "🧪",
      text: "Note whether you've personally used it, and what the outcome was.",
    },
    {
      icon: "💸",
      text: "State if it's free, freemium, or paid — people appreciate the transparency.",
    },
    {
      icon: "🎯",
      text: "Explain who it's best suited to — saves people time evaluating.",
    },
  ],
};

/* ══════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════ */

/** Escape string for safe innerHTML insertion (XSS prevention) */
function esc(str = "") {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

/** Auth headers for every fetch call */
function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  };
}

/** Toast notification */
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  const el = document.getElementById("toast");
  document.getElementById("toast-msg").textContent = msg;
  el.classList.add("show");
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

/** Collect toggle settings from the Settings section */
function collectSettings() {
  return {
    allowReplies:
      document.getElementById("t-replies")?.classList.contains("on") ?? true,
    notifyResolved:
      document.getElementById("t-resolve")?.classList.contains("on") ?? true,
    sendToNetwork:
      document.getElementById("t-notify")?.classList.contains("on") ?? false,
    showInExplore:
      document.getElementById("t-explore")?.classList.contains("on") ?? true,
  };
}

/** Get all selected category pill labels */
function collectCategories() {
  return [...document.querySelectorAll(".cat-pill.on")].map((el) =>
    el.textContent.trim(),
  );
}

/* ══════════════════════════════════════════════════
   API — PUBLISH POST
   POST /api/posts
══════════════════════════════════════════════════ */
async function publishPost() {
  const btn = document.getElementById("publish-btn");
  const title = document.getElementById("title-input").value.trim();
  const body = (document.getElementById("editor-area").innerText || "").trim();

  // Final client-side guard (button should already be disabled)
  if (!postType || !title || body.length < 30 || !tags.length) {
    showToast("Please complete all required fields first");
    return;
  }

  // Disable button + show loading state
  btn.disabled = true;
  btn.innerHTML = `<span style="opacity:.7">Publishing…</span>`;

  try {
    const payload = {
      type: postType, // controller maps "tutorial" → "tut" etc.
      title,
      body,
      tags: tags.join(","), // server splits by comma
      priority: priority || undefined,
      categories: collectCategories(),
      audience,
      settings: collectSettings(),
    };

    const res = await fetch(`${API_BASE}/posts`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      // Token expired → send back to login
      if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return;
      }
      const errMsg =
        json.errors?.join(", ") || json.message || "Failed to publish";
      throw new Error(errMsg);
    }

    // ✅ Success — show success overlay
    const overlay = document.getElementById("success-overlay");
    overlay.classList.add("show");
    document.getElementById("success-desc").textContent =
      `"${title.substring(0, 55)}${title.length > 55 ? "…" : ""}" is now live.`;

    // Store post ID so "View Post" can navigate to it
    overlay.dataset.postId = json.data.id;

    // Clear any saved draft
    localStorage.removeItem("craftsos_draft");
  } catch (err) {
    showToast("❌ " + err.message);
    console.error("[publishPost]", err);
    // Re-enable button
    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Publish Post`;
  }
}

/* ══════════════════════════════════════════════════
   DRAFT  (localStorage — Post model has no draft status)
══════════════════════════════════════════════════ */
function saveDraft() {
  const title = document.getElementById("title-input").value.trim();
  if (!title) {
    showToast("Add a title before saving a draft");
    return;
  }

  const draft = {
    postType,
    priority,
    tags,
    audience,
    title,
    body: document.getElementById("editor-area").innerHTML,
    categories: collectCategories(),
    savedAt: new Date().toISOString(),
  };

  localStorage.setItem("craftsos_draft", JSON.stringify(draft));
  showToast("✅ Draft saved locally");
}

/** Restore a previously saved draft on page load */
function loadDraft() {
  try {
    const raw = localStorage.getItem("craftsos_draft");
    if (!raw) return;

    const draft = JSON.parse(raw);

    // Restore title
    if (draft.title) {
      const titleInput = document.getElementById("title-input");
      titleInput.value = draft.title;
      updateTitle(titleInput);
    }

    // Restore body
    if (draft.body) {
      document.getElementById("editor-area").innerHTML = draft.body;
      updateEditorStats();
    }

    // Restore post type
    if (draft.postType) {
      const card = document.querySelector(`[data-type="${draft.postType}"]`);
      if (card) selectType(draft.postType, card);
    }

    // Restore priority
    if (draft.priority) {
      const pill = document.querySelector(`[data-p="${draft.priority}"]`);
      if (pill) selectPriority(draft.priority, pill);
    }

    // Restore tags
    if (draft.tags?.length) {
      tags = draft.tags;
      renderTagChips();
    }

    // Restore categories
    if (draft.categories?.length) {
      document.querySelectorAll(".cat-pill").forEach((el) => {
        if (draft.categories.includes(el.textContent.trim())) {
          el.classList.add("on");
        }
      });
      updateChecklist();
      updatePreview();
    }

    showToast("Draft restored ✅");
  } catch (e) {
    console.warn("Could not restore draft:", e);
  }
}

/* ══════════════════════════════════════════════════
   SUCCESS OVERLAY ACTIONS
══════════════════════════════════════════════════ */
function viewPost() {
  const overlay = document.getElementById("success-overlay");
  const id = overlay.dataset.postId;
  overlay.classList.remove("show");
  if (id) window.location.href = `dashboard.html?post=${id}`;
}

function createAnother() {
  document.getElementById("success-overlay").classList.remove("show");
  location.reload();
}

/* ══════════════════════════════════════════════════
   POST TYPE SELECTION
══════════════════════════════════════════════════ */
function selectType(type, card) {
  postType = type;
  document
    .querySelectorAll(".type-card")
    .forEach((c) => c.classList.remove("selected"));
  card.classList.add("selected");

  // Priority row is only relevant for SOS posts
  document.getElementById("priority-row").style.display =
    type === "sos" ? "block" : "none";

  renderTips(type);
  updateChecklist();
  updatePreview();
  updateProgress(1, true, true);
}

function renderTips(type) {
  const tips = tipsByType[type] || [];
  document.getElementById("tips-list").innerHTML = tips
    .map(
      (t) =>
        `<div class="tip-item"><span class="tip-icon">${t.icon}</span>${t.text}</div>`,
    )
    .join("");
}

/* ══════════════════════════════════════════════════
   PRIORITY & CATEGORY
══════════════════════════════════════════════════ */
function selectPriority(p, el) {
  priority = p;
  document
    .querySelectorAll(".pill-opt")
    .forEach((x) => x.classList.remove("on"));
  el.classList.add("on");
  updatePreview();
}

function toggleCat(el) {
  el.classList.toggle("on");
  const active = [...document.querySelectorAll(".cat-pill.on")];
  const hasCategory = active.length > 0;
  updateChecklist();
  updatePreview();
  updateProgress(2, hasCategory);
}

/* ══════════════════════════════════════════════════
   TITLE & BODY
══════════════════════════════════════════════════ */
function updateTitle(input) {
  const len = input.value.length;
  const el = document.getElementById("title-chars");
  el.textContent = `${len} / 140 characters`;
  el.className =
    "char-hint" + (len > 130 ? " warn" : "") + (len >= 140 ? " over" : "");
  updateChecklist();
  updatePreview();
  updateProgress(3, len >= 10);
}

function updateEditorStats() {
  const text = document.getElementById("editor-area").innerText || "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  document.getElementById("word-count").textContent =
    `${words} word${words !== 1 ? "s" : ""}`;
  document.getElementById("char-count-body").textContent =
    `${text.length} chars`;
  updateChecklist();
  updatePreview();
}

function fmt(cmd, val) {
  document.getElementById("editor-area").focus();
  document.execCommand(cmd, false, val || null);
}

function insertLink() {
  const url = prompt("Enter URL:");
  if (url) {
    document.getElementById("editor-area").focus();
    document.execCommand("createLink", false, url);
  }
}

function cleanPaste(e) {
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, text);
}

/* ══════════════════════════════════════════════════
   TAGS
══════════════════════════════════════════════════ */
function renderTagChips() {
  const wrap = document.getElementById("tags-wrap");
  const input = document.getElementById("tag-input");
  wrap.innerHTML = "";
  tags.forEach((t, i) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.innerHTML = `${esc(t)}<button onclick="removeTag(${i})">✕</button>`;
    wrap.appendChild(chip);
  });
  wrap.appendChild(input);
  updateChecklist();
  updatePreview();
  updateProgress(5, tags.length > 0);
}

function removeTag(i) {
  tags.splice(i, 1);
  renderTagChips();
}

function handleTagKey(e) {
  if ((e.key === "Enter" || e.key === ",") && e.target.value.trim()) {
    e.preventDefault();
    addTag(e.target.value.trim().replace(/,$/, ""));
    e.target.value = "";
    filterTagSugs("");
  } else if (e.key === "Backspace" && !e.target.value && tags.length) {
    tags.pop();
    renderTagChips();
  }
}

function addTag(raw) {
  if (tags.length >= MAX_TAGS) {
    showToast("Max 8 tags allowed");
    return;
  }
  const tag = (raw.startsWith("#") ? raw : "#" + raw)
    .toLowerCase()
    .replace(/\s+/g, "-");
  if (!tags.includes(tag)) {
    tags.push(tag);
    renderTagChips();
  }
}

function focusTagInput() {
  document.getElementById("tag-input").focus();
}

function filterTagSugs(val) {
  const q = val.toLowerCase().replace("#", "");
  const row = document.getElementById("tag-sug-row");
  const available = tagSuggestions
    .filter((t) => !tags.includes(t) && (q === "" || t.includes(q)))
    .slice(0, 8);
  row.innerHTML = available
    .map(
      (t) =>
        `<span class="tag-sug" onclick="addTag('${t}');document.getElementById('tag-input').value='';filterTagSugs('')">${t}</span>`,
    )
    .join("");
}

/* ══════════════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════════════ */
function setAudience(val, card) {
  audience = val;
  document
    .querySelectorAll(".setting-card")
    .forEach((c) => c.classList.remove("active"));
  card.classList.add("active");
}

/* ══════════════════════════════════════════════════
   CHECKLIST & PUBLISH BUTTON
══════════════════════════════════════════════════ */
function updateChecklist() {
  const title = document.getElementById("title-input").value;
  const body = document.getElementById("editor-area").innerText || "";
  const catOk = !!document.querySelector(".cat-pill.on");

  setCheck("chk-type", !!postType);
  setCheck("chk-cat", catOk);
  setCheck("chk-title", title.length >= 10);
  setCheck("chk-body", body.trim().length >= 30);
  setCheck("chk-tags", tags.length >= 1);

  const allDone =
    !!postType &&
    catOk &&
    title.length >= 10 &&
    body.trim().length >= 30 &&
    tags.length >= 1;

  document.getElementById("publish-btn").disabled = !allDone;

  const pubStatus = document.getElementById("pub-status");
  const pubSub = document.getElementById("pub-sub");

  if (allDone) {
    pubStatus.textContent = "✅ Ready to publish!";
    pubSub.textContent = "All required fields are complete.";
  } else {
    const missing = [];
    if (!postType) missing.push("post type");
    if (!catOk) missing.push("category");
    if (title.length < 10) missing.push("title");
    if (body.trim().length < 30) missing.push("body (min 30 chars)");
    if (!tags.length) missing.push("at least 1 tag");
    pubStatus.textContent = "Complete required fields";
    pubSub.textContent = `Still needed: ${missing.join(", ")}`;
  }
}

function setCheck(id, done) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("done", done);
  const chk = el.querySelector(".chk");
  if (chk) {
    chk.style.background = done ? "var(--accent)" : "";
    chk.style.borderColor = done ? "var(--accent)" : "";
  }
}

/* ══════════════════════════════════════════════════
   PROGRESS STEPS
══════════════════════════════════════════════════ */
function updateProgress(step, done, activateNext) {
  const sn = document.getElementById(`sn-${step}`);
  const sl = document.getElementById(`sl-${step}`);
  const sc = document.getElementById(`sc-${step}`);
  if (!sn) return;

  if (done) {
    sn.className = "step-num done";
    sn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    sl.className = "step-label done";
    if (sc) sc.classList.add("done");
  }

  if (activateNext) {
    const ns = document.getElementById(`sn-${step + 1}`);
    const nsl = document.getElementById(`sl-${step + 1}`);
    if (ns && !ns.classList.contains("done")) {
      ns.className = "step-num active";
      nsl.className = "step-label active";
    }
  }
}

/* ══════════════════════════════════════════════════
   LIVE PREVIEW
══════════════════════════════════════════════════ */
const typeLabels = {
  sos: "🆘 Distress Call",
  tutorial: "📚 Tutorial",
  community: "💬 Community",
  resource: "🗂️ Resource",
};
const typeBadgeColors = {
  sos: "background:#fce8e1;color:#d35b3a",
  tutorial: "background:var(--accent-light);color:var(--accent)",
  community: "background:#fdf3e0;color:#9a6d1e",
  resource: "background:#e5f5e0;color:#3a7d2c",
};
const priorityBadges = {
  high: `<span class="pc-badge" style="background:#fce8e1;color:#d35b3a">High</span>`,
  med: `<span class="pc-badge" style="background:#fdf3e0;color:#9a6d1e">Medium</span>`,
  low: `<span class="pc-badge" style="background:var(--low-bg);color:var(--text-mid)">Low</span>`,
};

function updatePreview() {
  const card = document.getElementById("preview-card");
  const title = document.getElementById("title-input").value.trim();
  const body = (document.getElementById("editor-area").innerText || "").trim();

  if (!postType && !title && !body) {
    card.innerHTML = `<div class="pc-empty">Your post preview will appear here as you fill in the form 🌿</div>`;
    return;
  }

  const catEl = document.querySelector(".cat-pill.on");
  const catLabel = catEl ? catEl.textContent.trim() : "";
  const tagsHTML = tags
    .slice(0, 4)
    .map((t) => `<span class="pc-tag">${esc(t)}</span>`)
    .join("");

  card.innerHTML = `
    <div class="pc-header">
      <div class="pc-av">P</div>
      <div style="flex:1">
        <div class="pc-name">Pebble yarn Studio</div>
        <div class="pc-time">Just now</div>
      </div>
      <div class="pc-badges">
        ${priority ? priorityBadges[priority] : ""}
        ${postType ? `<span class="pc-badge" style="${typeBadgeColors[postType] || ""}">${typeLabels[postType] || ""}</span>` : ""}
        ${catLabel ? `<span class="pc-badge" style="background:var(--accent-light);color:var(--accent)">${esc(catLabel)}</span>` : ""}
      </div>
    </div>
    <div class="pc-title">${esc(title) || '<span style="color:var(--text-light);font-style:italic">Add a title…</span>'}</div>
    <div class="pc-body">${esc(body) || '<span style="color:var(--text-light);font-style:italic">Start writing your post…</span>'}</div>
    ${tags.length ? `<div class="pc-tags">${tagsHTML}${tags.length > 4 ? `<span class="pc-tag">+${tags.length - 4} more</span>` : ""}</div>` : ""}
  `;
}

/* ══════════════════════════════════════════════════
   PREVIEW BUTTON (in publish bar)
══════════════════════════════════════════════════ */
function previewPost() {
  const preview = document.getElementById("preview-card");
  if (preview.querySelector(".pc-empty")) {
    showToast("Fill in the form to see a preview in the sidebar →");
  } else {
    showToast("Preview updated ✅ — check the sidebar");
  }
}

/* ══════════════════════════════════════════════════
   NAV HELPERS
══════════════════════════════════════════════════ */
function syncNav(el) {
  const label = el.textContent.trim();
  document
    .querySelectorAll(".tnav")
    .forEach((l) =>
      l.classList.toggle("active", l.textContent.trim() === label),
    );
  document
    .querySelectorAll(".snav")
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

/* ══════════════════════════════════════════════════
   INIT  (runs after DOM is ready)
══════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // ── Contenteditable placeholder ───────────────
  const ed = document.getElementById("editor-area");
  if (ed) {
    const toggle = () => ed.classList.toggle("empty", !ed.innerText.trim());
    ed.addEventListener("input", toggle);
    ed.addEventListener("focus", toggle);
    ed.addEventListener("blur", toggle);
    toggle();

    const style = document.createElement("style");
    style.textContent = `.editor-area:empty::before, .editor-area.empty::before { content: attr(data-placeholder); color: var(--text-light); pointer-events: none; }`;
    document.head.appendChild(style);
  }

  // ── Tag suggestions ───────────────────────────
  filterTagSugs("");

  // ── Checklist initial state ───────────────────
  updateChecklist();

  // ── Restore draft if one exists ───────────────
  loadDraft();
});
