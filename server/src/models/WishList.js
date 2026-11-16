const db = require("../db");

// Wish-list items with how many have been pledged so far.
const ITEM_SQL = `
  SELECT w.id, w.name, w.category, w.needed, COALESCE(SUM(p.quantity), 0) AS pledged
    FROM wish_items w LEFT JOIN pledges p ON p.item_id = w.id`;

const toItem = (row) =>
  row && { ...row, remaining: Math.max(0, row.needed - row.pledged) };

class WishList {
  static items() {
    return db
      .prepare(`${ITEM_SQL} GROUP BY w.id ORDER BY CASE w.category WHEN 'Dogs' THEN 1 WHEN 'Cats' THEN 2 ELSE 3 END, w.id`)
      .all()
      .map(toItem);
  }

  static findById(id) {
    return toItem(db.prepare(`${ITEM_SQL} WHERE w.id = ? GROUP BY w.id`).get(id));
  }

  static create({ name, category, needed }) {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO wish_items (name, category, needed) VALUES (?, ?, ?)")
      .run(name, category, needed);
    return WishList.findById(lastInsertRowid);
  }

  static update(id, { name, category, needed }) {
    db.prepare("UPDATE wish_items SET name = ?, category = ?, needed = ? WHERE id = ?").run(name, category, needed, id);
    return WishList.findById(id);
  }

  static remove(id) {
    return db.prepare("DELETE FROM wish_items WHERE id = ?").run(id).changes > 0;
  }

  static addPledge(itemId, { name, email, quantity }) {
    db.prepare("INSERT INTO pledges (item_id, name, email, quantity) VALUES (?, ?, ?, ?)").run(itemId, name, email, quantity);
    return WishList.findById(itemId);
  }

  // Staff: every pledge, newest first, with the item's name.
  static pledges() {
    return db
      .prepare(
        `SELECT p.id, p.item_id AS itemId, w.name AS itemName, p.name, p.email, p.quantity, p.created_at AS createdAt
           FROM pledges p JOIN wish_items w ON w.id = p.item_id ORDER BY p.id DESC LIMIT 200`,
      )
      .all();
  }
}

module.exports = WishList;
