const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const HttpError = require("../utils/HttpError");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config");

const INVALID = "Invalid email or password.";

// Compared against when the email doesn't exist, so a wrong email and a
// wrong password take about the same time (no account-guessing by timing).
let dummyHash = null;
const getDummyHash = () => {
  if (!dummyHash) dummyHash = bcrypt.hashSync("no-such-user-password", 10);
  return dummyHash;
};

class AuthService {
  // US-05. Returns { token, user } or throws 401 with one generic message.
  static async login(email, password) {
    const user = User.findByEmail(email.trim());
    const matches = await bcrypt.compare(password, user ? user.password_hash : getDummyHash());
    if (!user || !matches) throw new HttpError(401, INVALID);
    return { token: AuthService.issueToken(user), user: User.toPublic(user) };
  }

  // Token holds the user's id and role, as the plan specifies.
  static issueToken(user) {
    return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  }

  // Returns the payload or throws (TokenExpiredError / JsonWebTokenError).
  static verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }
}

module.exports = AuthService;
