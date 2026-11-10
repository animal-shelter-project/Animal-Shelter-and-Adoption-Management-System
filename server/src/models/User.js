const db = require("../db");

const PUBLIC = "id, email, role, name, phone, address, token_version, created_at";

class User {
  // Includes password_hash: only AuthService should call this.
  static findByEmail(email) {
    return db
      .prepare(
        `SELECT id, email, password_hash, role, name, phone, address, token_version
         FROM users
         WHERE email = ? COLLATE NOCASE`,
      )
      .get(email);
  }

  static findById(id) {
    return db.prepare(`SELECT ${PUBLIC} FROM users WHERE id = ?`).get(id);
  }

  // Includes password_hash: only AuthService should call this.
  static findWithHash(id) {
    return db.prepare("SELECT id, password_hash, token_version FROM users WHERE id = ?").get(id);
  }

  static create({ email, passwordHash, role = "Adopter", name = "", phone = "", address = "" }) {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO users (email, password_hash, role, name, phone, address)
         VALUES (@email, @passwordHash, @role, @name, @phone, @address)`,
      )
      .run({ email, passwordHash, role, name, phone, address });
    return User.findById(Number(lastInsertRowid));
  }

  static updateProfile(id, { name, phone, address }) {
    db.prepare("UPDATE users SET name = @name, phone = @phone, address = @address WHERE id = @id").run({
      id,
      name,
      phone,
      address,
    });
    return User.findById(id);
  }

  // New password; every older login token for this account stops working.
  static setPassword(id, passwordHash) {
    db.prepare(
      "UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?",
    ).run(passwordHash, id);
    return User.findById(id);
  }

  // Staff: adopter accounts, optionally matching part of the name or email.
  static listAdopters(q) {
    const like = q ? `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    return db
      .prepare(
        `SELECT ${PUBLIC} FROM users
          WHERE role = 'Adopter'
            ${like ? "AND (name LIKE @like ESCAPE '\\' OR email LIKE @like ESCAPE '\\')" : ""}
          ORDER BY name COLLATE NOCASE, email COLLATE NOCASE`,
      )
      .all(like ? { like } : {})
      .map(User.toPublic);
  }

  // The only shape that ever leaves the server (never the hash).
  static toPublic(user) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name ?? "",
      phone: user.phone ?? "",
      address: user.address ?? "",
    };
  }
}

module.exports = User;
