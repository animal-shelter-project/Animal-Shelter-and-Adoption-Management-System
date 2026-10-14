const db = require("../db");

class User {
  // Includes password_hash: only AuthService should call this.
  static findByEmail(email) {
    return db
      .prepare(
        `SELECT id, email, password_hash, role
         FROM users
         WHERE email = ? COLLATE NOCASE`,
      )
      .get(email);
  }

  static findById(id) {
    return db.prepare("SELECT id, email, role FROM users WHERE id = ?").get(id);
  }

  // The only shape that ever leaves the server (never the hash).
  static toPublic(user) {
    return { id: user.id, email: user.email, role: user.role };
  }
}

module.exports = User;
