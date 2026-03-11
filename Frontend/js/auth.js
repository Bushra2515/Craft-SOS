// // Frontend/js/auth.js
// // Handles login.html — talks to POST /api/auth/login and POST /api/auth/forgot-password
// // Fronted/js/auth.js
// const API = "http://localhost:5000/api/auth";

// /* ══════════════════════════════════════════════════
//    REDIRECT if already logged in
// ══════════════════════════════════════════════════ */
// if (localStorage.getItem("token")) {
//   window.location.href = "../index.html";
// }

// /* ══════════════════════════════════════════════════
//    STATE
// ══════════════════════════════════════════════════ */
// // let mode = "member"; // "member" | "admin"
// let attempts = 0;

// /* ══════════════════════════════════════════════════
//    MODE SWITCH  (member / admin tab)
// ══════════════════════════════════════════════════ */
// function switchMode(m) {
//   mode = m;

//   document.getElementById("tab-member").classList.toggle("on", m === "member");
//   // document.getElementById("tab-admin").classList.toggle("on", m === "admin");

//   const socialSec = document.getElementById("social-section");
//   const tfaField = document.getElementById("tfa-field");
//   const head = document.getElementById("card-head");
//   const btnLbl = document.getElementById("btn-label");
//   const foot = document.getElementById("card-foot-links");

//   if (m === "admin") {
//     socialSec.style.display = "none";
//     tfaField.style.display = "block";
//     head.querySelector(".card-h").innerHTML = "Admin <em>sign in</em>";
//     head.querySelector(".card-sub").textContent =
//       "Restricted access — authorised staff only";
//     btnLbl.textContent = "Access Admin Panel";
//     foot.style.display = "none";
//     document.getElementById("f-email").placeholder = "admin@craft-sos.com";
//   } else {
//     socialSec.style.display = "block";
//     tfaField.style.display = "none";
//     head.querySelector(".card-h").innerHTML = "Welcome back, <em>maker.</em>";
//     head.querySelector(".card-sub").textContent =
//       "Sign in to your Craft-SOS account";
//     btnLbl.textContent = "Sign In";
//     foot.style.display = "block";
//     document.getElementById("f-email").placeholder = "you@example.com";
//   }

//   clearErr();
// }

// /* ══════════════════════════════════════════════════
//    FORM SUBMIT  →  POST /api/auth/login
// ══════════════════════════════════════════════════ */
// document.getElementById("login-form").addEventListener("submit", async (e) => {
//   e.preventDefault();

//   const email = document.getElementById("f-email").value.trim();
//   const password = document.getElementById("f-pw").value;
//   const tfa = document.getElementById("f-tfa").value;
//   const rememberMe = document.getElementById("remember-cb").checked;

//   // ── Client-side validation ──────────────────────
//   let valid = true;
//   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
//     showFieldErr("err-email", "f-email");
//     valid = false;
//   }
//   if (!password) {
//     showFieldErr("err-pw", "f-pw");
//     valid = false;
//   }
//   if (mode === "admin" && tfa.length !== 6) {
//     showFieldErr("err-tfa", "f-tfa");
//     valid = false;
//   }
//   if (!valid) return;

//   // ── Loading state ───────────────────────────────
//   const btn = document.getElementById("submit-btn");
//   btn.classList.add("loading");
//   btn.disabled = true;

//   try {
//     const res = await fetch(`${API}/login`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ email, password, rememberMe, mode }),
//     });

//     const data = await res.json();
//     btn.classList.remove("loading");
//     btn.disabled = false;

//     if (!res.ok) {
//       attempts++;
//       const msgs = [
//         data.message || "Incorrect email or password. Please try again.",
//         "Still no match — double-check your credentials.",
//         "Having trouble? Try resetting your password below.",
//       ];
//       showBanner(msgs[Math.min(attempts - 1, 2)]);

//       btn.classList.add("shake");
//       setTimeout(() => btn.classList.remove("shake"), 450);
//       return;
//     }

//     // // ✅ Success — store token + user info
//     // localStorage.setItem("token", data.token);
//     // localStorage.setItem("user", JSON.stringify(data.user));

//     // // Show success overlay, then redirect
//     // document.getElementById("success-overlay").classList.add("show");

//     // setTimeout(() => {
//     //   // Admin goes to a different dashboard if needed
//     //   window.location.href =
//     //     data.user.role === "admin" ? "admin.html" : "dashboard.html";
//     // }, 1600);
//     // ✅ Success — store token + user info
//     localStorage.setItem("token", data.token);
//     localStorage.setItem("user", JSON.stringify(data.user));

//     // Admin panel needs its own key (admin.js reads "adminToken")
//     if (data.user.role === "admin" || mode === "admin") {
//       localStorage.setItem("adminToken", data.token);
//     }

//     // Show success overlay, then redirect
//     document.getElementById("success-overlay").classList.add("show");

