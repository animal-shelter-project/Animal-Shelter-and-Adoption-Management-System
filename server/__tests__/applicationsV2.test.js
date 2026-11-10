const request = require("supertest");
const { app, db, resetData, tokenFor } = require("../test-utils/testApp");

// v2: structured applications, withdrawing, decided lists and staff notes,
// notifications, walk-in adoptions and returns.
let ids;
beforeEach(() => {
  ids = resetData();
});

const adopter = () => `Bearer ${tokenFor(ids.adopterId, "Adopter")}`;
const other = () => `Bearer ${tokenFor(ids.otherAdopterId, "Adopter")}`;
const staff = () => `Bearer ${tokenFor(ids.staffId, "Staff")}`;
const ANSWERS = {
  homeType: "Apartment", ownOrRent: "Rent", landlordOk: true, hasYard: false,
  adults: 2, children: 1, otherPets: "One cat", hoursAlone: 5,
};
const apply = (body, auth = adopter()) =>
  request(app).post("/api/applications").set("Authorization", auth).send({ animalId: ids.animalIds.Luna, householdDetails: "Quiet flat.", ...ANSWERS, ...body });
const animalStatus = async (name) => (await request(app).get(`/api/animals/${ids.animalIds[name]}`)).body.status;
const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

describe("Structured applications (v2)", () => {
  test("T-APPV2-1: the answers are saved and shown to staff with the applicant's contact details", async () => {
    db.prepare("UPDATE users SET name = 'Alex Adopter', phone = '817-555-0100' WHERE id = ?").run(ids.adopterId);
    const res = await apply({});
    expect(res.status).toBe(201);
    expect(res.body.answers).toEqual(ANSWERS);
    expect(res.body.staffNotes).toBe(undefined);

    const list = await request(app).get("/api/applications?status=Pending").set("Authorization", staff());
    const mine = list.body.find((a) => a.id === res.body.id);
    expect(mine).toMatchObject({ applicantName: "Alex Adopter", applicantPhone: "817-555-0100", animalName: "Luna" });
    expect(mine.answers.otherPets).toBe("One cat");
  });

  test("T-APPV2-2: each missing or bad answer is a 400 for that field; nothing is saved", async () => {
    const before = count("applications");
    for (const [field, value] of [
      ["homeType", "Castle"],
      ["ownOrRent", undefined],
      ["landlordOk", undefined],
      ["hasYard", "yes"],
      ["adults", 0],
      ["children", -1],
      ["hoursAlone", 25],
      ["otherPets", "x".repeat(301)],
    ]) {
      const res = await apply({ [field]: value });
      expect(res.status).toBe(400);
      expect(res.body.fields[field]).toBeTruthy();
    }
    expect(count("applications")).toBe(before);
    expect(await animalStatus("Luna")).toBe("Available");
  });

  test("T-APPV2-3: owners aren't asked about a landlord", async () => {
    const res = await apply({ ownOrRent: "Own", landlordOk: undefined });
    expect(res.status).toBe(201);
    expect(res.body.answers.landlordOk).toBe(null);
  });
});

describe("Withdrawing (v2)", () => {
  test("T-WD-1: an adopter withdraws a Pending application and the animal is Available again", async () => {
    const id = (await apply({})).body.id;
    expect(await animalStatus("Luna")).toBe("Pending");
    const res = await request(app).put(`/api/applications/${id}/withdraw`).set("Authorization", adopter());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Withdrawn");
    expect(await animalStatus("Luna")).toBe("Available");
    const history = db.prepare("SELECT note FROM status_history WHERE animal_id = ? ORDER BY id DESC").get(ids.animalIds.Luna);
    expect(history.note).toMatch(/withdrawn/);
  });

  test("T-WD-2: you can't withdraw someone else's application, or one already decided", async () => {
    const id = (await apply({})).body.id;
    expect((await request(app).put(`/api/applications/${id}/withdraw`).set("Authorization", other())).status).toBe(404);
    expect((await request(app).put(`/api/applications/${id}/withdraw`).set("Authorization", staff())).status).toBe(403);
    await request(app).put(`/api/applications/${id}/approve`).set("Authorization", staff());
    expect((await request(app).put(`/api/applications/${id}/withdraw`).set("Authorization", adopter())).status).toBe(409);
  });
});

