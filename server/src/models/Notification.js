const db = require("../db");

// v2: in-app messages for a user, e.g. "Your application for Buddy was
// approved". There is no email service, so this is how adopters hear back.
class Notification {
  static add(userId, message, link = null) {
    db.prepare("INSERT INTO notifications (user_id, message, link) VALUES (?, ?, ?)").run(userId, message, link);
  }

  // Newest first, up to 50, plus how many are unread.
  static forUser(userId) {
    const items = db
      .prepare(
        `SELECT id, message, link, created_at AS createdAt, read_at IS NOT NULL AS isRead
           FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50`,
      )
      .all(userId)
      .map(({ isRead, ...n }) => ({ ...n, read: Boolean(isRead) }));
    return { unread: Notification.unreadCount(userId), items };
  }

  static unreadCount(userId) {
    return db
      .prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL")
      .get(userId).n;
  }

  static markAllRead(userId) {
    db.prepare("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL").run(userId);
  }
}

module.exports = Notification;