//     setTimeout(() => {
//       window.location.href =
//         data.user.role === "admin" ? "admin.html" : "dashboard.html";
//     }, 1600);
//   } catch (err) {
//     btn.classList.remove("loading");
//     btn.disabled = false;
//     console.error("[login]", err);
//     showBanner("Network error — please check your connection and try again.");
//   }
// });

// /* ══════════════════════════════════════════════════
//    FORGOT PASSWORD  →  POST /api/auth/forgot-password
// ══════════════════════════════════════════════════ */
// function showForgot() {
//   document.getElementById("forgot-panel").classList.add("show");
//   document.getElementById("fp-form-wrap").style.display = "block";
//   document.getElementById("fp-sent").classList.remove("show");
//   // Pre-fill with whatever email was typed
//   document.getElementById("fp-email").value =
//     document.getElementById("f-email").value;
// }

// function hideForgot() {
//   document.getElementById("forgot-panel").classList.remove("show");
// }

// async function sendReset() {
//   const email = document.getElementById("fp-email").value.trim();

//   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
//     document.getElementById("fp-email").classList.add("err");
//     return;
//   }
//   document.getElementById("fp-email").classList.remove("err");

//   const btn = document.querySelector("#forgot-panel .submit-btn");
//   btn.classList.add("loading");
//   btn.disabled = true;

//   try {
//     await fetch(`${API}/forgot-password`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ email }),
//     });
//     // Always show success (server never leaks whether email exists)
//     document.getElementById("fp-form-wrap").style.display = "none";
//     document.getElementById("fp-sent").classList.add("show");
//   } catch (err) {
//     console.error("[forgotPassword]", err);
//     // Still show "check your inbox" — avoids leaking info on network errors
//     document.getElementById("fp-form-wrap").style.display = "none";
//     document.getElementById("fp-sent").classList.add("show");
//   } finally {
//     btn.classList.remove("loading");
//     btn.disabled = false;
//   }
// }

// /* ══════════════════════════════════════════════════
//    SOCIAL SIGN-IN  (demo — real OAuth needs server)
// ══════════════════════════════════════════════════ */
// function handleSocial(provider) {
//   const btn = event.currentTarget;
//   btn.style.opacity = ".6";
//   btn.style.pointerEvents = "none";

//   // TODO: replace with real OAuth redirect
//   // window.location.href = `${API}/oauth/${provider.toLowerCase()}`;

//   setTimeout(() => {
//     btn.style.opacity = "";
//     btn.style.pointerEvents = "";
//     showBanner(`${provider} sign-in is not yet enabled.`);
//   }, 800);
// }

// /* ══════════════════════════════════════════════════
//    NAVIGATION
// ══════════════════════════════════════════════════ */
// function gotoRegister() {
//   window.location.href = "register.html";
// }

// /* ══════════════════════════════════════════════════
//    PASSWORD TOGGLE
// ══════════════════════════════════════════════════ */
// function togglePw(btn) {
//   const input = document.getElementById("f-pw");
//   const show = input.type === "password";
//   input.type = show ? "text" : "password";
//   btn.querySelector("svg").innerHTML = show
//     ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
//     : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
// }

// /* ══════════════════════════════════════════════════
//    ERROR HELPERS
// ══════════════════════════════════════════════════ */
// function showFieldErr(errId, inputId) {
//   document.getElementById(errId)?.classList.add("show");
//   document.getElementById(inputId)?.classList.add("err");
// }

// function showBanner(msg) {
//   document.getElementById("err-text").textContent = msg;
//   document.getElementById("err-banner").classList.add("show");
// }

// function clearErr() {
//   document.getElementById("err-banner").classList.remove("show");
//   ["err-email", "err-pw", "err-tfa"].forEach((id) =>
//     document.getElementById(id)?.classList.remove("show"),
//   );
//   ["f-email", "f-pw", "f-tfa"].forEach((id) =>
//     document.getElementById(id)?.classList.remove("err"),
//   );
// }

// /* ══════════════════════════════════════════════════
//    INIT
// ══════════════════════════════════════════════════ */
// window.addEventListener("load", () => {
//   // Focus email on load (slight delay for animation)
//   setTimeout(() => document.getElementById("f-email")?.focus(), 700);
// });
// Frontend/js/auth.js
// Single login for all users — admins and members share the same form.
// Role is read from the JWT response; admins are redirected to admin.html.

const API = "http://localhost:5000/api/auth";

/* ── Redirect if already logged in ─────────────── */
if (localStorage.getItem("token")) {
  const stored = JSON.parse(localStorage.getItem("user") || "{}");
  window.location.href =
    stored.role === "admin" ? "admin.html" : "../index.html";
}

let attempts = 0;

