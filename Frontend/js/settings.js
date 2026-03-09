// // Frontend/js/settings.js
// // ─────────────────────────────────────────────────────────────────────────────
// // What this file does:
// //   Replaces the entire inline <script> from settings.html.
// //   Connects every form field, toggle, tag input, slider, and button to
// //   the real /api/settings backend.
// //
// //   On load:
// //     GET /api/settings → fills every field, slider, tag list, and toggle
// //
// //   On save (button or Ctrl+S):
// //     PATCH /api/settings → saves all profile fields
// //     PATCH /api/settings/password → if password fields are filled
// //
// //   Live features (no backend calls):
// //     • Live preview card (right column)
// //     • Handle format validation
// //     • Bio character counter
// //     • Password strength meter + match check
// //     • Tag pill add/remove
// //     • Scroll spy for section navigator
// //
// //   Handle availability:
// //     GET /api/settings/handle-check?handle=xxx  (debounced 600ms)
// //
// //   Avatar / banner upload:
// //     POST /api/upload/avatar  (Multer → uploadController)
// //     POST /api/upload/banner
// //
// //   Danger zone:
// //     PATCH  /api/settings/deactivate
// //     DELETE /api/settings/account
// // ─────────────────────────────────────────────────────────────────────────────
// "use strict";

// /* ═══════════════════════════════════════════════════════════
//    CONFIG
// ═══════════════════════════════════════════════════════════ */
// const API_BASE = "http://localhost:5000/api";
// const token = localStorage.getItem("token");
// const _me = (() => {
//   try {
//     return JSON.parse(localStorage.getItem("user") || "{}");
//   } catch {
//     return {};
//   }
// })();

// // Auth guard
// if (!token) window.location.href = "login.html";

// /* ═══════════════════════════════════════════════════════════
//    STATE
// ═══════════════════════════════════════════════════════════ */
// let dirty = false;
// let toastTimer = null;
// let handleTimer = null; // debounce for handle check

// const skillsData = {
//   current: [],
//   suggestions: [
//     "Crochet",
//     "Weaving",
//     "Felting",
//     "Spinning",
//     "Embroidery",
//     "Sewing",
//     "Block Printing",
//     "Macramé",
//     "Screen Printing",
//     "Knitting",
//   ],
// };
// const hobbiesData = {
//   current: [],
//   suggestions: [
//     "Gardening",
//     "Pottery",
//     "Book Binding",
//     "Paper Craft",
//     "Candle Making",
//     "Soap Making",
//     "Leather Work",
//     "Woodworking",
//     "Photography",
//   ],
// };

