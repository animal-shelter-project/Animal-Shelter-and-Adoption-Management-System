const AuthService = require("../services/AuthService");
const HttpError = require("../utils/HttpError");

class AuthController {
  // POST /api/auth/login { email, password }   (US-05)
  // 200 { token, user: { id, email, role } } | 400 missing fields | 401 wrong login
  static async login(req, res) {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      throw new HttpError(400, "Email and password are required.");
    }
    if (email.length > 254 || password.length > 1024) {
      throw new HttpError(400, "Email or password is too long.");
    }
    res.json(await AuthService.login(email, password));
  }
}

module.exports = AuthController;
