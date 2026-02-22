// Frontend/js/register.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Handles the entire 3-step registration form. Collects data across steps,
//   validates each step, then POSTs everything to POST /api/auth/register on
//   the final submit. Saves the returned JWT + user to localStorage and
//   redirects to the dashboard on success.
//
// It REPLACES the inline <script> block in register.html so all JS lives here.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:5000/api";

/* ════════════════════════════════════════════════════════
   STATE — everything collected across all 3 steps
════════════════════════════════════════════════════════ */
const state = {
  step: 1,
  // Step 1
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  password: "",
  newsletter: false,
  // Step 2
  businessType: null, // "sole-maker" | "small-studio" | "supplier" | "aspiring" | "just-crafter"
  skills: [], // ["🧶 Yarn & Fibre", ...]
  experience: 2, // 0-10
  location: "",
  // Step 3
  communityRole: "both", // "seeker" | "helper" | "both"
};

/* ════════════════════════════════════════════════════════
   USERNAME AVAILABILITY CHECK
   Debounced — fires 700ms after the user stops typing.
   Calls GET /api/auth/check-username?username=xxx
════════════════════════════════════════════════════════ */
let _unTimer;

async function checkUsername(val) {
  const badge = document.getElementById("avail-badge");
  clearTimeout(_unTimer);

  if (!val || val.length < 3) {
    badge.innerHTML = "";
    validateStep1Btn();
    return;
  }

  badge.innerHTML = `<span class="avail-badge checking">⏳ Checking…</span>`;

  _unTimer = setTimeout(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/auth/check-username?username=${encodeURIComponent(val)}`,
      );
      const data = await res.json();

      if (data.available) {
        badge.innerHTML = `<span class="avail-badge available">✓ @${val} is available</span>`;
      } else {
        badge.innerHTML = `<span class="avail-badge taken">✖ @${val} is taken</span>`;
      }
    } catch {
      // Network error — fall back to a client-side simulation so the form still works
      const taken = ["woolcraft", "knitqueen", "yarnwitch", "pebble"].some(
        (t) => val.toLowerCase().includes(t),
      );
      badge.innerHTML = taken
        ? `<span class="avail-badge taken">✖ @${val} is taken</span>`
        : `<span class="avail-badge available">✓ @${val} looks available</span>`;
    }
    validateStep1Btn();
  }, 700);
}

/* ════════════════════════════════════════════════════════
   STEP 1 — LIVE VALIDATION
════════════════════════════════════════════════════════ */
const _rules = {
  "f-first": (v) => (v.trim().length < 1 ? "Please enter your first name" : ""),
  "f-last": (v) => (v.trim().length < 1 ? "Please enter your last name" : ""),
  "f-email": (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      ? ""
      : "Please enter a valid email address",
};

function liveValidate(id) {
  const el = document.getElementById(id);
  const msg = document.getElementById(`msg-${id}`);
  const err = _rules[id] ? _rules[id](el.value) : "";

  if (!err && el.value.trim()) {
    el.classList.remove("err");
    el.classList.add("ok");
    if (msg) {
      msg.textContent = "";
      msg.className = "field-msg";
    }
  } else if (err && el.value.length > 0) {
    el.classList.add("err");
    el.classList.remove("ok");
    if (msg) {
      msg.textContent = err;
      msg.className = "field-msg err";
    }
  } else {
    el.classList.remove("err", "ok");
    if (msg) {
      msg.textContent = "";
      msg.className = "field-msg";
    }
  }
  validateStep1Btn();
}

function checkPassword(val) {
  const msg = document.getElementById("msg-f-pw");
  const bars = ["pb1", "pb2", "pb3", "pb4"];
  let score = 0;
  if (val.length >= 8) score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  bars.forEach((b, i) => {
    const el = document.getElementById(b);
    el.classList.remove("weak", "fair", "strong");
    if (i < score) {
      if (score <= 1) el.classList.add("weak");
      else if (score <= 2) el.classList.add("fair");
      else el.classList.add("strong");
    }
  });

  const labels = [
    "",
    "Weak — try a longer password",
    "Fair — add numbers or symbols",
    "Good password",
    "Strong password 💪",
  ];
  const classes = ["", "err", "hint", "ok", "ok"];
  if (msg && val.length > 0) {
    msg.textContent = labels[score];
    msg.className = `field-msg ${classes[score]}`;
  }
  if (!val.length && msg) {
    msg.textContent = "";
    msg.className = "field-msg";
  }

  const el = document.getElementById("f-pw");
  el.classList.remove("err", "ok");
  if (val.length > 0) {
    score >= 2 ? el.classList.add("ok") : el.classList.add("err");
  }
  validateStep1Btn();
}

function togglePw(id, btn) {
  const el = document.getElementById(id);
  const isText = el.type === "text";
  el.type = isText ? "password" : "text";
  btn.querySelector("svg").innerHTML = isText
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
}

function validateStep1Btn() {
  const first = document.getElementById("f-first").value.trim();
  const last = document.getElementById("f-last").value.trim();
  const email = document.getElementById("f-email").value;
  const pw = document.getElementById("f-pw").value;
  const terms = document.getElementById("cb-terms").checked;
  const badgeHTML = document.getElementById("avail-badge").innerHTML;
  const unAvail = badgeHTML.includes("available");
  const pwOk = pw.length >= 8;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  document.getElementById("btn-1").disabled = !(
    first &&
    last &&
    emailOk &&
    pwOk &&
    terms &&
    unAvail
  );
}

/* ════════════════════════════════════════════════════════
   STEP 2 — CRAFT PROFILE
════════════════════════════════════════════════════════ */
function selectType(card, val) {
  document
    .querySelectorAll("#type-grid .type-card")
    .forEach((c) => c.classList.remove("on"));
  card.classList.add("on");
  state.businessType = val;
  validateStep2Btn();
}

function togglePill(pill) {
  pill.classList.toggle("on");
  state.skills = [
    ...document.querySelectorAll("#skills-pills .skill-pill.on"),
  ].map((p) => p.textContent.trim());
  validateStep2Btn();
}

function updateExpSlider(slider) {
  state.experience = parseInt(slider.value, 10);
  const labels = {
    0: "Just getting started",
    1: "About 1 year in",
    2: "2 years in business",
    3: "3 years in",
    4: "4 years in",
    5: "5 years in",
    6: "6 years in",
    7: "7 years in",
    8: "8 years in",
    9: "9 years in",
    10: "10+ years in business",
  };
  document.getElementById("exp-val").textContent =
    labels[state.experience] || `${state.experience} years in business`;
  const pct = (state.experience / 10) * 100;
  slider.style.background = `linear-gradient(to right,var(--accent) 0%,var(--accent) ${pct}%,var(--panel) ${pct}%,var(--panel) 100%)`;
}

function validateStep2Btn() {
  const ok = state.businessType !== null && state.skills.length > 0;
  document.getElementById("btn-2").disabled = !ok;
}

/* ════════════════════════════════════════════════════════
   STEP 3 — ROLE
════════════════════════════════════════════════════════ */
function selectRole(card, val) {
  document
    .querySelectorAll("#role-grid .role-card")
    .forEach((c) => c.classList.remove("on"));
  card.classList.add("on");
  state.communityRole = val;
}

/* ════════════════════════════════════════════════════════
   STEP NAVIGATION
════════════════════════════════════════════════════════ */
function goToStep(n) {
  if (n === state.step) return;

  // Save Step 1 values into state before leaving it
  if (state.step === 1) {
    state.firstName = document.getElementById("f-first").value.trim();
    state.lastName = document.getElementById("f-last").value.trim();
    state.username = document.getElementById("f-username").value.trim();
    state.email = document.getElementById("f-email").value.trim();
    state.password = document.getElementById("f-pw").value;
    state.newsletter = document.getElementById("cb-news").checked;
  }

  // Save Step 2 values into state before leaving it
  if (state.step === 2) {
    state.location = document.getElementById("f-location").value.trim();
    state.experience = parseInt(
      document.getElementById("exp-slider").value,
      10,
    );
    // businessType and skills are already in state (updated on click)
  }

  // Animate out
  const cur = document.getElementById(`step-${state.step}`);
  cur.classList.add("out");
  setTimeout(() => {
    cur.classList.remove("active", "out");
    _updateProgress(state.step, n);
    state.step = n;
    const next = document.getElementById(`step-${n}`);
    next.classList.add("active");
    document.querySelector(".right-panel").scrollTop = 0;
  }, 200);
}

function _updateProgress(from, to) {
  if (to > from) {
    const spi = document.getElementById(`spi-${from}`);
    spi.classList.remove("active");
    spi.classList.add("done");
  } else {
    const spi = document.getElementById(`spi-${from}`);
    spi.classList.remove("active", "done");
    document.getElementById(`spi-${to}`).classList.remove("done");
  }
  document.getElementById(`spi-${to}`).classList.add("active");
}

/* ════════════════════════════════════════════════════════
   COMPLETE REGISTRATION  ← THE MAIN FUNCTION
   Called when user clicks "Join Craft-SOS" on Step 3.
   1. Collects all state
   2. POSTs to POST /api/auth/register
   3. Saves JWT + user to localStorage
   4. Shows success screen
   5. Redirects to dashboard on "Go to my feed"
════════════════════════════════════════════════════════ */
async function completeRegistration() {
  const btn = document.getElementById("btn-3");
  btn.classList.add("loading");
  btn.disabled = true;

  // Build the request body from state
  const payload = {
    firstName: state.firstName,
    lastName: state.lastName,
    username: state.username,
    email: state.email,
    password: state.password,
    businessType: state.businessType,
    skills: state.skills,
    experience: state.experience,
    location: state.location,
    communityRole: state.communityRole,
  };

  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      // Show error in toast and re-enable button
      toast(`❌ ${data.message || "Registration failed"}`);
      btn.classList.remove("loading");
      btn.disabled = false;
      return;
    }

    // ── Success: save auth data to localStorage ───────────────
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    // ── Show success screen ───────────────────────────────────
    btn.classList.remove("loading");
    document
      .querySelectorAll(".step-panel")
      .forEach((p) => p.classList.remove("active"));
    document.getElementById("step-prog").style.display = "none";
    document.querySelector(".form-toplink").style.display = "none";

    // Populate chips from selected skills (max 5 + member badge)
    const chips = state.skills.slice(0, 5);
    document.getElementById("success-chips").innerHTML =
      chips.map((s) => `<span class="success-chip">${s}</span>`).join("") +
      `<span class="success-chip">🌿 Craft-SOS Member</span>`;

    document.getElementById("success-screen").classList.add("show");
  } catch (err) {
    // Network / parse error
    console.error("[completeRegistration]", err);
    toast("❌ Network error — please check your connection and try again");
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

/* ════════════════════════════════════════════════════════
   "GO TO MY FEED" BUTTON — redirects after success
════════════════════════════════════════════════════════ */
function goToFeed() {
  window.location.href = "../index.html";
}

/* ════════════════════════════════════════════════════════
   TOAST NOTIFICATION
════════════════════════════════════════════════════════ */
let _toastT;
function toast(msg) {
  clearTimeout(_toastT);
  document.getElementById("toast-msg").textContent = msg;
  const el = document.getElementById("toast");
  el.style.opacity = "1";
  el.style.transform = "translateX(-50%) translateY(0)";
  _toastT = setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(18px)";
  }, 2800);
}

/* ════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // If user is already logged in, send them to the dashboard
  if (localStorage.getItem("token")) {
    window.location.href = "../index.html";
    return;
  }
  // Set the initial slider gradient
  updateExpSlider(document.getElementById("exp-slider"));
});
