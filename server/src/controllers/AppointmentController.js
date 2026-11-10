const db = require("../db");
const Animal = require("../models/Animal");
const Appointment = require("../models/Appointment");
const HttpError = require("../utils/HttpError");
const { parseId } = require("../utils/validation");

const PURPOSES = ["Vet visit", "Vaccination", "Meet and greet", "Grooming", "Other"];
const STATUSES = ["Done", "Cancelled"];
const MAX_NOTES = 300;

const fieldError = (field, message) => new HttpError(400, message, { fields: { [field]: message } });
const pad = (n) => String(n).padStart(2, "0");

// The shelter's local time as "YYYY-MM-DD HH:MM".
function localStamp(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// "2026-11-20T14:30" or "2026-11-20 14:30" -> "2026-11-20 14:30" (a real date and time).
function readStart(value) {
  const m = typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) throw fieldError("startsAt", "Choose a date and time.");
  const [, y, mo, d, h, mi] = m.map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d || h > 23 || mi > 59) {
    throw fieldError("startsAt", "That date or time doesn't exist.");
  }
  if (date.getTime() < Date.now() - 60 * 1000) {
    throw fieldError("startsAt", "Choose a time in the future.");
  }
  return localStamp(date);
}

const create = db.transaction((animalId, appointment) => {
  const clash = Appointment.findOverlap(animalId, appointment.startsAt, appointment.durationMinutes);
  if (clash) {
    throw new HttpError(
      409,
      `${clash.animalName} already has "${clash.purpose}" at ${clash.startsAt} (${clash.durationMinutes} min). Choose another time.`,
      { clash: { id: clash.id, startsAt: clash.startsAt, purpose: clash.purpose } },
    );
  }
  return Appointment.create({ animalId, ...appointment });
});

class AppointmentController {
  // GET /api/animals/:id/appointments (Staff) -> soonest first
  static listForAnimal(req, res) {
    const id = parseId(req.params.id, "animal id");
    if (!Animal.findById(id)) throw new HttpError(404, "Animal not found.");
    res.json(Appointment.forAnimal(id));
  }

  // POST /api/animals/:id/appointments (Staff)
  // { startsAt: "YYYY-MM-DDTHH:MM", durationMinutes?, purpose, notes? }
  // 201; 400 bad input or a past time; 409 overlaps another appointment
  // for the same animal.
  static create(req, res) {
    const id = parseId(req.params.id, "animal id");
    const animal = Animal.findById(id);
    if (!animal) throw new HttpError(404, "Animal not found.");
    if (animal.archived) throw new HttpError(409, `${animal.name} is archived.`);
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "Request body must be a JSON object.");
    }
    const startsAt = readStart(body.startsAt);
    const durationMinutes = body.durationMinutes === undefined ? 30 : body.durationMinutes;
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      throw fieldError("durationMinutes", "Length must be 5 to 480 minutes.");
    }
    const purpose =
      typeof body.purpose === "string" && PURPOSES.find((p) => p.toLowerCase() === body.purpose.trim().toLowerCase());
    if (!purpose) throw fieldError("purpose", "Choose what the appointment is for.");
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    if (notes.length > MAX_NOTES) throw fieldError("notes", `Keep notes under ${MAX_NOTES} characters.`);

    res.status(201).json(create(id, { startsAt, durationMinutes, purpose, notes, createdBy: req.user.id }));
  }

  // PATCH /api/appointments/:id { status: "Done" | "Cancelled" } (Staff)
  static setStatus(req, res) {
    const id = parseId(req.params.id, "appointment id");
    const appointment = Appointment.findById(id);
    if (!appointment) throw new HttpError(404, "Appointment not found.");
    const status = typeof req.body?.status === "string" && STATUSES.find((s) => s.toLowerCase() === req.body.status.toLowerCase());
    if (!status) throw fieldError("status", "Status must be Done or Cancelled.");
    if (appointment.status !== "Scheduled") {
      throw new HttpError(409, `This appointment is already ${appointment.status.toLowerCase()}.`);
    }
    res.json(Appointment.setStatus(id, status));
  }

  // GET /api/appointments?days=7 (Staff) -> Scheduled ones from now on.
  static upcoming(req, res) {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    const now = new Date();
    res.json(Appointment.upcoming(localStamp(new Date(now.getTime() - 60 * 60 * 1000)), localStamp(new Date(now.getTime() + days * 86400000))));
  }
}

module.exports = AppointmentController;
module.exports.PURPOSES = PURPOSES;
module.exports.localStamp = localStamp;
