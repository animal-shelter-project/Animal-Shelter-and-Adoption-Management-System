const db = require("../db");

// Foster / volunteer sign-ups and contact messages from the public site.
const toInquiry = (row) =>
  row && {
    id: row.id,
    kind: row.kind,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    details: JSON.parse(row.details || "{}"),
    status: row.status,
    createdAt: row.created_at,
  };

class Inquiry {
  static create({ kind, name, email, phone, message, details }) {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO inquiries (kind, name, email, phone, message, details) VALUES (?, ?, ?, ?, ?, ?)")
      .run(kind, name, email, phone, message, JSON.stringify(details));
    return Inquiry.findById(lastInsertRowid);
  }

  static findById(id) {
    return toInquiry(db.prepare("SELECT * FROM inquiries WHERE id = ?").get(id));
  }

  // Newest first; optional kind and status filters.
  static list({ kind, status } = {}) {
    const where = [];
    const params = [];
    if (kind) {
      where.push("kind = ?");
      params.push(kind);
    }
    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    const sql = `SELECT * FROM inquiries ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT 200`;
    return db.prepare(sql).all(...params).map(toInquiry);
  }

  static counts() {
    const rows = db.prepare("SELECT kind, COUNT(*) AS n FROM inquiries WHERE status = 'New' GROUP BY kind").all();
    const out = { Foster: 0, Volunteer: 0, Contact: 0 };
    for (const r of rows) out[r.kind] = r.n;
    return out;
  }

  static setStatus(id, status, staffId) {
    db.prepare("UPDATE inquiries SET status = ?, updated_by = ? WHERE id = ?").run(status, staffId, id);
    return Inquiry.findById(id);
  }
}

module.exports = Inquiry;
