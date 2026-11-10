const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const HttpError = require("../utils/HttpError");
const LoginThrottle = require("./LoginThrottle");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config");

const INVALID = "Invalid email or password.";
const BCRYPT_COST = 10;

// Compared against when the email doesn't exist, so a wrong email and a
// wrong password take about the same time (no account-guessing by timing).
let dummyHash = null;
const getDummyHash = () => {
  if (!dummyHash) dummyHash = bcrypt.hashSync("no-such-user-password", 10);
  return dummyHash;
};

class AuthService {
  // US-05. Returns { token, user } or throws 401 with one generic message.
  // 429 after too many wrong passwords (see LoginThrottle).
  static async login(email, password, ip) {
    const minutes = LoginThrottle.check(email, ip);
    if (minutes) {
      throw new HttpError(
        429,
        `Too many failed attempts. Please wait ${minutes} minute${minutes === 1 ? "" : "s"} and try again, or ask shelter staff to reset your password.`,
      );
    }
    const user = User.findByEmail(email.trim());
    const matches = await bcrypt.compare(password, user ? user.password_hash : getDummyHash());
    if (!user || !matches) {
      LoginThrottle.fail(email, ip);
      throw new HttpError(401, INVALID);
    }
    LoginThrottle.succeed(email, ip);
    return AuthService.session(user);
  }

  // Sign-up: always an Adopter account. 409 if the email is taken.
  static async register({ email, password, name, phone, address }) {
    if (User.findByEmail(email)) {
      throw new HttpError(409, "An account with this email already exists. Log in instead.", {
        fields: { email: "This email already has an account." },
      });
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = User.create({ email, passwordHash, role: "Adopter", name, phone, address });
    return AuthService.session(user);
  }

  // Change your own password; returns a fresh session (other sessions end).
  static async changePassword(userId, currentPassword, newPassword) {
    const user = User.findWithHash(userId);
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw new HttpError(400, "Your current password is not correct.", {
        fields: { currentPassword: "This is not your current password." },
      });
    }
    const updated = User.setPassword(userId, await bcrypt.hash(newPassword, BCRYPT_COST));
    return AuthService.session(updated);
  }

  // Staff reset: a random temporary password, shown once to the staff member.
  static async resetPassword(userId) {
    const temporaryPassword = `paws-${crypto.randomBytes(4).toString("hex")}`;
    User.setPassword(userId, await bcrypt.hash(temporaryPassword, BCRYPT_COST));
    return temporaryPassword;
  }

  static session(user) {
    return { token: AuthService.issueToken(user), user: User.toPublic(user) };
  }

  // Token holds the user's id and role, as the plan specifies, plus the
  // password version (tv) so a password change ends older sessions.
  static issueToken(user) {
    return jwt.sign({ id: user.id, role: user.role, tv: user.token_version ?? 0 }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  }

  // Returns the payload or throws (TokenExpiredError / JsonWebTokenError).
  static verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
  }
}

module.exports = AuthService;
