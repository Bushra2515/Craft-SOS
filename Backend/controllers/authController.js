// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const User = require("../models/User");

// /* ── Helper ──────────────────────────────────────────────── */
// function signToken(userId, rememberMe = false) {
//   return jwt.sign({ userId }, process.env.JWT_SECRET, {
//     expiresIn: rememberMe ? "30d" : process.env.JWT_EXPIRES || "7d",
//   });
// }

// /* ─────────────────────────────────────────────────────────
//    POST /api/auth/register
//    Body: { firstName, lastName, username, email, password,
//            businessType?, skills?, experience?, location?, communityRole? }
//    Called from register.js → completeRegistration() after Step 3
// ───────────────────────────────────────────────────────── */
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
//       communityRole, // ✅ renamed from "role" to match User.js field
//     } = req.body;

//     // ── Validation ────────────────────────────────────────
//     if (!firstName || !lastName || !username || !email || !password) {
//       return res
//         .status(400)
//         .json({ message: "All required fields are missing" });
//     }
//     if (password.length < 8) {
//       return res
//         .status(400)
//         .json({ message: "Password must be at least 8 characters" });
//     }

//     // ── Uniqueness check ──────────────────────────────────
//     const existing = await User.findOne({
//       $or: [
//         { email: email.toLowerCase().trim() },
//         { username: username.trim() },
//       ],
//     });

//     if (existing) {
//       const field =
//         existing.email === email.toLowerCase().trim() ? "Email" : "Username";
//       return res
//         .status(400)
//         .json({ message: `${field} is already registered` });
//     }

//     // ── Create user ───────────────────────────────────────
//     const hashedPassword = await bcrypt.hash(password, 10);
//     const handle = "@" + username.toLowerCase().replace(/\s+/g, "");

//     const newUser = await User.create({
//       firstName,
//       lastName,
//       username: username.trim(),
//       handle,
//       email: email.toLowerCase().trim(),
//       password: hashedPassword,
//       businessType: businessType || null,
//       skills: Array.isArray(skills) ? skills : [],
//       experience: experience || 0,
//       location: location || "",
//       communityRole: communityRole || "both",
//     });

//     // ── Auto sign-in after registration ──────────────────
//     const token = signToken(newUser._id);

//     return res.status(201).json({
//       message: "Account created successfully",
//       token,
//       user: {
//         id: newUser._id,
//         firstName: newUser.firstName,
//         lastName: newUser.lastName,
//         name: newUser.fullName, // virtual: "First Last"
//         username: newUser.username,
//         handle: newUser.handle, // ✅ now always populated
//         email: newUser.email,
//         communityRole: newUser.communityRole,
//         role: newUser.role, // "user" by default
//       },
//     });
//   } catch (err) {
//     console.error("[registerUser]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

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
//         // ✅ fullName virtual works because toObject() is not called here
//         //    — but virtuals need { virtuals: true } on toObject.
//         //    Safest: construct name from stored fields.
//         name: `${user.firstName} ${user.lastName}`.trim(),
//         handle: user.handle, // ✅ always set during registration
//         avatar: user.avatar,
//         email: user.email,
//         role: user.role, // "user" | "admin" | "moderator"
//         communityRole: user.communityRole, // "seeker" | "helper" | "both"
//       },
//     });
//   } catch (err) {
//     console.error("[loginUser]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    POST /api/auth/forgot-password
// ───────────────────────────────────────────────────────── */
// exports.forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ message: "Email is required" });

//     // Same response whether email exists or not — prevents user enumeration
//     await User.findOne({ email: email.toLowerCase().trim() });
//     // TODO: generate resetPasswordToken, save resetPasswordExpires, send via nodemailer

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
//    Returns the current user from their token
// ───────────────────────────────────────────────────────── */
// exports.getMe = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.userId).select("-password");
//     if (!user) return res.status(404).json({ message: "User not found" });
//     return res.status(200).json({ user });
//   } catch (err) {
//     console.error("[getMe]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/auth/check-username?username=xxx
//    Called live as the user types in register Step 1.
//    Returns { available: true|false }
// ───────────────────────────────────────────────────────── */
// exports.checkUsername = async (req, res) => {
//   try {
//     const { username } = req.query;
//     if (!username || username.length < 3) {
//       return res.status(400).json({ message: "Username too short" });
//     }
//     const exists = await User.findOne({
//       username: username.trim().toLowerCase(),
//     }).lean();
//     return res.status(200).json({ available: !exists });
//   } catch (err) {
//     console.error("[checkUsername]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };
// // Backend/controllers/authController.js
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const User = require("../models/User");