// /* ═══════════════════════════════════════════════════════════
//    UTILITIES
// ═══════════════════════════════════════════════════════════ */
// const api = async (path, opts = {}) => {
//   const r = await fetch(`${API_BASE}${path}`, {
//     ...opts,
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${token}`,
//       ...(opts.headers || {}),
//     },
//   });
//   const d = await r.json();
//   if (!r.ok) throw new Error(d.message || "Request failed");
//   return d;
// };

// function escHTML(s = "") {
//   return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// }

// /* ═══════════════════════════════════════════════════════════
//    TOAST  (wires into existing #toast element)
// ═══════════════════════════════════════════════════════════ */
// function showToast(msg, type = "success") {
//   const t = document.getElementById("toast");
//   const span = document.getElementById("toast-msg");
//   const svg = t?.querySelector("svg");
//   if (!t || !span) return;

//   span.textContent = msg;
//   if (svg) svg.style.display = type === "success" ? "" : "none";

//   // Add coloring
//   t.style.background = type === "error" ? "var(--danger, #c0392b)" : "";

//   t.classList.add("show");
//   clearTimeout(toastTimer);
//   toastTimer = setTimeout(() => {
//     t.classList.remove("show");
//     t.style.background = "";
//   }, 3000);
// }

// /* ═══════════════════════════════════════════════════════════
//    DIRTY STATE / SAVE BAR
// ═══════════════════════════════════════════════════════════ */
// function markDirty() {
//   dirty = true;
//   document.getElementById("save-bar")?.classList.remove("hidden");
// }

// /* ═══════════════════════════════════════════════════════════
//    LOAD SETTINGS — GET /api/settings
//    Populates every field on page load.
// ═══════════════════════════════════════════════════════════ */
// async function loadSettings() {
//   try {
//     const { settings: s } = await api("/settings");

//     // ── Basic info ──────────────────────────────────────
//     setVal("firstName", s.firstName);
//     setVal("lastName", s.lastName);
//     setVal("handle-input", s.handle);
//     setVal("bio", s.bio);
//     setVal("location", s.location);
//     setVal("website", s.website);
//     setVal("email", s.email);

//     // ── Social ──────────────────────────────────────────
//     setVal("ig-input", s.instagram);
//     setVal("etsy-input", s.etsy);
//     setVal("rav-input", s.ravelry);
//     setVal("pin-input", s.pinterest);

//     // ── Banner / avatar ──────────────────────────────────
//     if (s.avatar) {
//       const avCircle = document.querySelector(".av-circle");
//       if (avCircle) {
//         avCircle.style.backgroundImage = `url(${s.avatar})`;
//         avCircle.style.backgroundSize = "cover";
//         avCircle.style.backgroundPosition = "center";
//         // Hide the text initial
//         avCircle.childNodes.forEach((n) => {
//           if (n.nodeType === 3) n.textContent = "";
//         });
//       }
//     }
//     if (s.bannerImg) {
//       const banner = document.querySelector(".banner-editor");
//       if (banner) {
//         banner.style.backgroundImage = `url(${s.bannerImg})`;
//         banner.style.backgroundSize = "cover";
//       }
//     }

//     // ── Business type ────────────────────────────────────
//     if (s.businessType) {
//       document.querySelectorAll(".biz-card").forEach((c) => {
//         c.classList.toggle("selected", c.dataset.val === s.businessType);
//       });
//     }

//     // ── Community role ───────────────────────────────────
//     if (s.communityRole) {
//       document.querySelectorAll(".role-option").forEach((r) => {
//         r.classList.toggle("selected", r.dataset.val === s.communityRole);
//       });
//     }

//     // ── Experience slider ────────────────────────────────
//     const slider = document.getElementById("exp-slider");
//     if (slider) {
//       slider.value = s.experience ?? 0;
//       updateExpLabel(slider);
//     }

//     // ── Tags ─────────────────────────────────────────────
//     skillsData.current = Array.isArray(s.skills) ? [...s.skills] : [];
//     hobbiesData.current = Array.isArray(s.hobbies) ? [...s.hobbies] : [];
//     renderTags("skills");
//     renderTags("hobbies");

//     // ── Notifications ────────────────────────────────────
//     const prefs = s.notifPreferences || {};
//     setToggle("notif-push", prefs.push);
//     setToggle("notif-responses", prefs.newResponses);
//     setToggle("notif-friends", prefs.friendRequests);
//     setToggle("notif-highlights", prefs.communityHighlights);

//     // ── Sync live preview ────────────────────────────────
//     updateBioChars();
//     syncPreview();
//   } catch (err) {
//     showToast("Could not load settings: " + err.message, "error");
//   }
// }

// function setVal(id, val) {
//   const el = document.getElementById(id);
//   if (el && val !== undefined) el.value = val ?? "";
// }

// function setToggle(id, val) {
//   const el = document.getElementById(id);
//   if (el) el.checked = Boolean(val);
// }

// /* ═══════════════════════════════════════════════════════════
//    SAVE PROFILE — PATCH /api/settings
// ═══════════════════════════════════════════════════════════ */
// async function saveProfile() {
//   // ── Client-side validation ────────────────────────────
//   const firstName = g("firstName").trim();
//   const lastName = g("lastName").trim();
//   const email = g("email").trim();

//   if (!firstName || !lastName) {
//     showToast("First and last name are required", "error");
//     return;
//   }
//   if (!email.includes("@")) {
//     showToast("Please enter a valid email address", "error");
//     return;
//   }

//   // ── Collect all fields ────────────────────────────────
//   const payload = {
//     firstName,
//     lastName,
//     handle: g("handle-input").trim(),
//     bio: g("bio").trim(),
//     location: g("location").trim(),
//     website: g("website").trim(),
//     email,
//     instagram: g("ig-input").trim(),
//     etsy: g("etsy-input").trim(),
//     ravelry: g("rav-input").trim(),
//     pinterest: g("pin-input").trim(),
//     businessType:
//       document.querySelector(".biz-card.selected")?.dataset.val || "",
//     communityRole:
//       document.querySelector(".role-option.selected")?.dataset.val || "both",
//     experience: parseInt(document.getElementById("exp-slider")?.value) || 0,
//     skills: [...skillsData.current],
//     hobbies: [...hobbiesData.current],
//     notifPreferences: {
//       push: getToggle("notif-push"),
//       newResponses: getToggle("notif-responses"),
//       friendRequests: getToggle("notif-friends"),
//       communityHighlights: getToggle("notif-highlights"),
//     },
//   };

//   // ── Button loading state ──────────────────────────────
//   const btns = document.querySelectorAll(".btn-primary");
//   btns.forEach((b) => {
//     b.disabled = true;
//     b.dataset.orig = b.innerHTML;
//     b.innerHTML = "Saving…";
//   });

//   try {
//     const { user: updatedUser } = await api("/settings", {
//       method: "PATCH",
//       body: JSON.stringify(payload),
//     });

//     // Also try password change if fields are filled
//     const currentPw = g("current-pw");
//     const newPw = g("new-pw");
//     const confirmPw = g("confirm-pw");

//     if (currentPw && newPw) {
//       if (newPw !== confirmPw) {
//         showToast("Passwords do not match", "error");
//         return;
//       }
//       await api("/settings/password", {
//         method: "PATCH",
//         body: JSON.stringify({
//           currentPassword: currentPw,
//           newPassword: newPw,
//         }),
//       });
//       // Clear password fields after success
//       ["current-pw", "new-pw", "confirm-pw"].forEach((id) => {
//         const el = document.getElementById(id);
//         if (el) el.value = "";
//       });
//     }

//     // ── Update localStorage user object ───────────────────
//     const stored = JSON.parse(localStorage.getItem("user") || "{}");
//     localStorage.setItem("user", JSON.stringify({ ...stored, ...updatedUser }));

//     dirty = false;
//     document.getElementById("save-bar")?.classList.add("hidden");
//     showToast("Profile saved successfully! ✅");
//   } catch (err) {
//     showToast(err.message, "error");
//   } finally {
//     btns.forEach((b) => {
//       b.disabled = false;
//       b.innerHTML = b.dataset.orig || "Save Changes";
//     });
//   }
// }

// function g(id) {
//   return document.getElementById(id)?.value || "";
// }
// function getToggle(id) {
//   return document.getElementById(id)?.checked ?? false;
// }

// /* ═══════════════════════════════════════════════════════════
//    DISCARD CHANGES
// ═══════════════════════════════════════════════════════════ */
// function resetForm() {
//   dirty = false;
//   document.getElementById("save-bar")?.classList.add("hidden");
//   showToast("Changes discarded");
//   // Reload settings from server to restore original values
//   loadSettings();
// }

// /* ═══════════════════════════════════════════════════════════
//    LIVE PREVIEW
// ═══════════════════════════════════════════════════════════ */
// function syncPreview() {
//   const fn = g("firstName");
//   const ln = g("lastName");
//   const hdl = g("handle-input");
//   const bio = g("bio");
//   const loc = g("location");

//   const nameEl = document.getElementById("prev-name");
//   const handleEl = document.getElementById("prev-handle");
//   const bioEl = document.getElementById("prev-bio");
//   const locEl = document.getElementById("prev-loc");
//   const avEl = document.getElementById("prev-av");

//   if (nameEl) nameEl.textContent = (fn + " " + ln).trim() || "Your Name";
//   if (handleEl) handleEl.textContent = hdl ? "@" + hdl : "@handle";
//   if (bioEl) bioEl.textContent = bio || "Your bio will appear here…";

//   if (locEl) {
//     locEl.innerHTML = loc
//       ? `<svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${escHTML(loc)}`
//       : "";
//   }
//   if (avEl && fn) {
//     avEl.textContent = ((fn[0] || "") + (ln[0] || "")).toUpperCase() || "?";
//   }
// }

// /* ═══════════════════════════════════════════════════════════
//    HANDLE AVAILABILITY  (debounced)
// ═══════════════════════════════════════════════════════════ */
// async function checkHandle(input) {
//   const val = input.value.trim().toLowerCase();
//   const status = document.getElementById("handle-status");
//   if (!status) return;

//   if (!val || val.length < 3) {
//     status.className = "handle-status";
//     status.innerHTML = "";
//     return;
//   }

//   // Format check (instant, no API)
//   if (!/^[a-z0-9_]{3,30}$/.test(val)) {
//     status.className = "handle-status taken";
//     status.innerHTML = crossSVG();
//     return;
//   }

//   // Debounce the API call
//   clearTimeout(handleTimer);
//   handleTimer = setTimeout(async () => {
//     try {
//       const { available } = await api(
//         `/settings/handle-check?handle=${encodeURIComponent(val)}`,
//       );
//       status.className = "handle-status " + (available ? "ok" : "taken");
//       status.innerHTML = available ? checkSVG() : crossSVG();
//     } catch {
//       status.className = "handle-status";
//       status.innerHTML = "";
//     }
//   }, 600);
// }

// function checkSVG() {
//   return `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
// }
// function crossSVG() {
//   return `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
// }

