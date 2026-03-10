// // // const express = require("express");
// // // const mongoose = require("mongoose");
// // // const cors = require("cors");
// // // require("dotenv").config();

// // // const app = express();

// // // // Middleware
// // // app.use(cors());
// // // app.use(express.json());

// // // const path = require("path");

// // // app.use(express.static(path.join(__dirname, "../Frontend/pages")));

// // // const authRoutes = require("./routes/authRoutes");
// // // const userRoutes = require("./routes/userRoutes");
// // // const postRoutes = require("./routes/postRoutes");
// // // app.use("/api/posts", postRoutes);
// // // app.use("/api/users", userRoutes);
// // // app.use("/api/auth", authRoutes);

// // // // MongoDB Connection
// // // mongoose
// // //   .connect(process.env.MONGO_URI)
// // //   .then(() => console.log("MongoDB Connected"))
// // //   .catch((err) => console.log(err));

// // // // // Test Route
// // // // app.get("/", (req, res) => {
// // // //   res.send("CraftSOS API is running...");
// // // // });

// // // app.get("/", (req, res) => {
// // //   res.sendFile(path.join(__dirname, "../Frontend/pages/login.html"));
// // // });

// // // // Start Server
// // // const PORT = process.env.PORT || 5000;
// // // app.listen(PORT, () => {
// // //   console.log(`Server running on port ${PORT}`);
// // // });
// // const express = require("express");
// // const mongoose = require("mongoose");
// // const cors = require("cors");
// // require("dotenv").config();
// // const path = require("path");

// // const app = express();

// // // Middleware
// // app.use(cors());
// // app.use(express.json());

// // /* 🔥 1️⃣ Root should open login first */

// // app.use(express.static(path.join(__dirname, "../Frontend/pages")));
// // app.use(express.static(path.join(__dirname, "../Frontend")));

// // // app.get("/", (req, res) => {
// // //   res.sendFile(path.join(__dirname, "../Frontend/pages/login.html"));
// // // });

// // const authRoutes = require("./routes/authRoutes");
// // const userRoutes = require("./routes/userRoutes");
// // const postRoutes = require("./routes/postRoutes");

// // app.use("/api/posts", postRoutes);
// // app.use("/api/users", userRoutes);
// // app.use("/api/auth", authRoutes);

// // // // MongoDB
// // // mongoose
// // //   .connect(process.env.MONGO_URI)
// // //   .then(() => console.log("MongoDB Connected"))
// // //   .catch((err) => console.log(err));

// // mongoose
// //   .connect(process.env.MONGO_URI)
// //   .then(() => console.log("✅ MongoDB Connected"))
// //   .catch((err) => {
// //     console.error("❌ MongoDB connection failed:", err.message);
// //     process.exit(1); // Stop server so you see the error clearly
// //   });

// // const PORT = process.env.PORT || 5000;
// // app.listen(PORT, () => {
// //   console.log(`Server running on port ${PORT}`);
// // });

// // Backend/server.js
// const express = require("express");
// const http = require("http"); // ← NEW
// const { Server } = require("socket.io"); // ← NEW
// const mongoose = require("mongoose");
// const cors = require("cors");
// const path = require("path");
// require("dotenv").config();

// const app = express();

// /* ─── Middleware ──────────────────────────────── */
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));

// /* ─── Static frontend ─────────────────────────── */
// // app.use(express.static(path.join(__dirname, "../Frontend/pages")));
// app.use(express.static(path.join(__dirname, "../Frontend")));

// // ── Serve uploaded files as static assets ─────────────────
// // Images saved by Multer are accessible at:
// //   http://localhost:5000/uploads/avatars/filename.jpg
// //   http://localhost:5000/uploads/banners/filename.jpg
// //   http://localhost:5000/uploads/posts/filename.jpg
// app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // ← NEW

