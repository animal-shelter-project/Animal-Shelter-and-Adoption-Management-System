const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Animal = require("../models/Animal");
const HttpError = require("../utils/HttpError");
const StatusHistory = require("../models/StatusHistory");
const { manualChange, updateDetails } = require("../services/AnimalStatusService");
const { UPLOAD_DIR } = require("../config");
const {
  parseId,
  optionalText,
  optionalStatus,
  MAX_FILTER_LENGTH,
  validateStatusChange,
} = require("../utils/validation");

const MAX_AGE = 40;
const MAX_FEE = 10000;
const MAX_DESCRIPTION = 1000;
const SEXES = ["Male", "Female", "Unknown"];
const SIZES = ["Small", "Medium", "Large"];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

// Require a JSON object for POST and PUT request bodies.
function requireBody(req) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  return body;
}

const fieldError = (field, message) => new HttpError(400, message, { fields: { [field]: message } });

// Read a required text field, trimming whitespace and rejecting empty values.
function requiredText(value, field) {
  const text = optionalText(value, field);

  if (!text) {
    throw fieldError(field, `${field} is required.`);
  }

  return text.replace(/\s+/g, " ");
}

// Use the supplied breed, or keep the existing/default breed if it was omitted.
// An empty string is allowed so a staff member can clear the breed.
function readBreed(value, fallback) {
  if (value === undefined) return fallback;

  if (typeof value !== "string") {
    throw new HttpError(400, "Give one value for breed.");
  }

  const breed = value.trim().replace(/\s+/g, " ");

  if (breed.length > MAX_FILTER_LENGTH) {
    throw fieldError("breed", `breed is too long (max ${MAX_FILTER_LENGTH} characters).`);
  }

  return breed;
}

// Whole number in a range, or the fallback when omitted.
function readWhole(value, fallback, field, min, max, message) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw fieldError(field, message);
  }
  return value;
}

const readAge = (value, fallback) =>
  readWhole(value, fallback, "age", 0, MAX_AGE, `Age must be a whole number from 0 to ${MAX_AGE}.`);
const readAgeMonths = (value, fallback) =>
  readWhole(value, fallback, "ageMonths", 0, 11, "Months must be a whole number from 0 to 11.");
const readFee = (value, fallback) =>
  readWhole(value, fallback, "adoptionFee", 0, MAX_FEE, `Adoption fee must be a whole number of dollars from 0 to ${MAX_FEE}.`);

// One of a fixed list, matched case-insensitively.
function readChoice(value, fallback, field, choices, { allowEmpty = false } = {}) {
  if (value === undefined) return fallback;
  if (allowEmpty && (value === "" || value === null)) return "";
  const match =
    typeof value === "string" && choices.find((c) => c.toLowerCase() === value.trim().toLowerCase());
  if (!match) throw fieldError(field, `${field} must be one of: ${choices.join(", ")}.`);
  return match;
}

// true / false / null (not known yet).
function readYesNo(value, fallback, field) {
  if (value === undefined) return fallback;
  if (value === null || typeof value === "boolean") return value;
  throw fieldError(field, `${field} must be yes, no or not known.`);
}

function readDescription(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw fieldError("description", "Description must be text.");
  const text = value.trim();
  if (text.length > MAX_DESCRIPTION) {
    throw fieldError("description", `Description must be ${MAX_DESCRIPTION} characters or fewer.`);
  }
  return text;
}

// Validate a supplied status against the allowed values.
// If omitted, use the existing status or the create default.
function readStatus(value, fallback) {
  if (value === undefined) return fallback;

  const status = optionalStatus(value);

  if (!status) {
    throw new HttpError(400, "Status is required when provided.");
  }

  return status;
}