// /* ═══════════════════════════════════════════════════════════
//    BIO CHARACTER COUNTER
// ═══════════════════════════════════════════════════════════ */
// function updateBioChars() {
//   const ta = document.getElementById("bio");
//   if (!ta) return;
//   const len = ta.value.length;
//   const lbl = `${len} / 300`;
//   const charsEl = document.getElementById("bio-chars");
//   const barEl = document.getElementById("bio-chars-bar");
//   if (charsEl) charsEl.textContent = lbl;
//   if (barEl) {
//     barEl.textContent = lbl;
//     barEl.style.color = len > 280 ? "var(--danger, #c0392b)" : "";
//   }
// }

// /* ═══════════════════════════════════════════════════════════
//    BUSINESS TYPE / COMMUNITY ROLE SELECTORS
// ═══════════════════════════════════════════════════════════ */
// function selectBiz(el) {
//   document
//     .querySelectorAll(".biz-card")
//     .forEach((c) => c.classList.remove("selected"));
//   el.classList.add("selected");
//   markDirty();
// }

// function selectRole(el) {
//   document
//     .querySelectorAll(".role-option")
//     .forEach((r) => r.classList.remove("selected"));
//   el.classList.add("selected");
//   markDirty();
// }

// /* ═══════════════════════════════════════════════════════════
//    EXPERIENCE SLIDER
// ═══════════════════════════════════════════════════════════ */
// function updateExpLabel(input) {
//   const val = parseInt(input.value);
//   const label =
//     val === 0
//       ? "Just starting out"
//       : val === 1
//         ? "1 year"
//         : val >= 20
//           ? "20+ years"
//           : `${val} years`;

//   const el = document.getElementById("exp-val");
//   if (el) el.textContent = label;

//   const pct = (val / 20) * 100;
//   input.style.background = `linear-gradient(to right, var(--accent, #7a8f52) ${pct}%, rgba(122,143,82,.2) ${pct}%)`;
// }

// /* ═══════════════════════════════════════════════════════════
//    TAG PILLS (skills + hobbies)
// ═══════════════════════════════════════════════════════════ */
// function renderTags(type) {
//   const data = type === "skills" ? skillsData : hobbiesData;
//   const fieldId = type + "-field";
//   const inputId = type + "-input";
//   const field = document.getElementById(fieldId);
//   const inputEl = document.getElementById(inputId);
//   if (!field || !inputEl) return;

//   // Remove old pills (keep the input)
//   field.querySelectorAll(".tag-pill-item").forEach((p) => p.remove());

//   data.current.forEach((tag) => {
//     const pill = document.createElement("div");
//     pill.className = "tag-pill-item";
//     pill.innerHTML = `${escHTML(tag)}<button class="tag-remove" title="Remove">✕</button>`;
//     pill.querySelector(".tag-remove").onclick = () => {
//       data.current = data.current.filter((t) => t !== tag);
//       renderTags(type);
//       markDirty();
//     };
//     field.insertBefore(pill, inputEl);
//   });

//   // Suggestions (exclude already added)
//   const suggEl = document.getElementById(type + "-suggestions");
//   if (suggEl) {
//     const available = data.suggestions
//       .filter((s) => !data.current.includes(s))
//       .slice(0, 6);
//     suggEl.innerHTML = available
//       .map(
//         (s) =>
//           `<span class="tag-suggestion" onclick="addTagFromSuggestion('${type}','${escHTML(s)}')">${escHTML(s)}</span>`,
//       )
//       .join("");
//   }
// }

// function handleTagInput(e, type) {
//   const data = type === "skills" ? skillsData : hobbiesData;
//   const input = e.target;

//   if (e.key === "Enter" || e.key === ",") {
//     e.preventDefault();
//     const val = input.value.trim().replace(/,$/, "");
//     if (val && !data.current.includes(val) && data.current.length < 20) {
//       data.current.push(val);
//       input.value = "";
//       renderTags(type);
//       markDirty();
//     }
//   } else if (
//     e.key === "Backspace" &&
//     input.value === "" &&
//     data.current.length
//   ) {
//     data.current.pop();
//     renderTags(type);
//     markDirty();
//   }
// }

// function addTagFromSuggestion(type, tag) {
//   const data = type === "skills" ? skillsData : hobbiesData;
//   if (!data.current.includes(tag) && data.current.length < 20) {
//     data.current.push(tag);
//     renderTags(type);
//     markDirty();
//   }
// }

// function focusTagInput(id) {
//   document.getElementById(id)?.focus();
// }

// /* ═══════════════════════════════════════════════════════════
//    PASSWORD STRENGTH + MATCH
// ═══════════════════════════════════════════════════════════ */
// function checkPwStrength(input) {
//   const pw = input.value;
//   const fill = document.getElementById("pw-fill");
//   const lbl = document.getElementById("pw-label");
//   if (!fill || !lbl) return;

//   let s = 0;
//   if (pw.length >= 8) s++;
//   if (/[A-Z]/.test(pw)) s++;
//   if (/[0-9]/.test(pw)) s++;
//   if (/[^A-Za-z0-9]/.test(pw)) s++;

