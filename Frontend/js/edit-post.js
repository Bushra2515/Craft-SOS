/* ═══════════════════════════════════════════════════════════════
   edit-post.js  —  Frontend API layer for the Edit Post page

   Schema-aware mapping (Post.js → HTML form):
     post.type    → "sos" | "tut" | "com" | "res"   (type-card data-type)
     post.title   → #title-input
     post.body    → #editor-area  (rich HTML)
     post.tags[]  → activeTags[]
     post.status  → "Mark as Solved" toggle (resolved) / "active"
     post.views   → incremented on page load via PATCH /views
     post.author  → populates sidebar .sb-prof-* divs

   Endpoints used:
     GET   /api/posts/:id/edit   — load
     PUT   /api/posts/:id        — update (publish)
     DELETE /api/posts/:id       — delete
     PATCH  /api/posts/:id/views — view counter (fire-and-forget)
══════════════════════════════════════════════════════════════ */

const API_BASE = "http://localhost:5000/api";

/* ── Auth token from localStorage ── */
function getToken() {
  return localStorage.getItem("token") || "";
}

/* ── Post ID from URL query string: edit-post.html?id=abc123 ── */
function getPostId() {
  return new URLSearchParams(window.location.search).get("id");
}

/* ─────────────────────────────────────────────────────────────
   Map UI type-card data-type values to the schema enum values.
   HTML uses: "sos" | "tutorial" | "community" | "resource"
   Schema uses: "sos" | "tut"     | "com"       | "res"
───────────────────────────────────────────────────────────── */
const UI_TO_SCHEMA = {
  sos: "sos",
  tutorial: "tut",
  community: "com",
  resource: "res",
};
const SCHEMA_TO_UI = {
  sos: "sos",
  tut: "tutorial",
  com: "community",
  res: "resource",
};

