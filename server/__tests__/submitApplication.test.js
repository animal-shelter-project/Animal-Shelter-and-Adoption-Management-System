const request = require("supertest");
const { app, db, resetData, tokenFor } = require("../test-utils/testApp");

// Proposal R-05, R-08 / US-05: adopters submit applications (POST /api/applications).
let ids;
beforeEach(() => {
  ids = resetData();
});

const adopter = () => `Bearer ${tokenFor(ids.adopterId, "Adopter")}`;
const staff = () => `Bearer ${tokenFor(ids.staffId, "Staff")}`;
const apply = (body, auth = adopter()) => {
  const req = request(app).post("/api/applications");
  if (auth) req.set("Authorization", auth);
  return req.send(body);
};
const countApplications = () => db.prepare("SELECT COUNT(*) AS n FROM applications").get().n;
const animalStatus = async (id) => (await request(app).get(`/api/animals/${id}`)).body.status;

describe("Submit an adoption application (proposal R-05, R-08)", () => {
  test("T-APPLY-1: an adopter applies for an Available animal; the application and animal are Pending", async () => {
    const id = ids.animalIds.Luna;
    const res = await apply({ animalId: id, householdDetails: "Two adults, a fenced yard." });
    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({ animalId: id, status: "Pending", applicantId: ids.adopterId }),
    );
    expect(await animalStatus(id)).toBe("Pending");
    const history = db
      .prepare("SELECT to_status FROM status_history WHERE animal_id = ? ORDER BY id DESC")
      .get(id);
    expect(history.to_status).toBe("Pending");
  });

  test("T-APPLY-2: an animal that is not Available is a 409 and nothing is saved", async () => {
    const before = countApplications();
    for (const name of ["Max", "Daisy", "Bella"]) {
      // Max is Pending, Daisy is Adopted, Bella is Fostered
      const res = await apply({ animalId: ids.animalIds[name], householdDetails: "Home" });
      expect(res.status).toBe(409);
    }
    expect(countApplications()).toBe(before);
  });

  test("T-APPLY-3: missing, empty or oversized input is a 400 and nothing is saved", async () => {
    const before = countApplications();
    const luna = ids.animalIds.Luna;
    expect((await apply({})).status).toBe(400);
    expect((await apply([])).status).toBe(400);
    expect((await apply({ animalId: luna })).status).toBe(400);
    expect((await apply({ animalId: luna, householdDetails: "   " })).status).toBe(400);
    expect((await apply({ animalId: "abc", householdDetails: "Home" })).status).toBe(400);
    expect((await apply({ animalId: luna, householdDetails: "x".repeat(1001) })).status).toBe(400);
    expect(countApplications()).toBe(before);
    expect(await animalStatus(luna)).toBe("Available");
  });

  test("T-APPLY-4: an unknown animal is a 404", async () => {
    expect((await apply({ animalId: 9999, householdDetails: "Home" })).status).toBe(404);
  });

  test("T-APPLY-5: only logged-in adopters can apply", async () => {
    const body = { animalId: ids.animalIds.Luna, householdDetails: "Home" };
    expect((await apply(body, null)).status).toBe(401);
    expect((await apply(body, staff())).status).toBe(403);
  });

  test("T-APPLY-6: the applicant comes from the token, not the request body", async () => {
    const res = await apply({
      animalId: ids.animalIds.Luna,
      householdDetails: "Home",
      applicantId: ids.otherAdopterId,
    });
    expect(res.status).toBe(201);
    expect(res.body.applicantId).toBe(ids.adopterId);
  });

  test("T-APPLY-7: a second application for the same animal is a 409", async () => {
    const body = { animalId: ids.animalIds.Luna, householdDetails: "Home" };
    expect((await apply(body)).status).toBe(201);
    expect((await apply(body)).status).toBe(409);
  });
});