//   const levels = [
//     { w: "0%", color: "", text: "" },
//     { w: "25%", color: "var(--danger, #c0392b)", text: "Weak" },
//     { w: "50%", color: "#e6a817", text: "Fair" },
//     { w: "75%", color: "#6ab04c", text: "Good" },
//     { w: "100%", color: "var(--success, #27ae60)", text: "Strong 💪" },
//   ];
//   const lvl = levels[s];
//   fill.style.width = lvl.w;
//   fill.style.background = lvl.color;
//   lbl.textContent = lvl.text;
//   lbl.style.color = lvl.color || "";
// }

// function checkPwMatch() {
//   const nw = document.getElementById("new-pw")?.value || "";
//   const cf = document.getElementById("confirm-pw")?.value || "";
//   const err = document.getElementById("pw-match-err");
//   const cfEl = document.getElementById("confirm-pw");
//   if (!err || !cfEl) return;

//   if (cf && nw !== cf) {
//     err.classList.add("show");
//     cfEl.classList.add("error");
//     cfEl.classList.remove("success");
//   } else {
//     err.classList.remove("show");
//     cfEl.classList.remove("error");
//     if (cf) cfEl.classList.add("success");
//   }
// }

// /* ═══════════════════════════════════════════════════════════
//    AVATAR / BANNER UPLOAD  (Multer via uploadController)
// ═══════════════════════════════════════════════════════════ */
// function triggerAvatarUpload() {
//   document.getElementById("avatar-input")?.click();
// }
// function triggerBannerUpload() {
//   document.getElementById("banner-input")?.click();
// }

// async function handleAvatarChange(input) {
//   const file = input.files[0];
//   if (!file) return;

//   const fd = new FormData();
//   fd.append("avatar", file);

//   try {
//     const r = await fetch(`${API_BASE}/upload/avatar`, {
//       method: "POST",
//       headers: { Authorization: `Bearer ${token}` },
//       body: fd,
//     });
//     const { url } = await r.json();

//     // Update preview on page
//     const avCircle = document.querySelector(".av-circle");
//     const prevAv = document.getElementById("prev-av");
//     if (avCircle) {
//       avCircle.style.backgroundImage = `url(${url})`;
//       avCircle.style.backgroundSize = "cover";
//       avCircle.style.backgroundPosition = "center";
//     }
//     if (prevAv) prevAv.style.backgroundImage = `url(${url})`;

//     // Update localStorage
//     const stored = JSON.parse(localStorage.getItem("user") || "{}");
//     stored.avatar = url;
//     localStorage.setItem("user", JSON.stringify(stored));

//     showToast("Avatar uploaded successfully!");
//     markDirty();
//   } catch {
//     showToast("Avatar upload failed", "error");
//   }
// }

// async function handleBannerChange(input) {
//   const file = input.files[0];
//   if (!file) return;

//   const fd = new FormData();
//   fd.append("banner", file);

//   try {
//     const r = await fetch(`${API_BASE}/upload/banner`, {
//       method: "POST",
//       headers: { Authorization: `Bearer ${token}` },
//       body: fd,
//     });
//     const { url } = await r.json();

//     const banner = document.querySelector(".banner-editor");
//     if (banner) {
//       banner.style.backgroundImage = `url(${url})`;
//       banner.style.backgroundSize = "cover";
//     }

//     showToast("Banner uploaded!");
//     markDirty();
//   } catch {
//     showToast("Banner upload failed", "error");
//   }
// }

// /* ═══════════════════════════════════════════════════════════
//    DANGER ZONE
// ═══════════════════════════════════════════════════════════ */
// async function confirmDeactivate() {
//   if (
//     !confirm(
//       "Deactivate your account? Your profile will be hidden until you log back in.",
//     )
//   )
//     return;
//   try {
//     await api("/settings/deactivate", { method: "PATCH" });
//     showToast("Account deactivated. Logging out…");
//     setTimeout(() => {
//       localStorage.clear();
//       window.location.href = "login.html";
//     }, 2000);
//   } catch (err) {
//     showToast(err.message, "error");
//   }
// }

// async function confirmDelete() {
//   const pw = prompt("Enter your password to permanently delete your account:");
//   if (!pw) return;

//   const double = confirm(
//     "This is permanent and cannot be undone. Are you absolutely sure?",
//   );
//   if (!double) return;

//   try {
//     await api("/settings/account", {
//       method: "DELETE",
//       body: JSON.stringify({ password: pw }),
//     });
//     showToast("Account deleted. Goodbye 🌿");
//     setTimeout(() => {
//       localStorage.clear();
//       window.location.href = "login.html";
//     }, 2000);
//   } catch (err) {
//     showToast(err.message, "error");
//   }
// }

// /* ═══════════════════════════════════════════════════════════
//    SCROLL SPY (section navigator)
// ═══════════════════════════════════════════════════════════ */
// const SECTIONS = [
//   "sec-photo",
//   "sec-basic",
//   "sec-contact",
//   "sec-craft",
//   "sec-role",
//   "sec-notifs",
//   "sec-password",
//   "sec-danger",
// ];

// function updateScrollSpy() {
//   const navItems = document.querySelectorAll(".section-nav-item");
//   let active = 0;
//   SECTIONS.forEach((id, i) => {
//     const el = document.getElementById(id);
//     if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4)
//       active = i;
//   });
//   navItems.forEach((n, i) => n.classList.toggle("active", i === active));
// }

// function scrollToSection(id) {
//   document
//     .getElementById(id)
//     ?.scrollIntoView({ behavior: "smooth", block: "start" });
// }

// /* ═══════════════════════════════════════════════════════════
//    NAV  (sidebar)
// ═══════════════════════════════════════════════════════════ */
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

// /* ═══════════════════════════════════════════════════════════
//    INIT
// ═══════════════════════════════════════════════════════════ */
// document.addEventListener("DOMContentLoaded", () => {
//   // Load data from API
//   loadSettings();

//   // Ctrl+S to save
//   document.addEventListener("keydown", (e) => {
//     if ((e.ctrlKey || e.metaKey) && e.key === "s") {
//       e.preventDefault();
//       saveProfile();
//     }
//   });

//   // Scroll spy
//   window.addEventListener("scroll", updateScrollSpy, { passive: true });