// Every editable detail, validated. `current` holds the values to keep for
// fields left out (the defaults for a new animal).
function readDetails(body, current) {
  return {
    name: requiredText(body.name, "name"),
    species: requiredText(body.species, "species"),
    breed: readBreed(body.breed, current.breed),
    age: readAge(body.age, current.age),
    ageMonths: readAgeMonths(body.ageMonths, current.ageMonths),
    sex: readChoice(body.sex, current.sex, "sex", SEXES),
    size: readChoice(body.size, current.size, "size", SIZES, { allowEmpty: true }),
    description: readDescription(body.description, current.description),
    goodWithKids: readYesNo(body.goodWithKids, current.goodWithKids, "goodWithKids"),
    goodWithDogs: readYesNo(body.goodWithDogs, current.goodWithDogs, "goodWithDogs"),
    goodWithCats: readYesNo(body.goodWithCats, current.goodWithCats, "goodWithCats"),
    adoptionFee: readFee(body.adoptionFee, current.adoptionFee),
  };
}

const NEW_ANIMAL_DEFAULTS = {
  breed: "",
  age: 0,
  ageMonths: 0,
  sex: "Unknown",
  size: "",
  description: "",
  goodWithKids: null,
  goodWithDogs: null,
  goodWithCats: null,
  adoptionFee: 0,
};

// Staff see archived animals; everyone else gets 404 for them.
function findVisible(id, user) {
  const animal = Animal.findById(id);
  if (!animal || (animal.archived && user?.role !== "Staff")) {
    throw new HttpError(404, "Animal not found.");
  }
  return animal;
}

// Accepted photo types, recognised by their first bytes (not by what the
// browser claims), so only real images are ever saved.
const IMAGE_TYPES = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", mime: "image/webp", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

function removePhotoFile(fileName) {
  if (!fileName) return;
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(fileName)));
  } catch {
    // already gone: nothing to do
  }
}

class AnimalController {
  // GET /api/animals?species=&breed=&name=&status=
  // Read optional filters, then return matching animals. Staff can add
  // ?archived=include to see archived animals too.
  static list(req, res) {
    const filters = {
      species: optionalText(req.query.species, "species"),
      breed: optionalText(req.query.breed, "breed"),
      name: optionalText(req.query.name, "name"),
      status: optionalStatus(req.query.status),
      includeArchived: req.user?.role === "Staff" && req.query.archived === "include",
    };

    res.json(Animal.findAll(filters));
  }

  // GET /api/animals/breeds?species=Dog -> ["Beagle", "Labrador Retriever"]
  static breeds(req, res) {
    res.json(Animal.breeds(optionalText(req.query.species, "species")));
  }

  // GET /api/animals/:id
  // Validate the ID and return 404 if there is no matching animal.
  static getById(req, res) {
    const id = parseId(req.params.id, "animal id");
    res.json(findVisible(id, req.user));
  }

  // POST /api/animals
  // Create an animal after validating its required and optional fields.
  // 409 with { duplicate } if an animal with the same name and species is
  // already in the shelter, unless the body says allowDuplicate: true.
  static create(req, res) {
    const body = requireBody(req);
    const details = readDetails(body, NEW_ANIMAL_DEFAULTS);
    // New animals are Available unless a valid status is supplied.
    const status = readStatus(body.status, "Available");

    if (body.allowDuplicate !== true) {
      const duplicate = Animal.findDuplicate(details);
      if (duplicate) {
        throw new HttpError(
          409,
          `A ${duplicate.species.toLowerCase()} named ${duplicate.name} is already in the shelter.`,
          { duplicate: { id: duplicate.id, name: duplicate.name, breed: duplicate.breed, status: duplicate.status } },
        );
      }
    }

    // Also starts its status history (R-09).
    const animal = Animal.create({ ...details, status }, { changedBy: req.user.id });

    // 201 means the resource was successfully created.
    res.status(201).json(animal);
  }

  // PUT /api/animals/:id
  // Validate the ID, confirm the animal exists, then apply the submitted fields.
  static update(req, res) {
    const id = parseId(req.params.id, "animal id");
    const current = Animal.findById(id);

    if (!current) throw new HttpError(404, "Animal not found.");

    const body = requireBody(req);

    // A status change made here is checked and logged like any other (R-09).
    const animal = updateDetails(id, {
      ...readDetails(body, current),
      status: readStatus(body.status, current.status),
    }, { changedBy: req.user.id });

    res.json(animal);
  }

