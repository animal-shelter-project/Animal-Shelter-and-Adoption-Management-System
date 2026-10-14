const Animal = require("../models/Animal");
const HttpError = require("../utils/HttpError");
const { parseId, optionalText, optionalStatus } = require("../utils/validation");

class AnimalController {
  // GET /api/animals?species=&breed=&status=   (US-01, FR-01)
  static list(req, res) {
    const filters = {
      species: optionalText(req.query.species, "species"),
      breed: optionalText(req.query.breed, "breed"),
      status: optionalStatus(req.query.status),
    };
    res.json(Animal.findAll(filters));
  }

  // GET /api/animals/:id   (US-02, FR-02)
  static getById(req, res) {
    const id = parseId(req.params.id, "animal id");
    const animal = Animal.findById(id);
    if (!animal) throw new HttpError(404, "Animal not found.");
    res.json(animal);
  }
}

module.exports = AnimalController;
