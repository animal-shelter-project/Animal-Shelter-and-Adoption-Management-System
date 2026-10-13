const bcrypt = require("bcrypt");
const db = require("./db");

const seedDatabase = async () => {
  const passwordHash = await bcrypt.hash("password123", 10);

  const users = [
    {
      email: "staff@shelter.test",
      passwordHash,
      role: "Staff",
    },
    {
      email: "adopter@shelter.test",
      passwordHash,
      role: "Adopter",
    },
  ];

  const animals = [
    {
      name: "Buddy",
      species: "Dog",
      breed: "Labrador Retriever",
      age: 3,
      status: "Available",
    },
    {
      name: "Luna",
      species: "Cat",
      breed: "Domestic Shorthair",
      age: 2,
      status: "Available",
    },
    {
      name: "Max",
      species: "Dog",
      breed: "German Shepherd",
      age: 5,
      status: "Available",
    },
    {
      name: "Daisy",
      species: "Cat",
      breed: "Siamese",
      age: 4,
      status: "Available",
    },
    {
      name: "Charlie",
      species: "Dog",
      breed: "Beagle",
      age: 1,
      status: "Available",
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, role)
    VALUES (@email, @passwordHash, @role)
  `);

  const insertAnimal = db.prepare(`
    INSERT INTO animals (name, species, breed, age, status)
    VALUES (@name, @species, @breed, @age, @status)
  `);

  const seed = db.transaction(() => {
    db.prepare("DELETE FROM applications").run();
    db.prepare("DELETE FROM animals").run();
    db.prepare("DELETE FROM users").run();

    for (const user of users) {
      insertUser.run(user);
    }

    for (const animal of animals) {
      insertAnimal.run(animal);
    }
  });

  seed();

  console.log("Database seeded successfully.");
  console.log("Staff login: staff@shelter.test / password123");
  console.log("Adopter login: adopter@shelter.test / password123");
};

seedDatabase().catch((error) => {
  console.error("Database seed failed:", error);
  process.exit(1);
});