// /* ── Helper ──────────────────────────────────────────────── */
// function signToken(userId, rememberMe = false) {
//   return jwt.sign({ userId }, process.env.JWT_SECRET, {
//     expiresIn: rememberMe ? "30d" : process.env.JWT_EXPIRES || "7d",
//   });
// }

// /* ─────────────────────────────────────────────────────────
//    POST /api/auth/register
//    Body: { firstName, lastName, username, email, password,
//            businessType?, skills?, experience?, location?, communityRole? }
//    Called from register.js → completeRegistration() after Step 3
// ───────────────────────────────────────────────────────── */
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
//       communityRole, // ✅ renamed from "role" to match User.js field
//     } = req.body;

//     // ── Validation ────────────────────────────────────────
//     if (!firstName || !lastName || !username || !email || !password) {
//       return res
//         .status(400)
//         .json({ message: "All required fields are missing" });
//     }
//     if (password.length < 8) {
//       return res
//         .status(400)
//         .json({ message: "Password must be at least 8 characters" });
//     }

//     // ── Build handle from username ─────────────────────────
//     // Schema regex: ^[a-z0-9_]{3,30}$ — NO @ symbol allowed.
//     // Strip everything except letters, numbers, underscores; lowercase; trim to 30 chars.
//     const handle = username
//       .toLowerCase()
//       .replace(/[^a-z0-9_]/g, "") // remove @, spaces, hyphens, etc.
//       .slice(0, 30);

//     if (handle.length < 3) {
//       return res.status(400).json({
//         message:
//           "Username must contain at least 3 letters or numbers (a–z, 0–9, _)",
//       });
//     }

//     // ── Uniqueness check (email + handle) ─────────────────
//     const existing = await User.findOne({
//       $or: [{ email: email.toLowerCase().trim() }, { handle }],
//     }).lean();

//     if (existing) {
//       const field =
//         existing.email === email.toLowerCase().trim() ? "Email" : "Username";
//       return res
//         .status(400)
//         .json({ message: `${field} is already registered` });
//     }

//     // ── Create user ───────────────────────────────────────
//     // Do NOT pre-hash — the User pre-save hook hashes the password automatically.
//     const newUser = await User.create({
//       firstName: firstName.trim(),
//       lastName: lastName.trim(),
//       handle, // e.g. "crochet1234"
//       email: email.toLowerCase().trim(),
//       password, // plain-text — hook hashes it
//       businessType: businessType || "",
//       skills: Array.isArray(skills) ? skills : [],
//       experience: experience || 0,
//       location: location || "",
//       communityRole: communityRole || "both",
//       newsletterOptIn: !!req.body.newsletter,
//     });

//     // ── Auto sign-in after registration ──────────────────
//     const token = signToken(newUser._id);

//     return res.status(201).json({
//       message: "Account created successfully",
//       token,
//       user: {
//         id: newUser._id,
//         firstName: newUser.firstName,
//         lastName: newUser.lastName,
//         name: `${newUser.firstName} ${newUser.lastName}`.trim(),
//         handle: newUser.handle,
//         email: newUser.email,
//         avatar: newUser.avatar || "",
//         communityRole: newUser.communityRole,
//       },
//     });
//   } catch (err) {
//     console.error("[registerUser]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

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
//         // ✅ fullName virtual works because toObject() is not called here
//         //    — but virtuals need { virtuals: true } on toObject.
//         //    Safest: construct name from stored fields.
//         name: `${user.firstName} ${user.lastName}`.trim(),
//         handle: user.handle, // ✅ always set during registration
//         avatar: user.avatar,
//         email: user.email,
//         role: user.role, // "user" | "admin" | "moderator"
//         communityRole: user.communityRole, // "seeker" | "helper" | "both"
//       },
//     });
//   } catch (err) {
//     console.error("[loginUser]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    POST /api/auth/forgot-password
// ───────────────────────────────────────────────────────── */
// exports.forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;
//     if (!email) return res.status(400).json({ message: "Email is required" });