//   // Wire resize (sidebar)
//   window.addEventListener("resize", () => {
//     if (window.innerWidth > 520) closeSidebar();
//   });

//   // Wire banner input (avatar already has onchange in HTML)
//   const bannerInput = document.getElementById("banner-input");
//   if (bannerInput)
//     bannerInput.onchange = function () {
//       handleBannerChange(this);
//     };

//   // // Populate sidebar user info
//   // const sbName = document.querySelector(".sb-prof-name");
//   // const sbSub = document.querySelector(".sb-prof-sub");
//   // const sbAv = document.querySelector(".sb-prof-av");
//   // const topAv = document.querySelector(".profile-avatar-btn");

//   // if (sbName) sbName.textContent = _me?.name || "You";
//   // if (sbSub) sbSub.textContent = _me?.handle ? `@${_me.handle}` : "";
//   // if (_me?.avatar) {
//   //   [sbAv, topAv].forEach((el) => {
//   //     if (!el) return;
//   //     el.style.backgroundImage = `url(${_me.avatar})`;
//   //     el.style.backgroundSize = "cover";
//   //     el.style.backgroundPosition = "center";
//   //   });
//   // }

//   // // Wire nav items to pages
//   // const NAV_ROUTES = {
//   //   Home: "../index.html",
//   //   Explore: "explore.html",
//   //   Notifications: "dashboard.html",
//   //   Messages: "chat.html",
//   //   Profile: "profile.html",
//   //   Settings: "settings.html",
//   // };
//   // document.querySelectorAll(".nav-item").forEach((el) => {
//   //   const label = el.querySelector(".nav-label")?.textContent?.trim();
//   //   if (label && NAV_ROUTES[label] && label !== "Settings") {
//   //     el.style.cursor = "pointer";
//   //     el.addEventListener(
//   //       "click",
//   //       () => (window.location.href = NAV_ROUTES[label]),
//   //     );
//   //   }
//   // });

//   // // Wire Distress Call button
//   // document.querySelector(".distress-btn")?.addEventListener("click", () => {
//   //   window.location.href = "create-post.html";
//   // });

//   // // Wire profile avatar button
//   // document
//   //   .querySelector(".profile-avatar-btn")
//   //   ?.addEventListener("click", () => {
//   //     window.location.href = "profile.html";
//   //   });
// });
// Frontend/js/settings.js
// ─────────────────────────────────────────────────────────────────────────────
// What this file does:
//   Replaces the entire inline <script> from settings.html.
//   Connects every form field, toggle, tag input, slider, and button to
//   the real /api/settings backend.
//
//   On load:
//     GET /api/settings → fills every field, slider, tag list, and toggle
//
//   On save (button or Ctrl+S):
//     PATCH /api/settings → saves all profile fields
//     PATCH /api/settings/password → if password fields are filled
//
//   Live features (no backend calls):
//     • Live preview card (right column)
//     • Handle format validation
//     • Bio character counter
//     • Password strength meter + match check
//     • Tag pill add/remove
//     • Scroll spy for section navigator
//
//   Handle availability:
//     GET /api/settings/handle-check?handle=xxx  (debounced 600ms)
//
//   Avatar / banner upload:
//     POST /api/upload/avatar  (Multer → uploadController)
//     POST /api/upload/banner
//
//   Danger zone:
//     PATCH  /api/settings/deactivate
//     DELETE /api/settings/account
// ─────────────────────────────────────────────────────────────────────────────
"use strict";

/* ═══════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════ */
const API_BASE = "http://localhost:5000/api";
const token = localStorage.getItem("token");
const _me = (() => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
})();

// Auth guard
if (!token) window.location.href = "login.html";

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
let dirty = false;
let toastTimer = null;
let handleTimer = null; // debounce for handle check

const skillsData = {
  current: [],
  suggestions: [
    "Crochet",
    "Weaving",
    "Felting",
    "Spinning",
    "Embroidery",
    "Sewing",
    "Block Printing",
    "Macramé",
    "Screen Printing",
    "Knitting",
  ],
};
const hobbiesData = {
  current: [],
  suggestions: [
    "Gardening",
    "Pottery",
    "Book Binding",
    "Paper Craft",
    "Candle Making",
    "Soap Making",
    "Leather Work",
    "Woodworking",
    "Photography",
  ],
};

/* ═══════════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════════ */
const api = async (path, opts = {}) => {
  const r = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (r.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "login.html";
    return;
  }
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || "Request failed");
  return d;
};

function escHTML(s = "") {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ═══════════════════════════════════════════════════════════
   TOAST  (wires into existing #toast element)
═══════════════════════════════════════════════════════════ */
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  const span = document.getElementById("toast-msg");
  const svg = t?.querySelector("svg");
  if (!t || !span) return;

  span.textContent = msg;
  if (svg) svg.style.display = type === "success" ? "" : "none";

  // Add coloring
  t.style.background = type === "error" ? "var(--danger, #c0392b)" : "";

  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
    t.style.background = "";
  }, 3000);
}

/* ═══════════════════════════════════════════════════════════
   DIRTY STATE / SAVE BAR
═══════════════════════════════════════════════════════════ */
function markDirty() {
  dirty = true;
  document.getElementById("save-bar")?.classList.remove("hidden");
}

