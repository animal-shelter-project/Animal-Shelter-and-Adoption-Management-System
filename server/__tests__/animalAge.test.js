const request = require("supertest");
const { app, db, resetData, tokenFor } = require("../test-utils/testApp");

// BUG-04: the server accepts the same ages as the Add Animal form
// (whole years, 0 to 40).
let ids;
beforeEach(() => {
  ids = resetData();
});

const staff = () => `Bearer ${tokenFor(ids.staffId, "Staff")}`;
const add = (age) =>
  request(app)
    .post("/api/animals")
    .set("Authorization", staff())
    .send({ name: "Rocky", species: "Dog", breed: "Boxer", age });
const edit = (age) =>
  request(app)
    .put(`/api/animals/${ids.animalIds.Buddy}`)
    .set("Authorization", staff())
    .send({ name: "Buddy", species: "Dog", age });
const countAnimals = () => db.prepare("SELECT COUNT(*) AS n FROM animals").get().n;

describe("Animal age limit (BUG-04)", () => {
  test("T-AGELIMIT-1: the lowest and highest allowed ages (0 and 40) are accepted", async () => {
    expect((await add(0)).status).toBe(201);
    expect((await add(40)).status).toBe(201);
    expect((await edit(40)).status).toBe(200);
  });

  test("T-AGELIMIT-2: an age over 40 is a 400 when adding or editing, with a message for the age field", async () => {
    for (const res of [await add(41), await add(999), await edit(41)]) {
      expect(res.status).toBe(400);
      expect(res.body.fields.age).toBeTruthy();
    }
  });

  test("T-AGELIMIT-3: nothing is saved when the age is refused", async () => {
    const before = countAnimals();
    const buddyAge = db.prepare("SELECT age FROM animals WHERE id = ?").get(ids.animalIds.Buddy).age;
    await add(999);
    await edit(999);
    expect(countAnimals()).toBe(before);
    expect(db.prepare("SELECT age FROM animals WHERE id = ?").get(ids.animalIds.Buddy).age).toBe(buddyAge);
  });
});