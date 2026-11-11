const AuthService = require("../services/AuthService");
const User = require("../models/User");
const HttpError = require("../utils/HttpError");
const { parseId, optionalText } = require("../utils/validation");

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-.\s]{7,20}$/;
const MIN_PASSWORD = 8;

const fieldError = (field, message) => new HttpError(400, message, { fields: { [field]: message } });

function requireObject(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
  return body;
}

function text(value, field, { required = false, max = 120 } = {}) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string") throw fieldError(field, `${field} must be text.`);
  const t = value.trim().replace(/\s+/g, " ");
  if (required && !t) throw fieldError(field, `${field[0].toUpperCase()}${field.slice(1)} is required.`);
  if (t.length > max) throw fieldError(field, `${field} must be ${max} characters or fewer.`);
  return t;
}

function readProfile(body) {
  const name = text(body.name, "name", { required: true, max: 80 });
  const phone = text(body.phone, "phone", { required: true, max: 20 });
  if (!PHONE.test(phone) || phone.replace(/\D/g, "").length < 7) {
    throw fieldError("phone", "Enter a phone number with at least 7 digits.");
  }
  const address = text(body.address, "address", { max: 200 });
  return { name, phone, address };
}

function readNewPassword(value, field = "password") {
  if (typeof value !== "string" || value.length < MIN_PASSWORD) {
    throw fieldError(field, `Use at least ${MIN_PASSWORD} characters.`);
  }
  if (value.length > 128) throw fieldError(field, "Use 128 characters or fewer.");
  return value;
}

class AuthController {
  // POST /api/auth/login { email, password }   (US-05)
  // 200 { token, user } | 400 missing fields | 401 wrong login | 429 too many tries
  static async login(req, res) {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      throw new HttpError(400, "Email and password are required.");
    }
    if (email.length > 254 || password.length > 1024) {
      throw new HttpError(400, "Email or password is too long.");
    }
    res.json(await AuthService.login(email, password, req.ip || req.socket?.remoteAddress));
  }

  // POST /api/auth/register { email, password, name, phone, address? }
  // Creates an Adopter account and logs it in. 201 { token, user }.
  static async register(req, res) {
    const body = requireObject(req.body);
    const email = text(body.email, "email", { required: true, max: 254 }).toLowerCase();
    if (!EMAIL.test(email)) throw fieldError("email", "Enter a valid email address.");
    const password = readNewPassword(body.password);
    const profile = readProfile(body);
    res.status(201).json(await AuthService.register({ email, password, ...profile }));
  }

  // GET /api/auth/me -> the logged-in user's details.
  static me(req, res) {
    res.json(User.toPublic(req.user));
  }

  // PUT /api/auth/me { name, phone, address } -> updated details.
  static updateMe(req, res) {
    const profile = readProfile(requireObject(req.body));
    res.json(User.toPublic(User.updateProfile(req.user.id, profile)));
  }

  // PUT /api/auth/password { currentPassword, newPassword } -> fresh { token, user }.
  static async changePassword(req, res) {
    const body = requireObject(req.body);
    if (typeof body.currentPassword !== "string" || !body.currentPassword) {
      throw fieldError("currentPassword", "Enter your current password.");
    }
    const newPassword = readNewPassword(body.newPassword, "newPassword");
    if (newPassword === body.currentPassword) {
      throw fieldError("newPassword", "Choose a password different from the current one.");
    }
    res.json(await AuthService.changePassword(req.user.id, body.currentPassword, newPassword));
  }

  // POST /api/auth/refresh -> a new token for an active session, so staff
  // aren't logged out in the middle of their work.
  static refresh(req, res) {
    res.json(AuthService.session(req.user));
  }

  // GET /api/users?q=   (Staff) adopter accounts.
  static listAdopters(req, res) {
    res.json(User.listAdopters(optionalText(req.query.q, "q")));
  }

  // POST /api/users/:id/reset-password   (Staff) -> { temporaryPassword }
  // For an adopter who forgot their password; staff give it to them in person
  // or by phone, and the adopter changes it after logging in.
  static async resetPassword(req, res) {
    const id = parseId(req.params.id, "user id");
    const user = User.findById(id);
    if (!user) throw new HttpError(404, "Account not found.");
    if (user.role !== "Adopter") {
      throw new HttpError(403, "Staff passwords can't be reset here.");
    }
    const temporaryPassword = await AuthService.resetPassword(id);
    res.json({ user: User.toPublic(user), temporaryPassword });
  }
}

module.exports = AuthController;
