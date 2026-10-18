const request = require("supertest");
const { app, db, resetData, tokenFor } = require("../test-utils/testApp");
const { changeStatus, allowedManualChanges } = require("../src/services/AnimalStatusService");

// Proposal R-09 (status history) and R-12 (Fostered <-> Available).
let ids;
beforeEach(() => {
  ids = resetData();
});

const staff = () => `Bearer ${tokenFor(ids.staffId, "Staff")}`;
const adopter = () => `Bearer ${tokenFor(ids.adopterId, "Adopter")}`;
const history = (id, auth = staff()) => {
  const req = request(app).get(`/api/animals/${id}/history`);
  return auth ? req.set("Authorization", auth) : req;
};
const patch = (id, body, auth = staff()) => {
  const req = request(app).patch(`/api/animals/${id}/status`);
  if (auth) req.set("Authorization", auth);
  return req.send(body);
};

describe("Status history (proposal R-09)", () => {
  test("T-HIST-API-1: adding an animal starts its history, with who added it", async () => {
    const { body } = await request(app)
      .post("/api/animals")
      .set("Authorization", staff())
      .send({ name: "Rocky", species: "Dog", breed: "Boxer", age: 2 });
    const res = await history(body.id);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual(
      expect.objectContaining({ fromStatus: null, toStatus: "Available", changedBy: "staff@shelter.test" }),
    );
  });

  test("T-HIST-API-2: Available -> Fostered -> Available -> Adopted is recorded in order", async () => {
    const id = ids.animalIds.Buddy;
    for (const status of ["Fostered", "Available", "Adopted"]) {
      const res = await patch(id, { status, note: `to ${status}` });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }
    const res = await history(id);
    expect(res.body.map((h) => `${h.fromStatus}->${h.toStatus}`)).toEqual([
      "Available->Fostered",
      "Fostered->Available",
      "Available->Adopted",
    ]);
    expect(res.body[0].note).toBe("to Fostered");
    expect(res.body.every((h) => typeof h.changedAt === "string")).toBe(true);
  });

  test("T-HIST-API-3: a Pending animal can't be changed by hand (its application decides)", async () => {
    const res = await patch(ids.animalIds.Max, { status: "Available" });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/application under review/);
    expect((await history(ids.animalIds.Max)).body).toHaveLength(0);
  });

  test("T-HIST-API-4: staff can't set Pending by hand, or repeat the same status", async () => {
    expect((await patch(ids.animalIds.Buddy, { status: "Pending" })).status).toBe(409);
    const same = await patch(ids.animalIds.Buddy, { status: "available" });
    expect(same.status).toBe(409);
    expect(same.body.error).toMatch(/already Available/);
  });

  test("T-HIST-API-5: only staff can see history or change status", async () => {
    expect((await history(ids.animalIds.Buddy, null)).status).toBe(401);
    expect((await history(ids.animalIds.Buddy, adopter())).status).toBe(403);
    expect((await patch(ids.animalIds.Buddy, { status: "Fostered" }, adopter())).status).toBe(403);
  });

  test("T-HIST-API-6: bad input is a 400, unknown animals a 404", async () => {
    expect((await patch(ids.animalIds.Buddy, { status: "Lost" })).status).toBe(400);
    expect((await patch(ids.animalIds.Buddy, { status: "Fostered", note: "x".repeat(201) })).status).toBe(400);
    expect((await patch(9999, { status: "Fostered" })).status).toBe(404);
    expect((await history(9999)).status).toBe(404);
    expect((await history("abc")).status).toBe(400);
  });

  test("T-HIST-API-7: the helper used by the application workflow follows the same rules", () => {
    const max = ids.animalIds.Max; // Pending
    expect(changeStatus(max, "Adopted", { changedBy: ids.staffId, note: "Application approved" }).status).toBe("Adopted");
    expect(() => changeStatus(max, "Pending")).toThrow(/can't go from Adopted to Pending/);
    expect(allowedManualChanges("Available")).toEqual(["Fostered", "Adopted"]);
    expect(allowedManualChanges("Pending")).toEqual([]);
  });

  test("T-HIST-API-8: if writing the history fails, the status change is rolled back", () => {
    const buddy = ids.animalIds.Buddy;
    // A history row pointing at a missing user breaks the foreign key on purpose.
    expect(() => changeStatus(buddy, "Fostered", { changedBy: 999999 })).toThrow();
    const row = db.prepare("SELECT status FROM animals WHERE id = ?").get(buddy);
    expect(row.status).toBe("Available");
  });

  test("T-HIST-API-9: a status change made in the edit (PUT) is checked and logged", async () => {
    const id = ids.animalIds.Buddy;
    const res = await request(app)
      .put(`/api/animals/${id}`)
      .set("Authorization", staff())
      .send({ name: "Buddy", species: "Dog", age: 4, status: "Fostered" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ age: 4, status: "Fostered" }));
    const h = (await history(id)).body;
    expect(h.map((r) => `${r.fromStatus}->${r.toStatus}`)).toEqual(["Available->Fostered"]);
    expect(h[0].note).toBe("Edited by staff");
  });

  test("T-HIST-API-10: an edit that only changes details adds no history; a refused status change saves nothing", async () => {
    const buddy = ids.animalIds.Buddy;
    const ok = await request(app)
      .put(`/api/animals/${buddy}`)
      .set("Authorization", staff())
      .send({ name: "Buddy Boy", species: "Dog" });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual(expect.objectContaining({ name: "Buddy Boy", status: "Available" }));
    expect((await history(buddy)).body).toHaveLength(0);

    const max = ids.animalIds.Max; // Pending: its application decides
    const refused = await request(app)
      .put(`/api/animals/${max}`)
      .set("Authorization", staff())
      .send({ name: "Maxwell", species: "Dog", status: "Available" });
    expect(refused.status).toBe(409);
    const row = db.prepare("SELECT name, status FROM animals WHERE id = ?").get(max);
    expect(row).toEqual({ name: "Max", status: "Pending" });
  });
});
