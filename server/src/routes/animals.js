const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  try {
    const animals = db
      .prepare(`
        SELECT id, name, species, breed, age, status, created_at
        FROM animals
        WHERE status = 'Available'
        ORDER BY id
      `)
      .all();

    res.json(animals);
  } catch (error) {
    console.error("Unable to retrieve animals:", error);
    res.status(500).json({
      error: "Unable to retrieve animals.",
    });
  }
});

module.exports = router;