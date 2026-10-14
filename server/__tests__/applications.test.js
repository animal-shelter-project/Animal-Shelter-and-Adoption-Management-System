const request = require("supertest");
const { app, resetData, tokenFor } = require("../test-utils/testApp");

let ids;
beforeEach(() => {
  ids = resetData();
});

describe("GET /api/applications/mine", () => {
  test("T-MINE-1: an adopter sees only their own applications, newest first", async () => {
    const res = await request(app)
      .get("/api/applications/mine")
      .set("Authorization", `Bearer ${tokenFor(ids.adopterId, "Adopter")}`);
    expect(res.status).toBe(200);
    expect(res.body.map((a) => [a.animalName, a.status])).toEqual([
      ["Max", "Pending"],
      ["Daisy", "Approved"],
    ]);
    expect(res.body[0]).toEqual(
      expect.objectContaining({ animalId: ids.animalIds.Max, animalStatus: "Pending", submittedAt: "2026-10-10 10:00:00" }),
    );
  });

  test("T-MINE-2: an adopter with no applications gets an empty list", async () => {
    const { db } = require("../test-utils/testApp");
    db.prepare("DELETE FROM applications WHERE applicant_id = ?").run(ids.otherAdopterId);
    const res = await request(app)
      .get("/api/applications/mine")
      .set("Authorization", `Bearer ${tokenFor(ids.otherAdopterId, "Adopter")}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
