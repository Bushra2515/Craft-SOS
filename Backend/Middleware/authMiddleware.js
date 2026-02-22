const jwt = require("jsonwebtoken");

const protect = (req, res, next) => {
  try {
    let token;

    // 1️⃣ Check Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 2️⃣ If no token
    if (!token) {
      return res.status(401).json({
        message: "Not authorized, token missing",
      });
    }

    // // 3️⃣ Verify token
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // // 4️⃣ Attach userId to request
    // req.user = { userId: decoded.userId };

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // ✅ Set BOTH so every controller works regardless of which style it uses:
    //    dashboardController  →  req.user.userId
    //    postController       →  req.userId
    req.user = decoded;
    req.userId = decoded.userId;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Not authorized, token invalid",
    });
  }
};

module.exports = protect;
