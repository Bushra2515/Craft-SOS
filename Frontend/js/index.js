// // 🔐 Protect Page
// const token = localStorage.getItem("token");
// if (!token) {
//   window.location.href = "login.html";
// }

// // ================= LOAD FEED =================
// async function loadFeed() {
//   try {
//     const res = await fetch("http://localhost:5000/api/posts", {
//       headers: {
//         Authorization: "Bearer " + token,
//       },
//     });

//     if (res.status === 401) {
//       localStorage.removeItem("token");
//       window.location.href = "login.html";
//     }

//     const posts = await res.json();

//     const feed = document.getElementById("feed");
//     feed.innerHTML = "";

//     posts.forEach((post) => {
//       feed.innerHTML += `
//         <article class="card">
//           <div class="card-header">
//             <div class="card-av"></div>
//             <div class="card-meta">
//               <div class="card-username">${post.author?.name || "User"}</div>
//               <div class="card-time">${new Date(post.createdAt).toLocaleString()}</div>
//               <div class="card-badges">
//                 <span class="badge b-cat">${post.type}</span>
//                 ${post.tags
//                   ?.map((tag) => `<span class="badge b-cat">${tag}</span>`)
//                   .join("")}
//               </div>
//             </div>
//           </div>
//           <div class="card-body">
//             <h2 class="card-heading">${post.title}</h2>
//             <p class="card-para">${post.body}</p>
//           </div>
//         </article>
//       `;
//     });
//   } catch (error) {
//     console.error("Feed Error:", error);
//   }
// }

// loadFeed();

// function logout() {
//   localStorage.removeItem("token");
//   window.location.href = "login.html";
// }

// // function goToProfile() {
// //   window.location.href = "profile.html";
// // }

// // function goToCreatePost() {
// //   window.location.href = "createPost.html";
// // }

// function distressCall() {
//   window.location.href = "create-post.html";
// }

// function pickNav(el) {
//   document
//     .querySelectorAll(".nav-item")
//     .forEach((i) => i.classList.remove("active"));
//   el.classList.add("active");
//   if (window.innerWidth <= 520) closeSidebar();
// }

// Frontend/js/index.js

// 🔐 Protect page
// const token = localStorage.getItem("token");
// if (!token) window.location.href = "login.html";

// const token = localStorage.getItem("token");

// if (token) {
//   window.location.href = "pages/dashboard.html";
// } else {
//   window.location.href = "pages/login.html";
// }

// // ── Helpers ──────────────────────────────────────────────

// function esc(str = "") {
//   const d = document.createElement("div");
//   d.textContent = str;
//   return d.innerHTML;
// }

// function timeAgo(dateStr) {
//   if (!dateStr) return "";
//   const diff = (Date.now() - new Date(dateStr)) / 1000;
//   if (diff < 60) return `${Math.floor(diff)}s ago`;
//   if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
//   if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
//   return `${Math.floor(diff / 86400)}d ago`;
// }

// // Maps model enum → human label + badge class
// const TYPE_LABELS = {
//   sos: { label: "Distress Call", cls: "b-high" },
//   tut: { label: "Tutorial", cls: "b-low" },
//   com: { label: "Community", cls: "b-med" },
//   res: { label: "Resource", cls: "b-cat" },
// };

// // ── Load Feed ─────────────────────────────────────────────

// async function loadFeed() {
//   const feed = document.getElementById("feed");
//   feed.innerHTML = `<div class="feed-loading"><div class="spinner"></div><span>Loading posts…</span></div>`;

//   try {
//     const res = await fetch("http://localhost:5000/api/posts", {
//       headers: { Authorization: "Bearer " + token },
//     });

//     if (res.status === 401) {
//       localStorage.removeItem("token");
//       window.location.href = "/login.html";
//       return;
//     }

//     if (!res.ok) throw new Error(`Server error ${res.status}`);

//     const json = await res.json();

//     // ✅ THE FIX: controller returns { success, data: [] }
//     //    not a bare array — so we extract json.data
//     const posts = json.data || [];

//     feed.innerHTML = "";