/* ═══════════════════════════════════════════════════════════
   LOAD SETTINGS — GET /api/settings
   Populates every field on page load.
═══════════════════════════════════════════════════════════ */
async function loadSettings() {
  try {
    const { settings: s } = await api("/settings");

    // ── Basic info ──────────────────────────────────────
    setVal("firstName", s.firstName);
    setVal("lastName", s.lastName);
    setVal("handle-input", s.handle);
    setVal("bio", s.bio);
    setVal("location", s.location);
    setVal("website", s.website);
    setVal("email", s.email);

    // ── Social ──────────────────────────────────────────
    setVal("ig-input", s.instagram);
    setVal("etsy-input", s.etsy);
    setVal("rav-input", s.ravelry);
    setVal("pin-input", s.pinterest);

    // ── Banner / avatar ──────────────────────────────────
    if (s.avatar) {
      const avCircle = document.querySelector(".av-circle");
      if (avCircle) {
        avCircle.style.backgroundImage = `url(${s.avatar})`;
        avCircle.style.backgroundSize = "cover";
        avCircle.style.backgroundPosition = "center";
        // Hide the text initial
        avCircle.childNodes.forEach((n) => {
          if (n.nodeType === 3) n.textContent = "";
        });
      }
    }
    if (s.bannerImg) {
      const banner = document.querySelector(".banner-editor");
      if (banner) {
        banner.style.backgroundImage = `url(${s.bannerImg})`;
        banner.style.backgroundSize = "cover";
      }
    }

    // ── Business type ────────────────────────────────────
    if (s.businessType) {
      document.querySelectorAll(".biz-card").forEach((c) => {
        c.classList.toggle("selected", c.dataset.val === s.businessType);
      });
    }

    // ── Community role ───────────────────────────────────
    if (s.communityRole) {
      document.querySelectorAll(".role-option").forEach((r) => {
        r.classList.toggle("selected", r.dataset.val === s.communityRole);
      });
    }

    // ── Experience slider ────────────────────────────────
    const slider = document.getElementById("exp-slider");
    if (slider) {
      slider.value = s.experience ?? 0;
      updateExpLabel(slider);
    }

    // ── Tags ─────────────────────────────────────────────
    skillsData.current = Array.isArray(s.skills) ? [...s.skills] : [];
    hobbiesData.current = Array.isArray(s.hobbies) ? [...s.hobbies] : [];
    renderTags("skills");
    renderTags("hobbies");

    // ── Notifications ────────────────────────────────────
    const prefs = s.notifPreferences || {};
    setToggle("notif-push", prefs.push);
    setToggle("notif-responses", prefs.newResponses);
    setToggle("notif-friends", prefs.friendRequests);
    setToggle("notif-highlights", prefs.communityHighlights);

    // ── Sync live preview ────────────────────────────────
    updateBioChars();
    syncPreview();
  } catch (err) {
    showToast("Could not load settings: " + err.message, "error");
  }
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.value = val ?? "";
}

function setToggle(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(val);
}

/* ═══════════════════════════════════════════════════════════
   SAVE PROFILE — PATCH /api/settings
═══════════════════════════════════════════════════════════ */
async function saveProfile() {
  // ── Client-side validation ────────────────────────────
  const firstName = g("firstName").trim();
  const lastName = g("lastName").trim();
  const email = g("email").trim();

  if (!firstName || !lastName) {
    showToast("First and last name are required", "error");
    return;
  }
  if (!email.includes("@")) {
    showToast("Please enter a valid email address", "error");
    return;
  }

  // ── Collect all fields ────────────────────────────────
  const payload = {
    firstName,
    lastName,
    handle: g("handle-input").trim(),
    bio: g("bio").trim(),
    location: g("location").trim(),
    website: g("website").trim(),
    email,
    instagram: g("ig-input").trim(),
    etsy: g("etsy-input").trim(),
    ravelry: g("rav-input").trim(),
    pinterest: g("pin-input").trim(),
    businessType:
      document.querySelector(".biz-card.selected")?.dataset.val || "",
    communityRole:
      document.querySelector(".role-option.selected")?.dataset.val || "both",
    experience: parseInt(document.getElementById("exp-slider")?.value) || 0,
    skills: [...skillsData.current],
    hobbies: [...hobbiesData.current],
    notifPreferences: {
      push: getToggle("notif-push"),
      newResponses: getToggle("notif-responses"),
      friendRequests: getToggle("notif-friends"),
      communityHighlights: getToggle("notif-highlights"),
    },
  };

  // ── Button loading state ──────────────────────────────
  const btns = document.querySelectorAll(".btn-primary");
  btns.forEach((b) => {
    b.disabled = true;
    b.dataset.orig = b.innerHTML;
    b.innerHTML = "Saving…";
  });

  try {
    const { user: updatedUser } = await api("/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    // Also try password change if fields are filled
    const currentPw = g("current-pw");
    const newPw = g("new-pw");
    const confirmPw = g("confirm-pw");

    if (currentPw && newPw) {
      if (newPw !== confirmPw) {
        showToast("Passwords do not match", "error");
        return;
      }
      await api("/settings/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: currentPw,
          newPassword: newPw,
        }),
      });
      // Clear password fields after success
      ["current-pw", "new-pw", "confirm-pw"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
    }

    // ── Update localStorage user object ───────────────────
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    localStorage.setItem("user", JSON.stringify({ ...stored, ...updatedUser }));

    dirty = false;
    document.getElementById("save-bar")?.classList.add("hidden");
    showToast("Profile saved successfully! ✅");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btns.forEach((b) => {
      b.disabled = false;
      b.innerHTML = b.dataset.orig || "Save Changes";
    });
  }
}

function g(id) {
  return document.getElementById(id)?.value || "";
}
function getToggle(id) {
  return document.getElementById(id)?.checked ?? false;
}

/* ═══════════════════════════════════════════════════════════
   DISCARD CHANGES
═══════════════════════════════════════════════════════════ */
function resetForm() {
  dirty = false;
  document.getElementById("save-bar")?.classList.add("hidden");
  showToast("Changes discarded");
  // Reload settings from server to restore original values
  loadSettings();
}

/* ═══════════════════════════════════════════════════════════
   LIVE PREVIEW
═══════════════════════════════════════════════════════════ */
function syncPreview() {
  const fn = g("firstName");
  const ln = g("lastName");
  const hdl = g("handle-input");
  const bio = g("bio");
  const loc = g("location");

  const nameEl = document.getElementById("prev-name");
  const handleEl = document.getElementById("prev-handle");
  const bioEl = document.getElementById("prev-bio");
  const locEl = document.getElementById("prev-loc");
  const avEl = document.getElementById("prev-av");

  if (nameEl) nameEl.textContent = (fn + " " + ln).trim() || "Your Name";
  if (handleEl) handleEl.textContent = hdl ? "@" + hdl : "@handle";
  if (bioEl) bioEl.textContent = bio || "Your bio will appear here…";

  if (locEl) {
    locEl.innerHTML = loc
      ? `<svg viewBox="0 0 24 24" style="width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${escHTML(loc)}`
      : "";
  }
  if (avEl && fn) {
    avEl.textContent = ((fn[0] || "") + (ln[0] || "")).toUpperCase() || "?";
  }
}

