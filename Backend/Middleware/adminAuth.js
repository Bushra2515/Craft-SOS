// JWT guard for all /api/admin/* routes.
// Token payload must include: { id, handle, role }
// role must be "admin" or "moderator"
// adminAuth.js
const jwt = require("jsonwebtoken");

const adminAuth = (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!["admin", "moderator"].includes(payload.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    // Attach to req so every controller can log actions
    req.admin = { id: payload.id, handle: payload.handle, role: payload.role };
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.admin?.role)) {
      return res.status(403).json({
        success: false,
        message: `Requires role: ${roles.join(" or ")}`,
      });
    }
    next();
  };

module.exports = { adminAuth, requireRole };
