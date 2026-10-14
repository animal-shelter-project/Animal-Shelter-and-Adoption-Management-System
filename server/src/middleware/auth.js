const AuthService = require("../services/AuthService");
const User = require("../models/User");

// Requires "Authorization: Bearer <token>". On success sets
// req.user = { id, email, role }. Every failure is a 401 with a clear message.
function requireAuth(req, res, next) {
  const header = req.get("Authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Please log in to continue." });
  }

  let payload;
  try {
    payload = AuthService.verifyToken(token);
  } catch (error) {
    const message =
      error.name === "TokenExpiredError"
        ? "Your session expired. Please log in again."
        : "Invalid login token. Please log in again.";
    return res.status(401).json({ error: message });
  }

  // The account may have been deleted or re-seeded since the token was issued.
  const user = User.findById(payload.id);
  if (!user) {
    return res.status(401).json({ error: "This account no longer exists. Please log in again." });
  }

  req.user = user;
  return next();
}

// Use after requireAuth: requireRole("Staff") or requireRole("Staff", "Adopter").
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Please log in to continue." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission to do that." });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
