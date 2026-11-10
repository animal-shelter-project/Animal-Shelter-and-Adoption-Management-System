const Notification = require("../models/Notification");

class NotificationController {
  // GET /api/notifications -> { unread, items: [{ id, message, link, createdAt, read }] }
  static list(req, res) {
    res.json(Notification.forUser(req.user.id));
  }

  // POST /api/notifications/read -> marks all as read; { unread: 0, items }
  static readAll(req, res) {
    Notification.markAllRead(req.user.id);
    res.json(Notification.forUser(req.user.id));
  }
}

module.exports = NotificationController;