/* ─────────────────────────────────────────────────────────────
   Build the PUT request body from the current form state.
   Uses variables declared in the page's inline <script>:
     selectedType, activeTags  (both maintained by inline script)
───────────────────────────────────────────────────────────── */
function buildPayload() {
  const markSolved = getToggleState("Mark as Solved");

  return {
    type: UI_TO_SCHEMA[selectedType] || selectedType,
    title: document.getElementById("title-input").value.trim(),
    body: document.getElementById("editor-area").innerHTML,
    tags: activeTags.map((t) => t.replace(/^#/, "")), // store without leading #
    status: markSolved ? "resolved" : "active",
  };
}

/* ── Read a toggle's on/off state by its label text ── */
function getToggleState(labelText) {
  for (const lbl of document.querySelectorAll(".toggle-label")) {
    if (lbl.textContent.trim() === labelText) {
      const toggle = lbl.closest(".toggle-wrap")?.querySelector(".toggle");
      return toggle ? toggle.classList.contains("on") : false;
    }
  }
  return false;
}

/* ── Set a toggle on/off by its label text ── */
function setToggleState(labelText, state) {
  for (const lbl of document.querySelectorAll(".toggle-label")) {
    if (lbl.textContent.trim() === labelText) {
      const toggle = lbl.closest(".toggle-wrap")?.querySelector(".toggle");
      if (toggle) toggle.classList.toggle("on", !!state);
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   LOAD POST
   GET /api/posts/:id/edit
   Called on DOMContentLoaded — populates every form field.
───────────────────────────────────────────────────────────── */
async function loadPost() {
  const postId = getPostId();
  if (!postId) {
    showToast("No post ID in URL.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/posts/${postId}/edit`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      showToast(json.message || "Failed to load post.", "error");
      // If forbidden redirect away; author must edit their own posts only
      if (res.status === 403 || res.status === 401) {
        setTimeout(() => (window.location.href = "dashboard.html"), 1500);
      }
      return;
    }

    populateForm(json.data);
    pingViews(postId); // fire-and-forget view increment
  } catch (err) {
    console.error("[loadPost]", err);
    showToast("Network error. Could not load post.", "error");
  }
}

/* ─────────────────────────────────────────────────────────────
   populateForm — maps every field from the API response to the DOM
───────────────────────────────────────────────────────────── */
function populateForm(post) {
  /* ── Post type ─────────────────────────────────────── */
  // post.type is schema value ("sos"|"tut"|"com"|"res")
  // HTML data-type uses UI value ("sos"|"tutorial"|"community"|"resource")
  const uiType = SCHEMA_TO_UI[post.type] || post.type;
  const typeCard = document.querySelector(`[data-type="${uiType}"]`);
  if (typeCard) selectType(uiType, typeCard);

  /* ── Title ──────────────────────────────────────────── */
  const titleInput = document.getElementById("title-input");
  titleInput.value = post.title || "";
  updateTitle(titleInput);

  /* ── Body (rich HTML) ──────────────────────────────── */
  document.getElementById("editor-area").innerHTML = post.body || "";
  updateEditorStats();

  /* ── Tags — schema stores without #, UI shows with # ── */
  activeTags = (post.tags || []).map((t) => (t.startsWith("#") ? t : `#${t}`));
  renderTags();

  /* ── "Mark as Solved" toggle ──────────────────────── */
  setToggleState("Mark as Solved", post.status === "resolved");

  /* ── "Posted on" date in the edit notice ────────────── */
  const dateEl = document.getElementById("post-date");
  if (dateEl && post.createdAt) {
    const d = new Date(post.createdAt);
    dateEl.textContent = `Posted ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  /* ── Sidebar user info (from populated author field) ── */
  populateSidebarUser(post.author);

  updateChecklist();
  updatePreview();

  // BUG FIX: populateForm calls markChanged() indirectly via updateTitle()
  // and renderTags(). Reset hasChanges so the browser doesn't warn about
  // "unsaved changes" the moment the page loads.
  hasChanges = false;
  document.getElementById("change-badge").style.display = "none";
}

/* ── Populate sidebar avatar / name from the post's author object ── */
function populateSidebarUser(author) {
  // BUG FIX: original looked for user.username and user.craft but API returns
  // { name, handle, avatar, points, badges } — fixed to use correct field names.
  let user = author || {};

  // Fallback to localStorage only if API did not return author
  if (!user.name) {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      user = {
        name: stored.name || stored.username || "",
        handle: stored.handle || stored.craft || "",
        points: stored.points || 0,
        avatar: stored.avatar || "",
      };
    } catch (_) {}
  }

  const nameEl = document.querySelector(".sb-prof-name");
  const subEl = document.querySelector(".sb-prof-sub");
  const avEl = document.querySelector(".sb-prof-av");
  const topAvEl = document.querySelector(".profile-av-btn");

  if (nameEl) nameEl.textContent = user.name || "";
  if (subEl)
    subEl.textContent = user.handle
      ? `${user.handle} · ${user.points ?? 0} pts`
      : `${user.points ?? 0} pts`;

  if (avEl) {
    if (user.avatar) {
      avEl.style.backgroundImage = `url(${user.avatar})`;
      avEl.style.backgroundSize = "cover";
    } else {
      avEl.textContent = (user.name || "U")[0].toUpperCase();
    }
  }
  if (topAvEl) {
    if (user.avatar) {
      topAvEl.style.backgroundImage = `url(${user.avatar})`;
      topAvEl.style.backgroundSize = "cover";
    } else {
      topAvEl.textContent = (user.name || "U")[0].toUpperCase();
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   UPDATE POST
   PUT /api/posts/:id
───────────────────────────────────────────────────────────── */
async function updatePost() {
  const postId = getPostId();
  if (!postId) return;

  const btn = document.getElementById("update-btn");
  btn.disabled = true;
  showToast("Updating…", "");

  try {
    const res = await fetch(`${API_BASE}/posts/${postId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(buildPayload()),
    });

    const json = await res.json();

    if (!res.ok) {
      showToast(json.message || "Update failed.", "error");
      btn.disabled = false;
      return;
    }

    // Success — fix Bug 5: wire "View Post" button with the actual post ID
    hasChanges = false;
    document.getElementById("change-badge").style.display = "none";
    const overlay = document.getElementById("success-overlay");
    // Update the "View Post" button to navigate to the correct post
    const viewBtn = overlay.querySelector(".suc-btn.primary");
    if (viewBtn) {
      viewBtn.onclick = () => {
        window.location.href = `post-detail.html?id=${postId}`;
      };
    }
    overlay.classList.add("on");
  } catch (err) {
    console.error("[updatePost]", err);
    showToast("Network error. Please try again.", "error");
    btn.disabled = false;
  }
}

/* ─────────────────────────────────────────────────────────────
   SAVE DRAFT  (client-side only — schema has no isDraft field)
   Stores the current form state in localStorage so the user
   can come back later. No API call is made.
───────────────────────────────────────────────────────────── */
function saveDraft() {
  const postId = getPostId();
  if (!postId) return;

  try {
    const draft = {
      postId,
      savedAt: new Date().toISOString(),
      ...buildPayload(),
    };
    localStorage.setItem(`draft_${postId}`, JSON.stringify(draft));
    hasChanges = false;
    document.getElementById("change-badge").style.display = "none";
    showToast("Draft saved locally!", "success");
  } catch (err) {
    console.error("[saveDraft]", err);
    showToast("Could not save draft.", "error");
  }
}

/* ── Restore a draft saved by saveDraft() if it exists ── */
function restoreDraftIfAny(postId) {
  try {
    const raw = localStorage.getItem(`draft_${postId}`);
    if (!raw) return;

    const draft = JSON.parse(raw);
    const savedAt = new Date(draft.savedAt).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const restore = confirm(
      `A local draft from ${savedAt} was found. Restore it?`,
    );
    if (!restore) {
      localStorage.removeItem(`draft_${postId}`);
      return;
    }

    // Re-apply draft values over the loaded post
    const titleInput = document.getElementById("title-input");
    titleInput.value = draft.title || "";
    updateTitle(titleInput);

    document.getElementById("editor-area").innerHTML = draft.body || "";
    updateEditorStats();

    activeTags = (draft.tags || []).map((t) =>
      t.startsWith("#") ? t : `#${t}`,
    );
    renderTags();

    const uiType = SCHEMA_TO_UI[draft.type] || draft.type;
    const typeCard = document.querySelector(`[data-type="${uiType}"]`);
    if (typeCard) selectType(uiType, typeCard);

    setToggleState("Mark as Solved", draft.status === "resolved");

    markChanged();
    showToast("Draft restored.", "success");
  } catch (err) {
    console.error("[restoreDraftIfAny]", err);
  }
}

/* ─────────────────────────────────────────────────────────────
   DELETE POST
   DELETE /api/posts/:id
───────────────────────────────────────────────────────────── */
async function deletePost() {
  const postId = getPostId();
  if (!postId) return;

  if (!confirm("Delete this post permanently? This cannot be undone.")) return;

  try {
    const res = await fetch(`${API_BASE}/posts/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${getToken()}` },
    });

    const json = await res.json();

    if (!res.ok) {
      showToast(json.message || "Delete failed.", "error");
      return;
    }

    // Clean up any local draft and redirect
    localStorage.removeItem(`draft_${postId}`);
    showToast("Post deleted.", "success");
    setTimeout(() => (window.location.href = "profile.html"), 1200);
  } catch (err) {
    console.error("[deletePost]", err);
    showToast("Network error. Could not delete.", "error");
  }
}

/* ─────────────────────────────────────────────────────────────
   VIEW COUNTER
   PATCH /api/posts/:id/views  — fire and forget
───────────────────────────────────────────────────────────── */
async function pingViews(postId) {
  try {
    await fetch(`${API_BASE}/posts/${postId}/views`, { method: "PATCH" });
  } catch (_) {
    /* silent — view count is non-critical */
  }
}

/* ─────────────────────────────────────────────────────────────
   PREVIEW  (client-side only)
───────────────────────────────────────────────────────────── */
function previewPost() {
  initSidebar();
  updatePreview();
  showToast("Preview updated in the right panel ↗", "");
}

/* ── Auto-load on page open ── */
window.addEventListener("DOMContentLoaded", async () => {
  const postId = getPostId();
  if (!postId) {
    showToast("No post ID in URL.", "error");
    return;
  }

  await loadPost(); // fetch from server first
  restoreDraftIfAny(postId); // then check for a local unsaved draft
});
