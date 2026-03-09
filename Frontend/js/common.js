// js/common.js
// ─────────────────────────────────────────────────────────────────────────────
// Loaded on every page (after socket-client.js, before page JS).
//
// Exports (globals):
//   initSidebar(user)       — fills profile strip, wires all nav items
//   toggleSidebar()         — hamburger open/close
//   closeSidebar()          — close on overlay click / route change
//   logout()                — clear localStorage → login.html
// ─────────────────────────────────────────────────────────────────────────────
"use strict";

/* ═══════════════════════════════════════════════════════════
   ROUTE HELPERS
   Works whether the current page is at root (index.html)
   or inside pages/ (explore.html, profile.html, etc.)
═══════════════════════════════════════════════════════════ */
(function _installCommon() {
  // true when the page lives in …/pages/filename.html
  const _inPages = location.pathname.includes("/pages/");

  /**
   * resolveRoute(filename)
   * Returns the correct relative path from the current page
   * to the target filename.
   *   - From pages/ : "explore.html" stays "explore.html"
   *                   "index.html"   becomes "../index.html"
   *   - From root   : "explore.html" becomes "pages/explore.html"
   *                   "index.html"   stays "index.html"
   */
  function resolveRoute(filename) {
    if (filename === "index.html")
      return _inPages ? "../index.html" : "index.html";
    return _inPages ? filename : "pages/" + filename;
  }

  /* ═══════════════════════════════════════════════════════════
     SIDEBAR TOGGLE  (called by hamburger button + overlay)
  ═══════════════════════════════════════════════════════════ */
  window.toggleSidebar = function () {
    const sb = document.getElementById("sidebar");
    const ov = document.getElementById("overlay");
    if (!sb) return;
    const open = sb.classList.toggle("open");
    ov?.classList.toggle("on", open);
  };

  window.closeSidebar = function () {
    document.getElementById("sidebar")?.classList.remove("open");
    document.getElementById("overlay")?.classList.remove("on");
  };

  /* ═══════════════════════════════════════════════════════════
     LOGOUT
  ═══════════════════════════════════════════════════════════ */
  window.logout = function () {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = _inPages
      ? "../pages/login.html"
      : "pages/login.html";
  };

  /* ═══════════════════════════════════════════════════════════
     INIT SIDEBAR
     Call once per page after you have the user object.
     Falls back to localStorage if called with no argument.

     @param {object} [user]  { name, handle, avatar, _id }
  ═══════════════════════════════════════════════════════════ */
  /* ═══════════════════════════════════════════════════════════
   NOTIFICATION PANEL — fetch helper
   Self-contained so the panel works on every page, not just index.html.
═══════════════════════════════════════════════════════════ */
  const _npToken = () => localStorage.getItem("token");
  const _npBase = "http://localhost:5000/api";

  async function _notifApi(path, opts = {}) {
    const res = await fetch(`${_npBase}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + _npToken(),
        ...(opts.headers || {}),
      },
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.message || "Request failed");
    return d;
  }

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
    panel
      .querySelector("#_np_mark_all")
      ?.addEventListener("click", async () => {
        try {
          await _notifApi("/dashboard/notifications/read-all", {
            method: "PATCH",
          });
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
        const { data: notifs = [] } = await _notifApi(
          "/dashboard/notifications",
        );
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

  /* ── Inline friend-request actions from inside the panel ── */
  async function npAcceptFreq(btn) {
    const actorId = btn.dataset.id;
    if (!actorId) return;
    btn.disabled = true;
    btn.textContent = "…";
    try {
      await _notifApi("/crafter/" + actorId + "/accept", { method: "POST" });

      // Remove ALL panel rows for this actor (de-duplicated view may still have one;
      // removes any that survived de-dup in case of race conditions)
      const panel = document.getElementById("notif-panel");
      if (panel) {
        panel
          .querySelectorAll(`.np-item[data-actor-id="${actorId}"]`)
          .forEach((item) => {
            item.querySelector(".np-freq-btns")?.remove();
            const msg = item.querySelector(".np-msg");
            if (msg) msg.textContent = "✓ Friend request accepted!";
            item.classList.remove("unread");
          });
      }

      // Mark all notifications as read so buttons don't reappear on reopen
      api("/dashboard/notifications/read-all", { method: "PATCH" }).catch(
        () => {},
      );

      window.craftToast?.("Friend request accepted! 🎉", "success");
      window.loadFriendRequests?.(); // refresh if defined on current page
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Accept";
      window.craftToast?.(e.message || "Could not accept", "error");
    }
  }

  async function npDeclineFreq(btn) {
    const actorId = btn.dataset.id;
    if (!actorId) return;
    btn.disabled = true;
    try {
      await _notifApi("/crafter/" + actorId + "/decline", { method: "POST" });

      // Remove ALL panel rows for this actor
      const panel = document.getElementById("notif-panel");
      if (panel) {
        panel
          .querySelectorAll(`.np-item[data-actor-id="${actorId}"]`)
          .forEach((item) => item.remove());
      }

      // Mark read so declined notifs don't show buttons on reopen
      api("/dashboard/notifications/read-all", { method: "PATCH" }).catch(
        () => {},
      );
    } catch (e) {
      btn.disabled = false;
    }
  }

  window.initSidebar = function (user) {
    // Auto-read from localStorage when not supplied
    if (!user) {
      try {
        user = JSON.parse(localStorage.getItem("user") || "{}");
      } catch {
        user = {};
      }
    }

    /* ── 1. Profile strip ──────────────────────────────── */
    const sbAv = document.querySelector(".sb-prof-av");
    const sbName = document.querySelector(".sb-prof-name");
    const sbSub = document.querySelector(".sb-prof-sub");

    if (sbName) sbName.textContent = user?.name || "You";
    if (sbSub) sbSub.textContent = user?.handle ? `@${user.handle}` : "";

    // Avatar helper — fills sb-prof-av + topbar avatar
    function fillAvatar(el) {
      if (!el) return;
      if (user?.avatar) {
        el.style.backgroundImage = `url(${user.avatar})`;
        el.style.backgroundSize = "cover";
        el.style.backgroundPosition = "center";
        el.textContent = "";
      } else {
        const initials = (user?.name || "?")
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        el.textContent = initials;
        Object.assign(el.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        });
      }
    }

    fillAvatar(sbAv);

    // Wire sidebar avatar click → profile
    if (sbAv)
      sbAv.onclick = () =>
        (window.location.href = resolveRoute("profile.html"));

    // Topbar avatar: try multiple possible selectors across all pages
    const topbarAv = document.querySelector(
      "#topbar-profile-av, .profile-avatar-btn, .tb-av, #topbar-av, .topbar-avatar",
    );
    fillAvatar(topbarAv);
    if (topbarAv) {
      topbarAv.style.cursor = "pointer";
      topbarAv.onclick = () =>
        (window.location.href = resolveRoute("profile.html"));
    }

    /* ── 2. Active state detection ─────────────────────── */
    const current = location.pathname.split("/").pop() || "index.html";

    // Pages that should light up a different nav item than their own filename:
    const ACTIVE_OVERRIDE = {
      "crafter-profile.html": "profile.html", // viewing someone's profile
      "settings.html": "profile.html", // settings reached from profile
      "post-detail.html": "", // no specific highlight
      "create-post.html": "",
      "edit-post.html": "",
    };
    const activeRoute = ACTIVE_OVERRIDE.hasOwnProperty(current)
      ? ACTIVE_OVERRIDE[current]
      : current;

    /* ── 3. Wire data-route nav items ─────────────────── */
    document.querySelectorAll(".nav-item[data-route]").forEach((el) => {
      const route = el.dataset.route;

      // Skip the special "notifications" pseudo-route (wired separately below)
      if (route === "notifications") return;

      // Active highlight
      if (activeRoute && route === activeRoute) el.classList.add("active");

      // Click → navigate
      el.addEventListener("click", () => {
        if (window.innerWidth <= 768) closeSidebar();
        window.location.href = resolveRoute(route);
      });
    });

    /* ── 4. Special: Notifications button ─────────────── */
    const notifBtn = document.getElementById("sidebar-notif-btn");
    if (notifBtn) {
      notifBtn.addEventListener("click", () => {
        if (window.innerWidth <= 768) closeSidebar();
        // On index.html openNotifPanel is defined; open the panel there.
        // On all other pages navigate to dashboard notifications.
        if (typeof openNotifPanel === "function") {
          const bell = document.getElementById("notif-bell-btn");
          openNotifPanel(bell || notifBtn);
        } else {
          window.location.href =
            resolveRoute("dashboard.html") + "#notifications";
        }
      });
    }

    /* ── 5. Special: Search button ────────────────────── */
    document
      .getElementById("sidebar-search-btn")
      ?.addEventListener("click", () => {
        if (window.innerWidth <= 768) closeSidebar();
        // On index.html focus the search input. Elsewhere go to explore.
        const searchInput = document.getElementById("search-input");
        if (searchInput) {
          searchInput.focus();
          searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          window.location.href = resolveRoute("explore.html");
        }
      });

    /* ── 6. Special: Saved button ─────────────────────── */
    document
      .getElementById("sidebar-saved-btn")
      ?.addEventListener("click", () => {
        if (window.innerWidth <= 768) closeSidebar();
        window.location.href = resolveRoute("dashboard.html") + "#saved";
      });

    /* ── 7. Special: Challenges (coming soon) ─────────── */
    // Challenges page doesn't exist yet — prevent navigation
    document
      .querySelectorAll('.nav-item[data-route="challenges.html"]')
      .forEach((el) => {
        el.addEventListener("click", (e) => {
          e.stopImmediatePropagation(); // prevent the data-route listener above
          if (window.innerWidth <= 768) closeSidebar();
          if (window.craftToast)
            window.craftToast("Challenges coming soon! 🏆", "info");
        });
      });

    /* ── 8. Logout button ─────────────────────────────── */
    document
      .getElementById("sidebar-logout-btn")
      ?.addEventListener("click", logout);

    /* ── 9. Distress Call button ──────────────────────── */
    document.querySelector(".distress-btn")?.addEventListener("click", () => {
      window.location.href = resolveRoute("create-post.html");
    });

    /* ── 10. Mobile: close sidebar on resize ──────────── */
    window.addEventListener(
      "resize",
      () => {
        if (window.innerWidth > 768) closeSidebar();
      },
      { passive: true },
    );
    /* ── 11. Notification panel ─────────────────────────── */
    initNotifPanel();
  };
})();