//     if (!posts.length) {
//       feed.innerHTML = `<div class="feed-empty">No posts yet — <a href="create-post.html">create the first one!</a></div>`;
//       return;
//     }

//     posts.forEach((post) => {
//       const typeInfo = TYPE_LABELS[post.type] || {
//         label: post.type,
//         cls: "b-cat",
//       };
//       const tagsHTML = (post.tags || [])
//         .map((t) => `<span class="badge b-cat">${esc(t)}</span>`)
//         .join("");

//       const article = document.createElement("article");
//       article.className = "card";
//       article.innerHTML = `
//         <div class="card-header">
//           <div class="card-av"></div>
//           <div class="card-meta">
//             <div class="card-username">${esc(post.author?.name || "User")}</div>
//             <div class="card-time">${timeAgo(post.createdAt)}</div>
//           </div>
//           <div class="card-badges">
//               <span class="badge ${typeInfo.cls}">${typeInfo.label}</span>
//               ${tagsHTML}
//             </div>
//         </div>
//         <div class="card-body">
//           <h2 class="card-heading">${esc(post.title)}</h2>
//           <p class="card-para">${esc(post.body)}</p>
//         </div>
//         <div class="card-footer">
//           <div class="foot-av"></div>
//           <input class="msg-input" type="text" placeholder="Reply…" />
//           <div class="card-acts">
//             <button class="icon-btn" title="Replies">${post.replyCount ?? 0} 💬</button>
//             <button class="icon-btn save-btn" title="Save" onclick="savePost('${post.id || post._id}', this)">
//               ${post.isSaved ? "🔖" : "🤍"}
//             </button>
//           </div>
//         </div>
//       `;

//       feed.appendChild(article);
//     });
//   } catch (err) {
//     console.error("Feed Error:", err);
//     feed.innerHTML = `<div class="feed-empty">Failed to load posts. <button onclick="loadFeed()">Retry</button></div>`;
//   }
// }

// // ── Save / Unsave ─────────────────────────────────────────

// async function savePost(postId, btn) {
//   try {
//     const res = await fetch(`http://localhost:5000/api/posts/${postId}/save`, {
//       method: "PATCH",
//       headers: { Authorization: "Bearer " + token },
//     });
//     const json = await res.json();
//     if (json.success) btn.textContent = json.saved ? "🔖" : "🤍";
//   } catch (err) {
//     console.error("Save error:", err);
//   }
// }

// // ── Auth ──────────────────────────────────────────────────

// function logout() {
//   localStorage.removeItem("token");
//   window.location.href = "login.html";
// }

// // ── Nav helpers ───────────────────────────────────────────

// function distressCall() {
//   window.location.href = "create-post.html";
// }

// function syncNav(el, type) {
//   const label = el.textContent.trim();
//   document
//     .querySelectorAll(".tnav")
//     .forEach((n) =>
//       n.classList.toggle("active", n.textContent.trim() === label),
//     );
//   document
//     .querySelectorAll(".snav")
//     .forEach((n) =>
//       n.classList.toggle("active", n.textContent.trim() === label),
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
//   document.getElementById("sidebar")?.classList.remove("open");
//   document.getElementById("overlay")?.classList.remove("on");
// }

// window.addEventListener("resize", () => {
//   if (window.innerWidth > 520) closeSidebar();
// });

// // ── Init ──────────────────────────────────────────────────
// loadFeed();

// Frontend/js/index.js

// 🔐 Protect page
const token = localStorage.getItem("token");
if (!token) window.location.href = "pages/login.html";

// ── Helpers ──────────────────────────────────────────────