/* ═══════════════════════════════════════════════════════════
   HANDLE AVAILABILITY  (debounced)
═══════════════════════════════════════════════════════════ */
async function checkHandle(input) {
  const val = input.value.trim().toLowerCase();
  const status = document.getElementById("handle-status");
  if (!status) return;

  if (!val || val.length < 3) {
    status.className = "handle-status";
    status.innerHTML = "";
    return;
  }

  // Format check (instant, no API)
  if (!/^[a-z0-9_]{3,30}$/.test(val)) {
    status.className = "handle-status taken";
    status.innerHTML = crossSVG();
    return;
  }

  // Debounce the API call
  clearTimeout(handleTimer);
  handleTimer = setTimeout(async () => {
    try {
      const { available } = await api(
        `/settings/handle-check?handle=${encodeURIComponent(val)}`,
      );
      status.className = "handle-status " + (available ? "ok" : "taken");
      status.innerHTML = available ? checkSVG() : crossSVG();
    } catch {
      status.className = "handle-status";
      status.innerHTML = "";
    }
  }, 600);
}

function checkSVG() {
  return `<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
}
function crossSVG() {
  return `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}

/* ═══════════════════════════════════════════════════════════
   BIO CHARACTER COUNTER
═══════════════════════════════════════════════════════════ */
function updateBioChars() {
  const ta = document.getElementById("bio");
  if (!ta) return;
  const len = ta.value.length;
  const lbl = `${len} / 300`;
  const charsEl = document.getElementById("bio-chars");
  const barEl = document.getElementById("bio-chars-bar");
  if (charsEl) charsEl.textContent = lbl;
  if (barEl) {
    barEl.textContent = lbl;
    barEl.style.color = len > 280 ? "var(--danger, #c0392b)" : "";
  }
}

/* ═══════════════════════════════════════════════════════════
   BUSINESS TYPE / COMMUNITY ROLE SELECTORS
═══════════════════════════════════════════════════════════ */
function selectBiz(el) {
  document
    .querySelectorAll(".biz-card")
    .forEach((c) => c.classList.remove("selected"));
  el.classList.add("selected");
  markDirty();
}

function selectRole(el) {
  document
    .querySelectorAll(".role-option")
    .forEach((r) => r.classList.remove("selected"));
  el.classList.add("selected");
  markDirty();
}

/* ═══════════════════════════════════════════════════════════
   EXPERIENCE SLIDER
═══════════════════════════════════════════════════════════ */
function updateExpLabel(input) {
  const val = parseInt(input.value);
  const label =
    val === 0
      ? "Just starting out"
      : val === 1
        ? "1 year"
        : val >= 20
          ? "20+ years"
          : `${val} years`;

  const el = document.getElementById("exp-val");
  if (el) el.textContent = label;

  const pct = (val / 20) * 100;
  input.style.background = `linear-gradient(to right, var(--accent, #7a8f52) ${pct}%, rgba(122,143,82,.2) ${pct}%)`;
}

/* ═══════════════════════════════════════════════════════════
   TAG PILLS (skills + hobbies)
═══════════════════════════════════════════════════════════ */
function renderTags(type) {
  const data = type === "skills" ? skillsData : hobbiesData;
  const fieldId = type + "-field";
  const inputId = type + "-input";
  const field = document.getElementById(fieldId);
  const inputEl = document.getElementById(inputId);
  if (!field || !inputEl) return;

  // Remove old pills (keep the input)
  field.querySelectorAll(".tag-pill-item").forEach((p) => p.remove());

  data.current.forEach((tag) => {
    const pill = document.createElement("div");
    pill.className = "tag-pill-item";
    pill.innerHTML = `${escHTML(tag)}<button class="tag-remove" title="Remove">✕</button>`;
    pill.querySelector(".tag-remove").onclick = () => {
      data.current = data.current.filter((t) => t !== tag);
      renderTags(type);
      markDirty();
    };
    field.insertBefore(pill, inputEl);
  });

  // Suggestions (exclude already added)
  const suggEl = document.getElementById(type + "-suggestions");
  if (suggEl) {
    const available = data.suggestions
      .filter((s) => !data.current.includes(s))
      .slice(0, 6);
    suggEl.innerHTML = available
      .map(
        (s) =>
          `<span class="tag-suggestion" onclick="addTagFromSuggestion('${type}','${escHTML(s)}')">${escHTML(s)}</span>`,
      )
      .join("");
  }
}

function handleTagInput(e, type) {
  const data = type === "skills" ? skillsData : hobbiesData;
  const input = e.target;

  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const val = input.value.trim().replace(/,$/, "");
    if (val && !data.current.includes(val) && data.current.length < 20) {
      data.current.push(val);
      input.value = "";
      renderTags(type);
      markDirty();
    }
  } else if (
    e.key === "Backspace" &&
    input.value === "" &&
    data.current.length
  ) {
    data.current.pop();
    renderTags(type);
    markDirty();
  }
}

function addTagFromSuggestion(type, tag) {
  const data = type === "skills" ? skillsData : hobbiesData;
  if (!data.current.includes(tag) && data.current.length < 20) {
    data.current.push(tag);
    renderTags(type);
    markDirty();
  }
}

function focusTagInput(id) {
  document.getElementById(id)?.focus();
}

/* ═══════════════════════════════════════════════════════════
   PASSWORD STRENGTH + MATCH
═══════════════════════════════════════════════════════════ */
function checkPwStrength(input) {
  const pw = input.value;
  const fill = document.getElementById("pw-fill");
  const lbl = document.getElementById("pw-label");
  if (!fill || !lbl) return;

  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;

  const levels = [
    { w: "0%", color: "", text: "" },
    { w: "25%", color: "var(--danger, #c0392b)", text: "Weak" },
    { w: "50%", color: "#e6a817", text: "Fair" },
    { w: "75%", color: "#6ab04c", text: "Good" },
    { w: "100%", color: "var(--success, #27ae60)", text: "Strong 💪" },
  ];
  const lvl = levels[s];
  fill.style.width = lvl.w;
  fill.style.background = lvl.color;
  lbl.textContent = lvl.text;
  lbl.style.color = lvl.color || "";
}