/* ══════════════════════════════════════════════════
   FORM SUBMIT  →  POST /api/auth/login
══════════════════════════════════════════════════ */
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("f-email").value.trim();
  const password = document.getElementById("f-pw").value;
  const rememberMe = document.getElementById("remember-cb").checked;

  // Client-side validation
  let valid = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldErr("err-email", "f-email");
    valid = false;
  }
  if (!password) {
    showFieldErr("err-pw", "f-pw");
    valid = false;
  }
  if (!valid) return;

  const btn = document.getElementById("submit-btn");
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
    });

    const data = await res.json();
    btn.classList.remove("loading");
    btn.disabled = false;

    if (!res.ok) {
      attempts++;
      const msgs = [
        data.message || "Incorrect email or password. Please try again.",
        "Still no match — double-check your credentials.",
        "Having trouble? Try resetting your password below.",
      ];
      showBanner(msgs[Math.min(attempts - 1, 2)]);
      btn.classList.add("shake");
      setTimeout(() => btn.classList.remove("shake"), 450);
      return;
    }

    // Success — store token + user
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    // admin.js reads "adminToken" — set it so the admin panel works
    if (data.user.role === "admin" || data.user.role === "moderator") {
      localStorage.setItem("adminToken", data.token);
    }

    document.getElementById("success-overlay").classList.add("show");

    setTimeout(() => {
      window.location.href =
        data.user.role === "admin" ? "admin.html" : "dashboard.html";
    }, 1600);
  } catch (err) {
    btn.classList.remove("loading");
    btn.disabled = false;
    console.error("[login]", err);
    showBanner("Network error — please check your connection and try again.");
  }
});

/* ══════════════════════════════════════════════════
   FORGOT PASSWORD  →  POST /api/auth/forgot-password
══════════════════════════════════════════════════ */
function showForgot() {
  document.getElementById("forgot-panel").classList.add("show");
  document.getElementById("fp-form-wrap").style.display = "block";
  document.getElementById("fp-sent").classList.remove("show");
  document.getElementById("fp-email").value =
    document.getElementById("f-email").value;
}

function hideForgot() {
  document.getElementById("forgot-panel").classList.remove("show");
}

async function sendReset() {
  const email = document.getElementById("fp-email").value.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById("fp-email").classList.add("err");
    return;
  }
  document.getElementById("fp-email").classList.remove("err");

  const btn = document.querySelector("#forgot-panel .submit-btn");
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    await fetch(`${API}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  } catch (err) {
    console.error("[forgotPassword]", err);
  } finally {
    // Always show "check inbox" — never reveal whether email exists
    document.getElementById("fp-form-wrap").style.display = "none";
    document.getElementById("fp-sent").classList.add("show");
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

/* ── Social sign-in placeholder ─────────────────── */
function handleSocial(provider) {
  const btn = event.currentTarget;
  btn.style.opacity = ".6";
  btn.style.pointerEvents = "none";
  setTimeout(() => {
    btn.style.opacity = "";
    btn.style.pointerEvents = "";
    showBanner(`${provider} sign-in is not yet enabled.`);
  }, 800);
}

/* ── Navigation ─────────────────────────────────── */
function gotoRegister() {
  window.location.href = "register.html";
}

/* ── Password visibility toggle ─────────────────── */
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.querySelector("svg").innerHTML = show
    ? '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

/* ── Error helpers ───────────────────────────────── */
function showFieldErr(errId, inputId) {
  document.getElementById(errId)?.classList.add("show");
  document.getElementById(inputId)?.classList.add("err");
}

function showBanner(msg) {
  document.getElementById("err-text").textContent = msg;
  document.getElementById("err-banner").classList.add("show");
}

function clearErr() {
  document.getElementById("err-banner").classList.remove("show");
  ["err-email", "err-pw"].forEach((id) =>
    document.getElementById(id)?.classList.remove("show"),
  );
  ["f-email", "f-pw"].forEach((id) =>
    document.getElementById(id)?.classList.remove("err"),
  );
}

/* ── Init ────────────────────────────────────────── */
window.addEventListener("load", () => {
  setTimeout(() => document.getElementById("f-email")?.focus(), 700);
});

/* ══════════════════════════════════════════════════
   REGISTER  →  POST /api/auth/register
   Called by register.html button onclick="register()"
══════════════════════════════════════════════════ */
async function register() {
  const name = document.getElementById("name")?.value.trim();
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;
  const errEl = document.getElementById("register-error");

  if (!name || !email || !password) {
    if (errEl) errEl.textContent = "Please fill in all fields.";
    return;
  }
  if (password.length < 6) {
    if (errEl) errEl.textContent = "Password must be at least 6 characters.";
    return;
  }

  const btn = document.querySelector("button[onclick='register()']");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Registering…";
  }

  try {
    const res = await fetch("http://localhost:5000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      const msg =
        data.errors?.join(", ") || data.message || "Registration failed";
      if (errEl) errEl.textContent = msg;
      return;
    }

    window.location.href = "login.html";
  } catch (err) {
    console.error("[register]", err);
    if (errEl) errEl.textContent = "Network error — please try again.";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Register";
    }
  }
}