function esc(str = "") {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Maps model enum → human label + badge class
const TYPE_LABELS = {
  sos: { label: "Distress Call", cls: "b-high" },
  tut: { label: "Tutorial", cls: "b-low" },
  com: { label: "Community", cls: "b-med" },
  res: { label: "Resource", cls: "b-cat" },
};

// ── Load Feed ─────────────────────────────────────────────

async function loadFeed() {
  const feed = document.getElementById("feed");
  feed.innerHTML = `<div class="feed-loading"><div class="spinner"></div><span>Loading posts…</span></div>`;

  try {
    const res = await fetch("http://localhost:5000/api/posts", {
      headers: { Authorization: "Bearer " + token },
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "pages/login.html";
      return;
    }

    if (!res.ok) throw new Error(`Server error ${res.status}`);

    const json = await res.json();

    // ✅ THE FIX: controller returns { success, data: [] }
    //    not a bare array — so we extract json.data
    const posts = json.data || [];

    feed.innerHTML = "";

    if (!posts.length) {
      feed.innerHTML = `<div class="feed-empty">No posts yet — <a href="pages/create-post.html">create the first one!</a></div>`;
      return;
    }

    posts.forEach((post) => {
      const typeInfo = TYPE_LABELS[post.type] || {
        label: post.type,
        cls: "b-cat",
      };
      const tagsHTML = (post.tags || [])
        .map((t) => `<span class="badge b-cat">${esc(t)}</span>`)
        .join("");

      const article = document.createElement("article");
      article.className = "card";
      article.innerHTML = `
        <div class="card-header">
          <div class="card-av"></div>
          <div class="card-meta">
            <div class="card-username">${esc(post.author?.username || "User")}</div>
            <div class="card-time">${timeAgo(post.createdAt)}</div>
          </div>
          <div class="card-badges">
              <span class="badge ${typeInfo.cls}">${typeInfo.label}</span>
              ${tagsHTML}
          </div>
        </div>
        <div class="card-body">
          <h2 class="card-heading">${esc(post.title)}</h2>
          <p class="card-para">${esc(post.body)}</p>
        </div>
        <div class="card-footer">
          <div class="foot-av"></div>
          <input class="msg-input" type="text" placeholder="Reply…" />
          <div class="card-acts">
            <button class="icon-btn" title="Replies">${post.replyCount ?? 0} 💬</button>
            <button class="icon-btn save-btn" title="Save" onclick="savePost('${post.id || post._id}', this)">
              ${post.isSaved ? "🔖" : "🤍"}
            </button>
          </div>
        </div>
      `;

      feed.appendChild(article);
    });
  } catch (err) {
    console.error("Feed Error:", err);
    feed.innerHTML = `<div class="feed-empty">Failed to load posts. <button onclick="loadFeed()">Retry</button></div>`;
  }
}

/* Suggestions */
[
  "WoolCraft_Co",
  "KnitQueen",
  "YarnWitch",
  "LoopNeedle",
  "FiberArts_Jo",
  "StitchWorks",
  "CrochetPro",
].forEach((n) => {
  document.getElementById("sugg-list").innerHTML += `
      <div class="sugg-item">
        <div class="sugg-av"></div>
        <span class="sugg-name">${n}</span>
        <button class="sugg-add" onclick="follow(this)" title="Follow">
          <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>`;
});
// ── Save / Unsave ─────────────────────────────────────────

async function savePost(postId, btn) {
  try {
    const res = await fetch(`http://localhost:5000/api/posts/${postId}/save`, {
      method: "PATCH",
      headers: { Authorization: "Bearer " + token },
    });
    const json = await res.json();
    if (json.success) btn.textContent = json.saved ? "🔖" : "🤍";
  } catch (err) {
    console.error("Save error:", err);
  }
}

// ── Auth ──────────────────────────────────────────────────

function logout() {
  localStorage.removeItem("token");
  window.location.href = "pages/login.html";
}

// ── Nav helpers ───────────────────────────────────────────

function distressCall() {
  window.location.href = "pages/create-post.html";
}

function syncNav(el, type) {
  const label = el.textContent.trim();
  document
    .querySelectorAll(".tnav")
    .forEach((n) =>
      n.classList.toggle("active", n.textContent.trim() === label),
    );
  document
    .querySelectorAll(".snav")
    .forEach((n) =>
      n.classList.toggle("active", n.textContent.trim() === label),
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
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("overlay")?.classList.remove("on");
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 520) closeSidebar();
});

// ── Init ──────────────────────────────────────────────────
loadFeed();