  // PUT /api/animals/:id/photo  body { image: "data:image/jpeg;base64,..." }
  // Saves the photo (JPEG, PNG or WebP, up to 2 MB) and replaces any old one.
  static uploadPhoto(req, res) {
    const id = parseId(req.params.id, "animal id");
    if (!Animal.findById(id)) throw new HttpError(404, "Animal not found.");

    const image = req.body?.image;
    const match = typeof image === "string" && /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=\s]+)$/.exec(image);
    if (!match) throw fieldError("photo", "Choose a JPEG, PNG or WebP photo.");
    const bytes = Buffer.from(match[1], "base64");
    if (bytes.length === 0) throw fieldError("photo", "That file is empty.");
    if (bytes.length > MAX_PHOTO_BYTES) throw fieldError("photo", "Photos must be 2 MB or smaller.");
    const type = IMAGE_TYPES.find((t) => t.test(bytes));
    if (!type) throw fieldError("photo", "Choose a JPEG, PNG or WebP photo.");

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const fileName = `animal-${id}-${crypto.randomBytes(6).toString("hex")}.${type.ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), bytes);

    const old = Animal.photoFile(id);
    const animal = Animal.setPhoto(id, fileName);
    removePhotoFile(old);
    res.json(animal);
  }

  // DELETE /api/animals/:id/photo -> back to the illustrated portrait.
  static deletePhoto(req, res) {
    const id = parseId(req.params.id, "animal id");
    if (!Animal.findById(id)) throw new HttpError(404, "Animal not found.");
    const old = Animal.photoFile(id);
    const animal = Animal.setPhoto(id, null);
    removePhotoFile(old);
    res.json(animal);
  }

  // DELETE /api/animals/:id -> archive (hide from the catalog). The record,
  // its history and its applications are kept. Not allowed while an
  // application is under review.
  static archive(req, res) {
    const id = parseId(req.params.id, "animal id");
    const animal = Animal.findById(id);
    if (!animal) throw new HttpError(404, "Animal not found.");
    if (animal.archived) throw new HttpError(409, `${animal.name} is already archived.`);
    if (animal.status === "Pending") {
      throw new HttpError(
        409,
        `${animal.name} has an adoption application under review. Decide it before archiving.`,
      );
    }
    res.json(Animal.setArchived(id, true, req.user.id));
  }

  // POST /api/animals/:id/restore -> back in the catalog.
  static restore(req, res) {
    const id = parseId(req.params.id, "animal id");
    const animal = Animal.findById(id);
    if (!animal) throw new HttpError(404, "Animal not found.");
    if (!animal.archived) throw new HttpError(409, `${animal.name} is not archived.`);
    res.json(Animal.setArchived(id, false));
  }

  // GET /api/animals/:id/history   (proposal R-09 / US-09; Staff only)
  // Oldest first: [{ id, fromStatus, toStatus, note, changedAt, changedBy }]
  static history(req, res) {
    const id = parseId(req.params.id, "animal id");
    if (!Animal.findById(id)) throw new HttpError(404, "Animal not found.");
    res.json(StatusHistory.forAnimal(id));
  }

  // PATCH /api/animals/:id/status   (proposal R-09, R-12; Staff only)
  // Body { status, note?, adopterId? }. 200 with the updated animal; 409 if
  // the change isn't allowed (e.g. the animal has an application under
  // review). Adopted needs adopterId (v2: every adoption has a record).
  static changeStatus(req, res) {
    const id = parseId(req.params.id, "animal id");
    const { status, note } = validateStatusChange(req.body);
    const adopterId =
      req.body.adopterId === undefined || req.body.adopterId === null || req.body.adopterId === ""
        ? null
        : parseId(String(req.body.adopterId), "adopter id");
    const animal = manualChange(id, status, { changedBy: req.user.id, note, adopterId });
    res.json(animal);
  }
}

module.exports = AnimalController;
