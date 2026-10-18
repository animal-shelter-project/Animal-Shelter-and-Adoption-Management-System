const request = require("supertest");
const { app, resetData, tokenFor } = require("../test-utils/testApp");

// Proposal R-01 / US-01: staff add and edit animals (POST and PUT /api/animals).
let ids;
beforeEach(() => {
  ids = resetData();
});

const staff = () => `Bearer ${tokenFor(ids.staffId, "Staff")}`;
const adopter = () => `Bearer ${tokenFor(ids.adopterId, "Adopter")}`;
const post = (body, auth = staff()) => {
  const req = request(app).post("/api/animals");
  if (auth) req.set("Authorization", auth);
  return req.send(body);
};

describe("Add and edit animals (proposal R-01)", () => {
  test("T-ADD-API-1: staff add an animal; it is Available and appears in the public list", async () => {
    const res = await post({ name: "Rocky", species: "Dog", breed: "Boxer", age: 2 });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({ name: "Rocky", species: "Dog", breed: "Boxer", age: 2, status: "Available" }),
    );
    const list = await request(app).get("/api/animals?status=Available");
    expect(list.body.map((a) => a.name)).toContain("Rocky");
  });

  test("T-ADD-API-2: only logged-in staff can add or edit", async () => {
    expect((await post({ name: "X", species: "Dog" }, adopter())).status).toBe(403);
    expect((await post({ name: "X", species: "Dog" }, null)).status).toBe(401);
    const put = await request(app)
      .put(`/api/animals/${ids.animalIds.Buddy}`)
      .set("Authorization", adopter())
      .send({ name: "X", species: "Dog" });
    expect(put.status).toBe(403);
  });

  test("T-ADD-API-3: missing name or species, a bad age or an unknown status is a 400", async () => {
    expect((await post({ species: "Dog" })).status).toBe(400);
    expect((await post({ name: "X" })).status).toBe(400);
    expect((await post({ name: "X", species: "Dog", age: 2.5 })).status).toBe(400);
    expect((await post({ name: "X", species: "Dog", age: -1 })).status).toBe(400);
    expect((await post({ name: "X", species: "Dog", status: "Lost" })).status).toBe(400);
    expect((await post([])).status).toBe(400);
  });

  test("T-ADD-API-4: staff edit an animal's details; omitted fields keep their values", async () => {
    const id = ids.animalIds.Buddy;
    const before = (await request(app).get(`/api/animals/${id}`)).body;
    const res = await request(app)
      .put(`/api/animals/${id}`)
      .set("Authorization", staff())
      .send({ name: "Buddy", species: "Dog", age: before.age + 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ breed: before.breed, age: before.age + 1 }));
  });

  test("T-ADD-API-5: editing an unknown animal is a 404", async () => {
    const res = await request(app)
      .put("/api/animals/9999")
      .set("Authorization", staff())
      .send({ name: "X", species: "Dog" });
    expect(res.status).toBe(404);
  });
});
