const Inquiry = require("../models/Inquiry");
const HttpError = require("../utils/HttpError");
const { parseId } = require("../utils/validation");

// Choices offered by the public forms. The client shows the same lists.
const FOSTER_ANIMALS = ["Dogs", "Puppies", "Cats", "Kittens", "Rabbits"];
const FOSTER_LENGTHS = ["A few days", "A few weeks", "A month or more"];
const VOLUNTEER_INTERESTS = ["Dog walking", "Cat socializing", "Adoption events", "Cleaning and laundry", "Photography"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIMES = ["Morning", "Afternoon"];
const SLOTS = DAYS.flatMap((d) => TIMES.map((t) => `${d} ${t}`));
const CONTACT_TOPICS = ["Adopting", "Fostering", "Volunteering", "Donations", "Something else"];
const KINDS = ["Foster", "Volunteer", "Contact"];
const STATUSES = ["New", "Contacted", "Closed"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldError = (field, message) => new HttpError(400, message, { fields: { [field]: message } });

function text(body, field, label, { required = false, max = 100, min = 0 } = {}) {
  const value = body[field] === undefined || body[field] === null ? "" : body[field];
  if (typeof value !== "string") throw fieldError(field, `${label} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw fieldError(field, `Enter your ${label.toLowerCase()}.`);
  if (trimmed && trimmed.length < min) throw fieldError(field, `${label} must be at least ${min} characters.`);
  if (trimmed.length > max) throw fieldError(field, `${label} must be ${max} characters or fewer.`);
  return trimmed;
}

// A list of choices: at least one, all from `allowed`, no repeats.
function picks(value, field, allowed, label) {
  if (!Array.isArray(value) || value.length === 0) throw fieldError(field, `Choose at least one ${label}.`);
  const out = [];
  for (const v of value) {
    const match = typeof v === "string" && allowed.find((a) => a.toLowerCase() === v.trim().toLowerCase());
    if (!match) throw fieldError(field, `"${v}" is not one of the choices.`);
    if (!out.includes(match)) out.push(match);
  }
  return out;
}

function one(value, field, allowed, label) {
  const match = typeof value === "string" && allowed.find((a) => a.toLowerCase() === value.trim().toLowerCase());
  if (!match) throw fieldError(field, `Choose ${label}.`);
  return match;
}

function readDetails(kind, body) {
  const d = body.details && typeof body.details === "object" && !Array.isArray(body.details) ? body.details : {};
  if (kind === "Foster") {
    return {
      animals: picks(d.animals, "animals", FOSTER_ANIMALS, "kind of animal"),
      length: one(d.length, "length", FOSTER_LENGTHS, "how long you can foster"),
      hasOtherPets: typeof d.hasOtherPets === "boolean" ? d.hasOtherPets : false,
    };
  }
  if (kind === "Volunteer") {
    if (d.over16 !== true) throw fieldError("over16", "Volunteers must be 16 or older.");
    return {
      interests: picks(d.interests, "interests", VOLUNTEER_INTERESTS, "way to help"),
      availability: picks(d.availability, "availability", SLOTS, "time you are free"),
      over16: true,
    };
  }
  return { topic: one(d.topic, "topic", CONTACT_TOPICS, "a topic") };
}

class InquiryController {
  // POST /api/inquiries (public)
  // body: { kind: Foster|Volunteer|Contact, name, email, phone?, message?, details }
  static create(req, res) {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "Request body must be a JSON object.");
    }
    const kind = one(body.kind, "kind", KINDS, "what this is about");
    const name = text(body, "name", "Name", { required: true, max: 80 });
    const email = text(body, "email", "Email", { required: true, max: 120 });
    if (!EMAIL.test(email)) throw fieldError("email", "Enter a valid email address.");
    const phone = text(body, "phone", "Phone", { max: 30 });
    const message = text(body, "message", "Message", { required: kind === "Contact", min: kind === "Contact" ? 5 : 0, max: 1000 });
    const details = readDetails(kind, body);
    res.status(201).json(Inquiry.create({ kind, name, email, phone, message, details }));
  }

  // GET /api/inquiries?kind=&status= (Staff)
  static list(req, res) {
    const kind = req.query.kind ? one(req.query.kind, "kind", KINDS, "a kind") : undefined;
    const status = req.query.status ? one(req.query.status, "status", STATUSES, "a status") : undefined;
    res.json({ items: Inquiry.list({ kind, status }), newCounts: Inquiry.counts() });
  }

  // PATCH /api/inquiries/:id { status } (Staff)
  static setStatus(req, res) {
    const id = parseId(req.params.id, "id");
    if (!Inquiry.findById(id)) throw new HttpError(404, "Message not found.");
    const status = one(req.body?.status, "status", STATUSES, "a status");
    res.json(Inquiry.setStatus(id, status, req.user.id));
  }
}

module.exports = InquiryController;
module.exports.CHOICES = { FOSTER_ANIMALS, FOSTER_LENGTHS, VOLUNTEER_INTERESTS, DAYS, TIMES, CONTACT_TOPICS };
