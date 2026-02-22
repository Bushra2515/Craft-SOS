// // const express = require("express");
// // const mongoose = require("mongoose");
// // const cors = require("cors");
// // require("dotenv").config();

// // const app = express();

// // // Middleware
// // app.use(cors());
// // app.use(express.json());

// // const path = require("path");

// // app.use(express.static(path.join(__dirname, "../Frontend/pages")));

// // const authRoutes = require("./routes/authRoutes");
// // const userRoutes = require("./routes/userRoutes");
// // const postRoutes = require("./routes/postRoutes");
// // app.use("/api/posts", postRoutes);
// // app.use("/api/users", userRoutes);
// // app.use("/api/auth", authRoutes);

// // // MongoDB Connection
// // mongoose
// //   .connect(process.env.MONGO_URI)
// //   .then(() => console.log("MongoDB Connected"))
// //   .catch((err) => console.log(err));

// // // // Test Route
// // // app.get("/", (req, res) => {
// // //   res.send("CraftSOS API is running...");
// // // });

// // app.get("/", (req, res) => {
// //   res.sendFile(path.join(__dirname, "../Frontend/pages/login.html"));
// // });

// // // Start Server
// // const PORT = process.env.PORT || 5000;
// // app.listen(PORT, () => {
// //   console.log(`Server running on port ${PORT}`);
// // });
// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// require("dotenv").config();
// const path = require("path");

// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());

// /* 🔥 1️⃣ Root should open login first */

// app.use(express.static(path.join(__dirname, "../Frontend/pages")));
// app.use(express.static(path.join(__dirname, "../Frontend")));

// // app.get("/", (req, res) => {
// //   res.sendFile(path.join(__dirname, "../Frontend/pages/login.html"));
// // });

// const authRoutes = require("./routes/authRoutes");
// const userRoutes = require("./routes/userRoutes");
// const postRoutes = require("./routes/postRoutes");

// app.use("/api/posts", postRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/auth", authRoutes);

// // // MongoDB
// // mongoose
// //   .connect(process.env.MONGO_URI)
// //   .then(() => console.log("MongoDB Connected"))
// //   .catch((err) => console.log(err));

// mongoose
//   .connect(process.env.MONGO_URI)
//   .then(() => console.log("✅ MongoDB Connected"))
//   .catch((err) => {
//     console.error("❌ MongoDB connection failed:", err.message);
//     process.exit(1); // Stop server so you see the error clearly
//   });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

// Backend/server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

/* ─── Middleware ──────────────────────────────── */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ─── Static frontend ─────────────────────────── */
// app.use(express.static(path.join(__dirname, "../Frontend/pages")));
app.use(express.static(path.join(__dirname, "../Frontend")));

/* ─── Routes ──────────────────────────────────── */
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const exploreRoutes = require("./routes/exploreRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/explore", exploreRoutes);

/* ─── Root → login page ───────────────────────── */
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "../Frontend/pages/login.html"));
// });

/* ─── Global error handler ────────────────────── */
app.use((err, req, res, next) => {
  console.error("[Unhandled Error]", err);
  res.status(500).json({ message: "Something went wrong" });
});

/* ─── MongoDB + Start ─────────────────────────── */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });
