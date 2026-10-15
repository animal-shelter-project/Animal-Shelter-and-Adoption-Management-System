const Animal = require("../models/Animal");
const HttpError = require("../utils/HttpError");
const {
  parseId,
  optionalText,
  optionalStatus,
  MAX_FILTER_LENGTH,
} = require("../utils/validation");

// Require a JSON object for POST and PUT request bodies.
function requireBody(req) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  return body;
}

// Read a required text field, trimming whitespace and rejecting empty values.
function requiredText(value, field) {
  const text = optionalText(value, field);

  if (!text) {
    throw new HttpError(400, `${field} is required.`);
  }

  return text;
}

// Use the supplied breed, or keep the existing/default breed if it was omitted.
// An empty string is allowed so a staff member can clear the breed.
function readBreed(value, fallback) {
  if (value === undefined) return fallback;

  if (typeof value !== "string") {
    throw new HttpError(400, "Give one value for breed.");
  }

  const breed = value.trim();

  if (breed.length > MAX_FILTER_LENGTH) {
    throw new HttpError(
      400,
      `breed is too long (max ${MAX_FILTER_LENGTH} characters).`,
    );
  }

  return breed;
}

// Use the supplied age, or keep the existing/default age if it was omitted.
// Age must match the database's non-negative integer constraint.
function readAge(value, fallback) {
  if (value === undefined) return fallback;

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new HttpError(400, "Age must be a non-negative integer.");
  }

  return value;
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

class AnimalController {
  // GET /api/animals?species=&breed=&status=
  // Read optional filters, then return matching animals.
  static list(req, res) {
    const filters = {
      species: optionalText(req.query.species, "species"),
      breed: optionalText(req.query.breed, "breed"),
      status: optionalStatus(req.query.status),
    };

    res.json(Animal.findAll(filters));
  }

  // GET /api/animals/:id
  // Validate the ID and return 404 if there is no matching animal.
  static getById(req, res) {
    const id = parseId(req.params.id, "animal id");
    const animal = Animal.findById(id);

    if (!animal) throw new HttpError(404, "Animal not found.");

    res.json(animal);
  }

  // POST /api/animals
  // Create an animal after validating its required and optional fields.
  static create(req, res) {
    const body = requireBody(req);

    const animal = Animal.create({
      name: requiredText(body.name, "name"),
      species: requiredText(body.species, "species"),
      // The database requires breed and age, so use defaults if omitted.
      breed: readBreed(body.breed, ""),
      age: readAge(body.age, 0),
      // New animals are Available unless a valid status is supplied.
      status: readStatus(body.status, "Available"),
    });

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

    const animal = Animal.updateById(id, {
      // Name and species are required on every update request.
      name: requiredText(body.name, "name"),
      species: requiredText(body.species, "species"),
      // Optional fields retain their current values when omitted.
      breed: readBreed(body.breed, current.breed),
      age: readAge(body.age, current.age),
      status: readStatus(body.status, current.status),
    });

    res.json(animal);
  }
}

module.exports = AnimalController;