// Frontend/main.js
// Root entry point — linked from Frontend/index.html
// Decides where to send the user based on login state.

const token = localStorage.getItem("token");

if (token) {
  // Already logged in → go to the dashboard
  window.location.href = "pages/dashboard.html";
} else {
  // Not logged in → go to login
  window.location.href = "pages/login.html";
}
