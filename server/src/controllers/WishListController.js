const WishList = require("../models/WishList");
const HttpError = require("../utils/HttpError");
const { parseId } = require("../utils/validation");

const CATEGORIES = ["Dogs", "Cats", "Everyone"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fieldError = (field, message) => new HttpError(400, message, { fields: { [field]: message } });

function readItem(body, current = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Request body must be a JSON object.");
  const name = body.name === undefined ? current.name : body.name;
  if (typeof name !== "string" || !name.trim()) throw fieldError("name", "Enter the item's name.");
  if (name.trim().length > 80) throw fieldError("name", "Keep the name under 80 characters.");
  const categoryIn = body.category === undefined ? current.category : body.category;
  const category = typeof categoryIn === "string" && CATEGORIES.find((c) => c.toLowerCase() === categoryIn.trim().toLowerCase());
  if (!category) throw fieldError("category", "Choose Dogs, Cats or Everyone.");
  const needed = body.needed === undefined ? current.needed : body.needed;
  if (!Number.isInteger(needed) || needed < 0 || needed > 1000) throw fieldError("needed", "Needed must be a whole number from 0 to 1000.");
  return { name: name.trim(), category, needed };
}

class WishListController {
  // GET /api/wishlist (public)
  static list(req, res) {
    res.json(WishList.items());
  }

  // POST /api/wishlist/:id/pledges (public) { name, email, quantity }
  // 201 with the item's new totals; 409 if it asks for more than is still needed.
  static pledge(req, res) {
    const id = parseId(req.params.id, "item id");
    const item = WishList.findById(id);
    if (!item) throw new HttpError(404, "Wish-list item not found.");
    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw fieldError("name", "Enter your name.");
    if (name.length > 80) throw fieldError("name", "Keep your name under 80 characters.");
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!EMAIL.test(email)) throw fieldError("email", "Enter a valid email address.");
    const quantity = body.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw fieldError("quantity", "Quantity must be a whole number from 1 to 100.");
    }
    if (item.remaining === 0) throw new HttpError(409, `We have all the ${item.name.toLowerCase()} we need right now. Thank you!`);
    if (quantity > item.remaining) {
      throw new HttpError(409, `We only need ${item.remaining} more.`, { fields: { quantity: `We only need ${item.remaining} more.` } });
    }
    res.status(201).json(WishList.addPledge(id, { name, email, quantity }));
  }

  // Staff
  static create(req, res) {
    res.status(201).json(WishList.create(readItem(req.body)));
  }

  static update(req, res) {
    const id = parseId(req.params.id, "item id");
    const current = WishList.findById(id);
    if (!current) throw new HttpError(404, "Wish-list item not found.");
    res.json(WishList.update(id, readItem(req.body, current)));
  }

  static remove(req, res) {
    const id = parseId(req.params.id, "item id");
    if (!WishList.remove(id)) throw new HttpError(404, "Wish-list item not found.");
    res.status(204).end();
  }

  static pledges(req, res) {
    res.json(WishList.pledges());
  }
}

module.exports = WishListController;
