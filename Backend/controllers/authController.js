// const bcrypt = require("bcryptjs");
// const User = require("../models/User");
// const jwt = require("jsonwebtoken");

// // ================= REGISTER CONTROLLER =================
// exports.registerUser = async (req, res) => {
//   try {
//     const { name, email, password } = req.body;

//     // 1️⃣ Validate Inputs
//     if (!name || !email || !password) {
//       return res.status(400).json({
//         message: "All fields are required",
//       });
//     }

//     if (password.length < 6) {
//       return res.status(400).json({
//         message: "Password must be at least 6 characters",
//       });
//     }

//     // 2️⃣ Check Existing User
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({
//         message: "Email already registered",
//       });
//     }

//     // 3️⃣ Hash Password
//     const hashedPassword = await bcrypt.hash(password, 10);

//     // 4️⃣ Save User
//     const user = await User.create({
//       name,
//       email,
//       password: hashedPassword,
//     });

//     // 5️⃣ Return Success
//     res.status(201).json({
//       message: "User registered successfully",
//     });
//   } catch (error) {
//     console.error("Register Error:", error);
//     res.status(500).json({
//       message: "Server error",
//     });
//   }
// };

// // ================= LOGIN CONTROLLER =================
// exports.loginUser = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // 1️⃣ Validate Inputs
//     if (!email || !password) {
//       return res.status(400).json({
//         message: "Email and password are required",
//       });
//     }

//     // 2️⃣ Check if User Exists
//     const user = await User.findOne({ email }).select("+password");

//     if (!user) {
//       return res.status(400).json({
//         message: "Invalid credentials",
//       });
//     }

//     // 3️⃣ Compare Password
//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       return res.status(400).json({
//         message: "Invalid credentials",
//       });
//     }

//     // 4️⃣ Generate JWT
//     const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
//       expiresIn: process.env.JWT_EXPIRES,
//     });

//     // 5️⃣ Return Token
//     res.status(200).json({
//       message: "Login successful",
//       token,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//       },
//     });
//   } catch (error) {
//     console.error("Login Error:", error);
//     res.status(500).json({
//       message: "Server error",
//     });
//   }
// };
// Backend/controllers/authController.js
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const User = require("../models/User");

// /* ─── helpers ─────────────────────────────────────────── */

// function signToken(userId, rememberMe = false) {
//   return jwt.sign({ userId }, process.env.JWT_SECRET, {
//     expiresIn: rememberMe ? "30d" : process.env.JWT_EXPIRES || "7d",
//   });
// }

// /* ─────────────────────────────────────────────────────────
//    POST /api/auth/register
// ───────────────────────────────────────────────────────── */
// // exports.registerUser = async (req, res) => {
// //   try {
// //     const { name, email, password } = req.body;

// //     if (!name || !email || !password) {
// //       return res.status(400).json({ message: "All fields are required" });
// //     }
// //     if (password.length < 6) {
// //       return res
// //         .status(400)
// //         .json({ message: "Password must be at least 6 characters" });
// //     }

// //     const existing = await User.findOne({ email: email.toLowerCase().trim() });
// //     if (existing) {
// //       return res.status(400).json({ message: "Email already registered" });
// //     }

// //     const hashedPassword = await bcrypt.hash(password, 10);
// //     const handle = "@" + name.toLowerCase().replace(/\s+/g, "");

// //     await User.create({ name, email, password: hashedPassword, handle });

// //     return res.status(201).json({ message: "Account created successfully" });
// //   } catch (err) {
// //     console.error("[registerUser]", err);
// //     return res.status(500).json({ message: "Server error" });
// //   }
// // };

// /* ─────────────────────────────────────────────────────────
//    POST /api/auth/login
//    Body: { email, password, rememberMe?, mode? }
//    mode = "admin" → enforces role === "admin"
// ───────────────────────────────────────────────────────── */
// exports.loginUser = async (req, res) => {
//   try {
//     const { email, password, rememberMe = false, mode = "member" } = req.body;

//     if (!email || !password) {
//       return res
//         .status(400)
//         .json({ message: "Email and password are required" });
//     }

//     const user = await User.findOne({
//       email: email.toLowerCase().trim(),
//     }).select("+password");

//     if (!user) {
//       return res.status(401).json({ message: "Invalid credentials" });
//     }

//     // Admin tab: reject non-admin accounts
//     if (mode === "admin" && user.role !== "admin") {
//       return res
//         .status(403)
//         .json({ message: "Access denied — admin accounts only" });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: "Invalid credentials" });
//     }

//     if (!user.isActive) {
//       return res
//         .status(403)
//         .json({ message: "Account suspended — contact support" });
//     }

//     const token = signToken(user._id, rememberMe);

//     return res.status(200).json({
//       message: "Login successful",
//       token,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         handle: user.handle,
//         avatar: user.avatar,
//         role: user.role,
//       },
//     });
//   } catch (err) {
//     console.error("[loginUser]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    POST /api/auth/forgot-password
//    Body: { email }
//    In production: generate token, email reset link.
//    Here: we confirm the email exists without leaking info.
// ───────────────────────────────────────────────────────── */
// exports.forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ message: "Email is required" });

//     // We intentionally return the same response whether the email exists
//     // or not — prevents user enumeration attacks
//     await User.findOne({ email: email.toLowerCase().trim() });
//     // TODO: generate resetToken, set resetExpires, send email via nodemailer

//     return res.status(200).json({
//       message:
//         "If an account exists for that email, a reset link will be sent.",
//     });
//   } catch (err) {
//     console.error("[forgotPassword]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/auth/me
//    Returns current user from token (used to restore session)
// ───────────────────────────────────────────────────────── */
// exports.getMe = async (req, res) => {
//   try {
//     // req.user is set by authMiddleware
//     const user = await User.findById(req.user.userId).select("-password");
//     if (!user) return res.status(404).json({ message: "User not found" });

//     return res.status(200).json({ user });
//   } catch (err) {
//     console.error("[getMe]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// /* ===========================
//    REGISTER USER
// =========================== */
// exports.registerUser = async (req, res) => {
//   try {
//     const {
//       firstName,
//       lastName,
//       username,
//       email,
//       password,
//       businessType,
//       skills,
//       experience,
//       location,
//       role,
//     } = req.body;

//     if (!firstName || !lastName || !username || !email || !password) {
//       return res.status(400).json({ message: "All required fields missing" });
//     }

//     const existingUser = await User.findOne({
//       $or: [{ email }, { username }],
//     });

//     if (existingUser) {
//       return res
//         .status(400)
//         .json({ message: "Email or username already exists" });
//     }

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const newUser = await User.create({
//       firstName,
//       lastName,
//       username,
//       email,
//       password: hashedPassword,
//       businessType,
//       skills,
//       experience,
//       location,
//       role,
//     });

//     res.status(201).json({
//       message: "User registered successfully",
//       userId: newUser._id,
//     });
//   } catch (error) {
//     console.error("Register Error:", error);
//     res.status(500).json({ message: "Server error" });
//   }
// };

// /* ===========================
//    GET ALL USERS
// =========================== */
// exports.getUsers = async (req, res) => {
//   try {
//     const users = await User.find().select("-password");
//     res.status(200).json(users);
//   } catch (error) {
//     res.status(500).json({ message: "Server error" });
//   }
// };

// Backend/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* ── Helper ──────────────────────────────────────────────── */
function signToken(userId, rememberMe = false) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: rememberMe ? "30d" : process.env.JWT_EXPIRES || "7d",
  });
}

/* ─────────────────────────────────────────────────────────
   POST /api/auth/register
   Body: { firstName, lastName, username, email, password,
           businessType?, skills?, experience?, location?, communityRole? }
   Called from register.js → completeRegistration() after Step 3
───────────────────────────────────────────────────────── */
exports.registerUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      username,
      email,
      password,
      businessType,
      skills,
      experience,
      location,
      communityRole, // ✅ renamed from "role" to match User.js field
    } = req.body;

    // ── Validation ────────────────────────────────────────
    if (!firstName || !lastName || !username || !email || !password) {
      return res
        .status(400)
        .json({ message: "All required fields are missing" });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }

    // ── Uniqueness check ──────────────────────────────────
    const existing = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { username: username.trim() },
      ],
    });

    if (existing) {
      const field =
        existing.email === email.toLowerCase().trim() ? "Email" : "Username";
      return res
        .status(400)
        .json({ message: `${field} is already registered` });
    }

    // ── Create user ───────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);
    const handle = "@" + username.toLowerCase().replace(/\s+/g, "");

    const newUser = await User.create({
      firstName,
      lastName,
      username: username.trim(),
      handle,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      businessType: businessType || null,
      skills: Array.isArray(skills) ? skills : [],
      experience: experience || 0,
      location: location || "",
      communityRole: communityRole || "both",
    });

    // ── Auto sign-in after registration ──────────────────
    const token = signToken(newUser._id);

    return res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        name: newUser.fullName, // virtual: "First Last"
        username: newUser.username,
        handle: newUser.handle, // ✅ now always populated
        email: newUser.email,
        communityRole: newUser.communityRole,
        role: newUser.role, // "user" by default
      },
    });
  } catch (err) {
    console.error("[registerUser]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/auth/login
   Body: { email, password, rememberMe?, mode? }
   mode = "admin" → enforces role === "admin"
───────────────────────────────────────────────────────── */
exports.loginUser = async (req, res) => {
  try {
    const { email, password, rememberMe = false, mode = "member" } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (mode === "admin" && user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied — admin accounts only" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: "Account suspended — contact support" });
    }

    const token = signToken(user._id, rememberMe);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        // ✅ fullName virtual works because toObject() is not called here
        //    — but virtuals need { virtuals: true } on toObject.
        //    Safest: construct name from stored fields.
        name: `${user.firstName} ${user.lastName}`.trim(),
        handle: user.handle, // ✅ always set during registration
        avatar: user.avatar,
        email: user.email,
        role: user.role, // "user" | "admin" | "moderator"
        communityRole: user.communityRole, // "seeker" | "helper" | "both"
      },
    });
  } catch (err) {
    console.error("[loginUser]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   POST /api/auth/forgot-password
───────────────────────────────────────────────────────── */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    // Same response whether email exists or not — prevents user enumeration
    await User.findOne({ email: email.toLowerCase().trim() });
    // TODO: generate resetPasswordToken, save resetPasswordExpires, send via nodemailer

    return res.status(200).json({
      message:
        "If an account exists for that email, a reset link will be sent.",
    });
  } catch (err) {
    console.error("[forgotPassword]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/auth/me
   Returns the current user from their token
───────────────────────────────────────────────────────── */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ user });
  } catch (err) {
    console.error("[getMe]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/* ─────────────────────────────────────────────────────────
   GET /api/auth/check-username?username=xxx
   Called live as the user types in register Step 1.
   Returns { available: true|false }
───────────────────────────────────────────────────────── */
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.length < 3) {
      return res.status(400).json({ message: "Username too short" });
    }
    const exists = await User.findOne({
      username: username.trim().toLowerCase(),
    }).lean();
    return res.status(200).json({ available: !exists });
  } catch (err) {
    console.error("[checkUsername]", err);
    return res.status(500).json({ message: "Server error" });
  }
};
