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
  Pepper: [["Available", 6, "Added to the shelter"]],
  Ziggy: [["Available", 3, "Added to the shelter"]],
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
    { email: "staff@shelter.test", passwordHash, role: "Staff", name: "Sam Rivera", phone: "817-555-0100", address: "" },
    { email: "adopter@shelter.test", passwordHash, role: "Adopter", name: "Alex Morgan", phone: "817-555-0142", address: "1204 Oak St, Arlington TX" },
    { email: "jordan@shelter.test", passwordHash, role: "Adopter", name: "Jordan Lee", phone: "682-555-0177", address: "88 Cooper St, Arlington TX" },
  ];

  // [goodWithKids, goodWithDogs, goodWithCats]: 1 yes, 0 no, null not known.
  const animals = [
    { name: "Buddy", species: "Dog", breed: "Labrador Retriever", age: 3, ageMonths: 0, sex: "Male", size: "Large", fee: 150, good: [1, 1, null], status: "Available",
      description: "A gentle, goofy Lab who loves fetch, long walks and belly rubs. House-trained and knows sit, stay and paw." },
    { name: "Luna", species: "Cat", breed: "Domestic Shorthair", age: 2, ageMonths: 6, sex: "Female", size: "Small", fee: 75, good: [1, 0, 1], status: "Available",
      description: "Calm and curious. Luna likes sunny windowsills and quiet evenings, and gets on well with other cats." },
    { name: "Max", species: "Dog", breed: "German Shepherd", age: 5, ageMonths: 0, sex: "Male", size: "Large", fee: 150, good: [0, 1, 0], status: "Pending",
      description: "Loyal and smart. Max needs an experienced owner and a home without small children." },
    { name: "Daisy", species: "Cat", breed: "Siamese", age: 4, ageMonths: 0, sex: "Female", size: "Small", fee: 75, good: [1, null, 1], status: "Adopted",
      description: "Chatty and affectionate. Daisy will tell you all about her day." },
    { name: "Charlie", species: "Dog", breed: "Beagle", age: 1, ageMonths: 2, sex: "Male", size: "Medium", fee: 125, good: [1, 1, 1], status: "Available",
      description: "A happy young Beagle with a great nose. Friendly with everyone, still learning to walk on a lead." },
    { name: "Bella", species: "Rabbit", breed: "Holland Lop", age: 1, ageMonths: 0, sex: "Female", size: "Small", fee: 40, good: [null, 0, null], status: "Fostered",
      description: "A soft, sweet bunny who enjoys veggies and gentle handling. In a foster home for now." },
    { name: "Pepper", species: "Cat", breed: "Tabby", age: 0, ageMonths: 3, sex: "Female", size: "Small", fee: 90, good: [1, null, 1], status: "Available",
      description: "A playful 3-month-old kitten. Fully vaccinated for her age and litter-trained." },
    { name: "Ziggy", species: "Bird", breed: "Budgerigar", age: 2, ageMonths: 0, sex: "Unknown", size: "Small", fee: 25, good: [1, null, 0], status: "Available",
      description: "A cheerful budgie who chirps along to music. Comes with a starter cage." },
  ];

  // [animal, applicant, status, days ago, household details, answers]
  const applications = [
    ["Max", "adopter@shelter.test", "Pending", 4,
      "Two adults, no children. We had a German Shepherd for 11 years and walk every morning.",
      { homeType: "House", ownOrRent: "Own", landlordOk: null, hasYard: 1, adults: 2, children: 0, otherPets: "None", hoursAlone: 3 }],
    ["Daisy", "adopter@shelter.test", "Approved", 16,
      "Quiet apartment, I work from home. Daisy would be our only pet.",
      { homeType: "Apartment", ownOrRent: "Rent", landlordOk: 1, hasYard: 0, adults: 1, children: 0, otherPets: "", hoursAlone: 2 }],
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, role, name, phone, address)
    VALUES (@email, @passwordHash, @role, @name, @phone, @address)
  `);

  const insertAnimal = db.prepare(`
    INSERT INTO animals (name, species, breed, age, age_months, sex, size, description,
                         good_with_kids, good_with_dogs, good_with_cats, adoption_fee, status)
    VALUES (@name, @species, @breed, @age, @ageMonths, @sex, @size, @description,
            @kids, @dogs, @cats, @fee, @status)
  `);

  const insertApplication = db.prepare(`
    INSERT INTO applications (animal_id, applicant_id, status, household_details, home_type,
                              own_or_rent, landlord_ok, has_yard, adults, children, other_pets,
                              hours_alone, created_at, decided_at, decided_by)
    VALUES (@animalId, @applicantId, @status, @householdDetails, @homeType, @ownOrRent,
            @landlordOk, @hasYard, @adults, @children, @otherPets, @hoursAlone,
            @createdAt, @decidedAt, @decidedBy)
  `);
  const insertNotification = db.prepare(
    "INSERT INTO notifications (user_id, message, link, created_at) VALUES (?, ?, ?, ?)",
  );

  const seed = db.transaction(() => {
    db.prepare("DELETE FROM notifications").run();
    db.prepare("DELETE FROM status_history").run();
    db.prepare("DELETE FROM applications").run();
    db.prepare("DELETE FROM animals").run();
    db.prepare("DELETE FROM users").run();
    // Restart ids at 1 so /animals/1 is always Buddy after a re-seed.
    db.prepare(
      "DELETE FROM sqlite_sequence WHERE name IN ('status_history', 'applications', 'animals', 'users', 'notifications')",
    ).run();

    const userIds = {};
    for (const user of users) {
      userIds[user.email] = insertUser.run(user).lastInsertRowid;
    }

    const animalIds = {};
    for (const { good, ...animal } of animals) {
      const [kids, dogs, cats] = good;
      animalIds[animal.name] = insertAnimal.run({ ...animal, kids, dogs, cats }).lastInsertRowid;
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

    for (const [animal, applicant, status, days, householdDetails, answers] of applications) {
      const decided = status !== "Pending";
      insertApplication.run({
        animalId: animalIds[animal],
        applicantId: userIds[applicant],
        status,
        householdDetails,
        ...answers,
        createdAt: daysAgo(days),
        decidedAt: decided ? daysAgo(days - 3) : null,
        decidedBy: decided ? staffId : null,
      });
      if (status === "Approved") {
        insertNotification.run(
          userIds[applicant],
          `Good news! Your application to adopt ${animal} was approved. The shelter will call you to arrange pick-up.`,
          "/my-applications",
          daysAgo(days - 3),
        );
      }
    }
  });

  seed();

  console.log("Database seeded successfully.");
  console.log("Staff login: staff@shelter.test / password123");
  console.log("Adopter login: adopter@shelter.test / password123 (also jordan@shelter.test)");
};

seedDatabase().catch((error) => {
  console.error("Database seed failed:", error);
  process.exit(1);
});