// /* ─── Routes ──────────────────────────────────── */
// const authRoutes = require("./routes/authRoutes");
// const userRoutes = require("./routes/userRoutes");
// const postRoutes = require("./routes/postRoutes");
// const dashboardRoutes = require("./routes/dashboardRoutes");
// const exploreRoutes = require("./routes/exploreRoutes");
// const postDetailRoutes = require("./routes/postDetailRoutes");
// const profileRoutes = require("./routes/profileRoutes");
// const uploadRoutes = require("./routes/uploadRoutes"); // ← NEW
// const chatRoutes = require("./routes/chatRoutes"); // ← NEW

// app.use("/api/profile", profileRoutes);
// app.use("/api/upload", uploadRoutes); // ← NEW
// app.use("/api/chat", chatRoutes); // ← NEW
// app.use("/api/auth", authRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/posts", postRoutes);
// app.use("/api/dashboard", dashboardRoutes);
// app.use("/api/explore", exploreRoutes);
// app.use("/api/post-detail", postDetailRoutes);

// // ── Socket manager ─────────────────────────────────────────
// const { initSocket } = require("./socket/socketManager"); // ← NEW

// /* ─── Root → login page ───────────────────────── */
// // app.get("/", (req, res) => {
// //   res.sendFile(path.join(__dirname, "../Frontend/pages/login.html"));
// // });

// /* ─── Global error handler ────────────────────── */
// app.use((err, req, res, next) => {
//   console.error("[Unhandled Error]", err);
//   res.status(500).json({ message: "Something went wrong" });
// });

// // ── Create HTTP server (required for socket.io) ───────────
// const httpServer = http.createServer(app); // ← NEW

// // ── Attach socket.io ──────────────────────────────────────
// const io = new Server(httpServer, {
//   // ← NEW
//   cors: {
//     origin: process.env.CLIENT_ORIGIN || "*",
//     methods: ["GET", "POST"],
//   },
//   // Send ping every 25s, disconnect after 60s without pong
//   pingInterval: 25000,
//   pingTimeout: 60000,
// });

// // ── Share io with controllers via app ─────────────────────
// // Usage in any controller: const io = req.app.get("io");
// app.set("io", io); // ← NEW

// // ── Register all socket event handlers ───────────────────
// initSocket(io); // ← NEW

// /* ─── MongoDB + Start ─────────────────────────── */
// mongoose
//   .connect(process.env.MONGO_URI)
//   .then(() => {
//     console.log("✅ MongoDB connected");
//     const PORT = process.env.PORT || 5000;
//     app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
//   })
//   .catch((err) => {
//     console.error("❌ MongoDB connection failed:", err.message);
//     process.exit(1);
//   });

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

/* ─── Middleware ──────────────────────────────── */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ─── Static ──────────────────────────────────── */
app.use(express.static(path.join(__dirname, "../Frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const exploreRoutes = require("./routes/exploreRoutes");
const postDetailRoutes = require("./routes/postDetailRoutes");
const profileRoutes = require("./routes/profileRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const chatRoutes = require("./routes/chatRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const crafterProfileRoutes = require("./routes/crafterProfileRoutes");
const indexRoutes = require("./routes/indexRoutes");
const challengeRoutes = require("./routes/challengeRoutes");
// ── Admin API (add after your existing routes) ─────────
const adminRoutes = require("./routes/adminRoutes");
const communityRoutes = require("./routes/communityRoutes");
const reportRoutes = require("./routes/reportRoutes");
app.use("/api/reports", reportRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/explore", exploreRoutes);
app.use("/api/post-detail", postDetailRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/crafter", crafterProfileRoutes);
app.use("/api/index", indexRoutes);

/* ─── Global error handler ────────────────────── */
app.use((err, _req, res, _next) => {
  console.error("[Unhandled Error]", err);
  res.status(500).json({ message: "Something went wrong" });
});

/* ─── HTTP server + Socket.io ─────────────────── */
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

app.set("io", io);

const { initSocket } = require("./socket/socketManager");
initSocket(io);

/* ─── MongoDB + Start ─────────────────────────── */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () =>
      // ✅ httpServer, not app
      console.log(`🚀 Server running on port ${PORT}`),
    );
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