describe("Decided applications, notes and notifications (v2)", () => {
  test("T-DEC-1: staff list decided applications, newest decision first, with who decided", async () => {
    const id = (await apply({})).body.id;
    await request(app).put(`/api/applications/${id}/reject`).set("Authorization", staff());
    const res = await request(app).get("/api/applications?status=decided").set("Authorization", staff());
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ id, status: "Rejected", decidedBy: "staff@shelter.test" });
    expect(res.body[0].decidedAt).toBeTruthy();
    const all = await request(app).get("/api/applications?status=all").set("Authorization", staff());
    expect(all.body.length).toBeGreaterThan(res.body.length);
  });

  test("T-NOTES-1: staff keep private notes; applicants never see them", async () => {
    const id = (await apply({})).body.id;
    const res = await request(app).put(`/api/applications/${id}/notes`).set("Authorization", staff()).send({ notes: "Called landlord: OK." });
    expect(res.status).toBe(200);
    expect(res.body.staffNotes).toBe("Called landlord: OK.");
    const mine = await request(app).get("/api/applications/mine").set("Authorization", adopter());
    expect(JSON.stringify(mine.body)).not.toMatch(/landlord: OK/);
    expect((await request(app).put(`/api/applications/${id}/notes`).set("Authorization", adopter()).send({ notes: "x" })).status).toBe(403);
    expect((await request(app).put(`/api/applications/${id}/notes`).set("Authorization", staff()).send({ notes: "x".repeat(1001) })).status).toBe(400);
  });

  test("T-NOTIF-1: the applicant is notified when staff approve or reject, and can mark messages read", async () => {
    const id = (await apply({})).body.id;
    await request(app).put(`/api/applications/${id}/approve`).set("Authorization", staff());
    const res = await request(app).get("/api/notifications").set("Authorization", adopter());
    expect(res.status).toBe(200);
    expect(res.body.unread).toBe(1);
    expect(res.body.items[0]).toMatchObject({ link: "/my-applications", read: false });
    expect(res.body.items[0].message).toMatch(/Luna was approved/);
    const read = await request(app).post("/api/notifications/read").set("Authorization", adopter());
    expect(read.body.unread).toBe(0);
    expect((await request(app).get("/api/notifications").set("Authorization", other())).body.items).toEqual([]);
    expect((await request(app).get("/api/notifications")).status).toBe(401);
  });
});

describe("Walk-in adoptions and returns (v2)", () => {
  const patch = (name, body) =>
    request(app).patch(`/api/animals/${ids.animalIds[name]}/status`).set("Authorization", staff()).send(body);

  test("T-WALKIN-1: marking an animal Adopted by hand needs the adopter, and records an Approved application", async () => {
    const before = count("applications");
    const missing = await patch("Charlie", { status: "Adopted" });
    expect(missing.status).toBe(400);
    expect(missing.body.fields.adopterId).toBeTruthy();
    expect((await patch("Charlie", { status: "Adopted", adopterId: ids.staffId })).status).toBe(400);
    expect(count("applications")).toBe(before);

    const ok = await patch("Charlie", { status: "Adopted", adopterId: ids.otherAdopterId });
    expect(ok.status).toBe(200);
    const mine = await request(app).get("/api/applications/mine").set("Authorization", other());
    expect(mine.body.find((a) => a.animalName === "Charlie").status).toBe("Approved");
    const note = db.prepare("SELECT note FROM status_history WHERE animal_id = ? ORDER BY id DESC").get(ids.animalIds.Charlie).note;
    expect(note).toMatch(/Adopted by/);
  });

  test("T-WALKIN-2: the edit form can't mark an animal Adopted (no adopter there)", async () => {
    const res = await request(app)
      .put(`/api/animals/${ids.animalIds.Charlie}`)
      .set("Authorization", staff())
      .send({ name: "Charlie", species: "Dog", status: "Adopted" });
    expect(res.status).toBe(400);
    expect(await animalStatus("Charlie")).toBe("Available");
  });

  test("T-RETURN-1: an adopted animal returned to the shelter marks its adoption Returned", async () => {
    const id = (await apply({})).body.id;
    await request(app).put(`/api/applications/${id}/approve`).set("Authorization", staff());
    const res = await patch("Luna", { status: "Available", note: "Returned: allergies" });
    expect(res.status).toBe(200);
    const mine = await request(app).get("/api/applications/mine").set("Authorization", adopter());
    expect(mine.body.find((a) => a.id === id).status).toBe("Returned");
  });
});

describe("Upgrading an old database (v2)", () => {
  test("T-MIGRATE-1: the applications table accepts the new statuses", () => {
    const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'applications'").get().sql;
    expect(sql).toMatch(/'Withdrawn', 'Returned'/);
  });
});
