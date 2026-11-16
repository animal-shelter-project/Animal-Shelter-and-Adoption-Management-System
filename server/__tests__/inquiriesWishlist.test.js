const request = require("supertest");
const { app, db, resetData, tokenFor } = require("../test-utils/testApp");

let ids;
beforeEach(() => {
  ids = resetData();
});

const staff = () => `Bearer ${tokenFor(ids.staffId, "Staff")}`;
const adopter = () => `Bearer ${tokenFor(ids.adopterId, "Adopter")}`;

const FOSTER = {
  kind: "Foster",
  name: "Sam Lee",
  email: "sam@example.com",
  phone: "817-555-0100",
  details: { animals: ["Kittens", "cats"], length: "A few weeks", hasOtherPets: true },
};
const VOLUNTEER = {
  kind: "Volunteer",
  name: "Ana Ruiz",
  email: "ana@example.com",
  details: { interests: ["Dog walking"], availability: ["Sat Morning", "Sun Afternoon"], over16: true },
};
const CONTACT = {
  kind: "Contact",
  name: "Lee",
  email: "lee@example.com",
  message: "Do you have any senior cats?",
  details: { topic: "Adopting" },
};

const send = (body) => request(app).post("/api/inquiries").send(body);

describe("Foster and volunteer sign-ups, contact messages", () => {
  test("T-INQ-1: anyone can sign up to foster or volunteer, or send a message", async () => {
    const foster = await send(FOSTER);
    expect(foster.status).toBe(201);
    expect(foster.body).toMatchObject({
      kind: "Foster",
      name: "Sam Lee",
      status: "New",
      details: { animals: ["Kittens", "Cats"], length: "A few weeks", hasOtherPets: true },
    });
    expect((await send(VOLUNTEER)).status).toBe(201);
    expect((await send(CONTACT)).status).toBe(201);
    expect(db.prepare("SELECT COUNT(*) AS n FROM inquiries").get().n).toBe(3);
  });

  test("T-INQ-2: missing or invalid answers return 400 naming the field, and nothing is saved", async () => {
    const cases = [
      [{ ...FOSTER, name: " " }, "name"],
      [{ ...FOSTER, email: "not-an-email" }, "email"],
      [{ ...FOSTER, details: { ...FOSTER.details, animals: [] } }, "animals"],
      [{ ...FOSTER, details: { ...FOSTER.details, length: "Forever" } }, "length"],
      [{ ...VOLUNTEER, details: { ...VOLUNTEER.details, over16: false } }, "over16"],
      [{ ...VOLUNTEER, details: { ...VOLUNTEER.details, availability: ["Moonday Night"] } }, "availability"],
      [{ ...CONTACT, message: "" }, "message"],
      [{ ...CONTACT, details: { topic: "Pizza" } }, "topic"],
      [{ ...CONTACT, kind: "Spam" }, "kind"],
    ];
    for (const [body, field] of cases) {
      const res = await send(body);
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.fields)).toEqual([field]);
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM inquiries").get().n).toBe(0);
  });

  test("T-INQ-3: only staff can read them, filter by kind and mark them contacted", async () => {
    await send(FOSTER);
    await send(VOLUNTEER);
    const contact = await send(CONTACT);

    expect((await request(app).get("/api/inquiries")).status).toBe(401);
    expect((await request(app).get("/api/inquiries").set("Authorization", adopter())).status).toBe(403);

    const all = await request(app).get("/api/inquiries").set("Authorization", staff());
    expect(all.status).toBe(200);
    expect(all.body.items.map((i) => i.kind)).toEqual(["Contact", "Volunteer", "Foster"]);
    expect(all.body.newCounts).toEqual({ Foster: 1, Volunteer: 1, Contact: 1 });

    const fosters = await request(app).get("/api/inquiries?kind=foster").set("Authorization", staff());
    expect(fosters.body.items).toHaveLength(1);

    const done = await request(app)
      .patch(`/api/inquiries/${contact.body.id}`)
      .set("Authorization", staff())
      .send({ status: "Contacted" });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("Contacted");
    expect((await request(app).patch(`/api/inquiries/${contact.body.id}`).set("Authorization", staff()).send({ status: "Lost" })).status).toBe(400);
    expect((await request(app).patch("/api/inquiries/999").set("Authorization", staff()).send({ status: "Closed" })).status).toBe(404);
    expect((await request(app).patch(`/api/inquiries/${contact.body.id}`).set("Authorization", adopter()).send({ status: "Closed" })).status).toBe(403);
  });
});

