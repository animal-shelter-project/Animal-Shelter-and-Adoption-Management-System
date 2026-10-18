const bcrypt = require("bcrypt");
const db = require("./db");
const StatusHistory = require("./models/StatusHistory");

// "YYYY-MM-DD HH:MM:SS" (UTC, like SQLite's CURRENT_TIMESTAMP), `days` ago.
const daysAgo = (days) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ");

// Status history for the demo animals (proposal R-09): each list is the
// animal's journey, oldest first, as [status, days ago, note].
const HISTORY = {
  Buddy: [["Available", 30, "Added to the shelter"]],
  Luna: [["Available", 25, "Added to the shelter"]],
  Max: [
    ["Available", 28, "Added to the shelter"],
    ["Pending", 4, "Adoption application submitted"],
  ],
  Daisy: [
    ["Available", 40, "Added to the shelter"],
    ["Pending", 16, "Adoption application submitted"],
    ["Adopted", 13, "Application approved"],
  ],
  Charlie: [["Available", 10, "Added to the shelter"]],
  Bella: [
    ["Available", 21, "Added to the shelter"],
    ["Fostered", 7, "Went to a foster home"],
  ],
};

// Demo data covering every status, so search filters, the status badges and
// the Apply rule (FR-01, FR-02, FR-08) can all be shown right after seeding.
// Max and Daisy's statuses match real applications, so the data is consistent.
const seedDatabase = async () => {
  const passwordHash = await bcrypt.hash("password123", 10);

  const users = [
    { email: "staff@shelter.test", passwordHash, role: "Staff" },
    { email: "adopter@shelter.test", passwordHash, role: "Adopter" },
  ];

  const animals = [
    { name: "Buddy", species: "Dog", breed: "Labrador Retriever", age: 3, status: "Available" },
    { name: "Luna", species: "Cat", breed: "Domestic Shorthair", age: 2, status: "Available" },
    { name: "Max", species: "Dog", breed: "German Shepherd", age: 5, status: "Pending" },
    { name: "Daisy", species: "Cat", breed: "Siamese", age: 4, status: "Adopted" },
    { name: "Charlie", species: "Dog", breed: "Beagle", age: 1, status: "Available" },
    { name: "Bella", species: "Rabbit", breed: "Holland Lop", age: 1, status: "Fostered" },
  ];

  // applicant = adopter@shelter.test
  const applications = [
    { animal: "Max", status: "Pending" },
    { animal: "Daisy", status: "Approved" },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, role)
    VALUES (@email, @passwordHash, @role)
  `);

  const insertAnimal = db.prepare(`
    INSERT INTO animals (name, species, breed, age, status)
    VALUES (@name, @species, @breed, @age, @status)
  `);

  const insertApplication = db.prepare(`
    INSERT INTO applications (animal_id, applicant_id, status)
    VALUES (?, ?, ?)
  `);

  const seed = db.transaction(() => {
    db.prepare("DELETE FROM status_history").run();
    db.prepare("DELETE FROM applications").run();
    db.prepare("DELETE FROM animals").run();
    db.prepare("DELETE FROM users").run();
    // Restart ids at 1 so /animals/1 is always Buddy after a re-seed.
    db.prepare(
      "DELETE FROM sqlite_sequence WHERE name IN ('status_history', 'applications', 'animals', 'users')",
    ).run();

    const userIds = {};
    for (const user of users) {
      userIds[user.email] = insertUser.run(user).lastInsertRowid;
    }

    const animalIds = {};
    for (const animal of animals) {
      animalIds[animal.name] = insertAnimal.run(animal).lastInsertRowid;
    }

    const staffId = userIds["staff@shelter.test"];
    for (const [name, steps] of Object.entries(HISTORY)) {
      let fromStatus = null;
      for (const [toStatus, days, note] of steps) {
        StatusHistory.record({
          animalId: animalIds[name],
          fromStatus,
          toStatus,
          changedBy: staffId,
          note,
          changedAt: daysAgo(days),
        });
        fromStatus = toStatus;
      }
    }

    for (const application of applications) {
      insertApplication.run(
        animalIds[application.animal],
        userIds["adopter@shelter.test"],
        application.status,
      );
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