function checkPwMatch() {
  const nw = document.getElementById("new-pw")?.value || "";
  const cf = document.getElementById("confirm-pw")?.value || "";
  const err = document.getElementById("pw-match-err");
  const cfEl = document.getElementById("confirm-pw");
  if (!err || !cfEl) return;

  if (cf && nw !== cf) {
    err.classList.add("show");
    cfEl.classList.add("error");
    cfEl.classList.remove("success");
  } else {
    err.classList.remove("show");
    cfEl.classList.remove("error");
    if (cf) cfEl.classList.add("success");
  }
}

/* ═══════════════════════════════════════════════════════════
   AVATAR / BANNER UPLOAD  (Multer via uploadController)
═══════════════════════════════════════════════════════════ */
function triggerAvatarUpload() {
  document.getElementById("avatar-input")?.click();
}
function triggerBannerUpload() {
  document.getElementById("banner-input")?.click();
}

async function handleAvatarChange(input) {
  const file = input.files[0];
  if (!file) return;

  const fd = new FormData();
  fd.append("avatar", file);

  try {
    const r = await fetch(`${API_BASE}/upload/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const { url } = await r.json();

    // Update preview on page
    const avCircle = document.querySelector(".av-circle");
    const prevAv = document.getElementById("prev-av");
    if (avCircle) {
      avCircle.style.backgroundImage = `url(${url})`;
      avCircle.style.backgroundSize = "cover";
      avCircle.style.backgroundPosition = "center";
    }
    if (prevAv) prevAv.style.backgroundImage = `url(${url})`;

    // Update localStorage
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    stored.avatar = url;
    localStorage.setItem("user", JSON.stringify(stored));

    showToast("Avatar uploaded successfully!");
    markDirty();
  } catch {
    showToast("Avatar upload failed", "error");
  }
}

async function handleBannerChange(input) {
  const file = input.files[0];
  if (!file) return;

  const fd = new FormData();
  fd.append("banner", file);

  try {
    const r = await fetch(`${API_BASE}/upload/banner`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const { url } = await r.json();

    const banner = document.querySelector(".banner-editor");
    if (banner) {
      banner.style.backgroundImage = `url(${url})`;
      banner.style.backgroundSize = "cover";
    }

    showToast("Banner uploaded!");
    markDirty();
  } catch {
    showToast("Banner upload failed", "error");
  }
}

/* ═══════════════════════════════════════════════════════════
   DANGER ZONE
═══════════════════════════════════════════════════════════ */
async function confirmDeactivate() {
  if (
    !confirm(
      "Deactivate your account? Your profile will be hidden until you log back in.",
    )
  )
    return;
  try {
    await api("/settings/deactivate", { method: "PATCH" });
    showToast("Account deactivated. Logging out…");
    setTimeout(() => {
      localStorage.clear();
      window.location.href = "login.html";
    }, 2000);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function confirmDelete() {
  const pw = prompt("Enter your password to permanently delete your account:");
  if (!pw) return;

  const double = confirm(
    "This is permanent and cannot be undone. Are you absolutely sure?",
  );
  if (!double) return;

  try {
    await api("/settings/account", {
      method: "DELETE",
      body: JSON.stringify({ password: pw }),
    });
    showToast("Account deleted. Goodbye 🌿");
    setTimeout(() => {
      localStorage.clear();
      window.location.href = "login.html";
    }, 2000);
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* ═══════════════════════════════════════════════════════════
   SCROLL SPY (section navigator)
═══════════════════════════════════════════════════════════ */
const SECTIONS = [
  "sec-photo",
  "sec-basic",
  "sec-contact",
  "sec-craft",
  "sec-role",
  "sec-notifs",
  "sec-password",
  "sec-danger",
];

function updateScrollSpy() {
  const navItems = document.querySelectorAll(".section-nav-item");
  let active = 0;
  SECTIONS.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4)
      active = i;
  });
  navItems.forEach((n, i) => n.classList.toggle("active", i === active));
}

function scrollToSection(id) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ═══════════════════════════════════════════════════════════
   NAV  (sidebar)
═══════════════════════════════════════════════════════════ */
function syncNav(el) {
  const label = el.textContent.trim();
  document
    .querySelectorAll(".tnav,.snav")
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

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  // Load data from API
  loadSettings();

  // Ctrl+S to save
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveProfile();
    }
  });

  // Scroll spy
  window.addEventListener("scroll", updateScrollSpy, { passive: true });

  // Wire resize (sidebar)
  window.addEventListener("resize", () => {
    if (window.innerWidth > 520) closeSidebar();
  });

  // Wire banner input (avatar already has onchange in HTML)
  const bannerInput = document.getElementById("banner-input");
  if (bannerInput)
    bannerInput.onchange = function () {
      handleBannerChange(this);
    };

  // Populate sidebar user info
  const sbName = document.querySelector(".sb-prof-name");
  const sbSub = document.querySelector(".sb-prof-sub");
  const sbAv = document.querySelector(".sb-prof-av");
  const topAv = document.querySelector(".profile-avatar-btn");

  if (sbName) sbName.textContent = _me?.name || "You";
  if (sbSub) sbSub.textContent = _me?.handle ? `@${_me.handle}` : "";
  if (_me?.avatar) {
    [sbAv, topAv].forEach((el) => {
      if (!el) return;
      el.style.backgroundImage = `url(${_me.avatar})`;
      el.style.backgroundSize = "cover";
      el.style.backgroundPosition = "center";
    });
  }

  // Wire nav items to pages
  const NAV_ROUTES = {
    Home: "../index.html",
    Explore: "explore.html",
    Notifications: "dashboard.html",
    Messages: "chat.html",
    Profile: "profile.html",
    Settings: "settings.html",
  };
  document.querySelectorAll(".nav-item").forEach((el) => {
    const label = el.querySelector(".nav-label")?.textContent?.trim();
    if (label && NAV_ROUTES[label] && label !== "Settings") {
      el.style.cursor = "pointer";
      el.addEventListener(
        "click",
        () => (window.location.href = NAV_ROUTES[label]),
      );
    }
  });

  // Wire Distress Call button
  document.querySelector(".distress-btn")?.addEventListener("click", () => {
    window.location.href = "create-post.html";
  });

  // Wire profile avatar button
  document
    .querySelector(".profile-avatar-btn")
    ?.addEventListener("click", () => {
      window.location.href = "profile.html";
    });
});