describe("Wish list and pledges", () => {
  const addItem = (body, auth = staff()) => request(app).post("/api/wishlist").set("Authorization", auth).send(body);
  const pledge = (id, body) => request(app).post(`/api/wishlist/${id}/pledges`).send(body);
  const PERSON = { name: "Jo", email: "jo@example.com" };

  test("T-WISH-1: staff add items; anyone sees what is still needed", async () => {
    expect((await addItem({ name: "Leashes", category: "Dogs", needed: 10 }, adopter())).status).toBe(403);
    const leash = await addItem({ name: "Leashes", category: "dogs", needed: 10 });
    expect(leash.status).toBe(201);
    expect(leash.body).toMatchObject({ name: "Leashes", category: "Dogs", needed: 10, pledged: 0, remaining: 10 });
    await addItem({ name: "Towels", category: "Everyone", needed: 5 });
    const list = await request(app).get("/api/wishlist");
    expect(list.status).toBe(200);
    expect(list.body.map((i) => i.name)).toEqual(["Leashes", "Towels"]);
  });

  test("T-WISH-2: a pledge counts toward the item; more than is needed is refused", async () => {
    const item = (await addItem({ name: "Cat litter", category: "Cats", needed: 5 })).body;
    const first = await pledge(item.id, { ...PERSON, quantity: 3 });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ pledged: 3, remaining: 2 });

    const tooMany = await pledge(item.id, { ...PERSON, quantity: 3 });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error).toBe("We only need 2 more.");

    expect((await pledge(item.id, { ...PERSON, quantity: 2 })).body.remaining).toBe(0);
    expect((await pledge(item.id, { ...PERSON, quantity: 1 })).status).toBe(409);
  });

  test("T-WISH-3: pledges need a name, a valid email and a whole quantity", async () => {
    const item = (await addItem({ name: "Towels", category: "Everyone", needed: 20 })).body;
    for (const body of [
      { ...PERSON, name: "", quantity: 1 },
      { ...PERSON, email: "nope", quantity: 1 },
      { ...PERSON, quantity: 0 },
      { ...PERSON, quantity: 2.5 },
    ]) {
      expect((await pledge(item.id, body)).status).toBe(400);
    }
    expect((await pledge(999, { ...PERSON, quantity: 1 })).status).toBe(404);
    expect(db.prepare("SELECT COUNT(*) AS n FROM pledges").get().n).toBe(0);
  });

  test("T-WISH-4: staff change or delete items and see every pledge", async () => {
    const item = (await addItem({ name: "Towels", category: "Everyone", needed: 20 })).body;
    await pledge(item.id, { ...PERSON, quantity: 4 });

    const changed = await request(app).put(`/api/wishlist/${item.id}`).set("Authorization", staff()).send({ needed: 30 });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ needed: 30, pledged: 4, remaining: 26 });
    expect((await request(app).put(`/api/wishlist/${item.id}`).set("Authorization", staff()).send({ needed: -1 })).status).toBe(400);

    const pledges = await request(app).get("/api/wishlist/pledges").set("Authorization", staff());
    expect(pledges.body).toEqual([
      expect.objectContaining({ itemName: "Towels", name: "Jo", email: "jo@example.com", quantity: 4 }),
    ]);
    expect((await request(app).get("/api/wishlist/pledges")).status).toBe(401);

    expect((await request(app).delete(`/api/wishlist/${item.id}`).set("Authorization", staff())).status).toBe(204);
    expect((await request(app).get("/api/wishlist")).body).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM pledges").get().n).toBe(0);
  });
});