//     // Same response whether email exists or not — prevents user enumeration
//     await User.findOne({ email: email.toLowerCase().trim() });
//     // TODO: generate resetPasswordToken, save resetPasswordExpires, send via nodemailer

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
//    Returns the current user from their token
// ───────────────────────────────────────────────────────── */
// exports.getMe = async (req, res) => {
//   try {
//     const user = await User.findById(req.user.userId).select("-password");
//     if (!user) return res.status(404).json({ message: "User not found" });
//     return res.status(200).json({ user });
//   } catch (err) {
//     console.error("[getMe]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// /* ─────────────────────────────────────────────────────────
//    GET /api/auth/check-username?username=xxx
//    Called live as the user types in register Step 1.
//    Returns { available: true|false }
// ───────────────────────────────────────────────────────── */
// exports.checkUsername = async (req, res) => {
//   try {
//     const { username } = req.query;
//     if (!username || username.length < 3) {
//       return res.status(400).json({ message: "Username too short" });
//     }
//     const exists = await User.findOne({
//       username: username.trim().toLowerCase(),
//     }).lean();
//     return res.status(200).json({ available: !exists });
//   } catch (err) {
//     console.error("[checkUsername]", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };
// Backend/controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* ── Helper ──────────────────────────────────────────────── */
// function signToken(userId, rememberMe = false) {
//   return jwt.sign({ userId }, process.env.JWT_SECRET, {
//     expiresIn: rememberMe ? "30d" : process.env.JWT_EXPIRES || "7d",
//   });
// }
function signToken(user, rememberMe = false) {
  return jwt.sign(
    { userId: user._id, id: user._id, handle: user.handle, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: rememberMe ? "30d" : process.env.JWT_EXPIRES || "7d" },
  );
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

    // ── Build handle from username ─────────────────────────
    // Schema regex: ^[a-z0-9_]{3,30}$ — NO @ symbol allowed.
    // Strip everything except letters, numbers, underscores; lowercase; trim to 30 chars.
    const handle = username
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "") // remove @, spaces, hyphens, etc.
      .slice(0, 30);

    if (handle.length < 3) {
      return res.status(400).json({
        message:
          "Username must contain at least 3 letters or numbers (a–z, 0–9, _)",
      });
    }

    // ── Uniqueness check (email + handle) ─────────────────
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase().trim() }, { handle }],
    }).lean();

    if (existing) {
      const field =
        existing.email === email.toLowerCase().trim() ? "Email" : "Username";
      return res
        .status(400)
        .json({ message: `${field} is already registered` });
    }

    // ── Create user ───────────────────────────────────────
    // Do NOT pre-hash — the User pre-save hook hashes the password automatically.
    const newUser = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      handle, // e.g. "crochet1234"
      email: email.toLowerCase().trim(),
      password, // plain-text — hook hashes it
      businessType: businessType || "",
      skills: Array.isArray(skills) ? skills : [],
      experience: experience || 0,
      location: location || "",
      communityRole: communityRole || "both",
      newsletterOptIn: !!req.body.newsletter,
    });

    // ── Auto sign-in after registration ──────────────────
    // const token = signToken(newUser._id);
    const token = signToken(newUser);

    return res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: newUser._id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        name: `${newUser.firstName} ${newUser.lastName}`.trim(),
        handle: newUser.handle,
        email: newUser.email,
        avatar: newUser.avatar || "",
        communityRole: newUser.communityRole,
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

    // const token = signToken(user._id, rememberMe);
    const token = signToken(user, rememberMe);

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
    // User schema has no `username` field — derive handle the same way registerUser does
    const handle = username
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 30);
    if (handle.length < 3) {
      return res.status(400).json({ message: "Username too short" });
    }
    const exists = await User.findOne({ handle }).lean();
    return res.status(200).json({ available: !exists, handle });
  } catch (err) {
    console.error("[checkUsername]", err);
    return res.status(500).json({ message: "Server error" });
  }
};
