const request = require("supertest");
const { app, db, resetData, tokenFor } = require("../test-utils/testApp");

// Proposal R-06, R-07 / US-06, US-07: staff review applications
// (GET /api/applications, PUT /api/applications/:id/approve and /reject).
let ids;
beforeEach(() => {
  ids = resetData();
});

const staff = () => `Bearer ${tokenFor(ids.staffId, "Staff")}`;
const adopter = () => `Bearer ${tokenFor(ids.adopterId, "Adopter")}`;

const decide = (id, action, auth = staff()) => {
  const req = request(app).put(`/api/applications/${id}/${action}`);
  if (auth) req.set("Authorization", auth);
  return req.send();
};
const applicationFor = (name) =>
  db.prepare("SELECT id FROM applications WHERE animal_id = ?").get(ids.animalIds[name]).id;
const applicationStatus = (id) =>
  db.prepare("SELECT status FROM applications WHERE id = ?").get(id).status;
const animalStatus = async (name) =>
  (await request(app).get(`/api/animals/${ids.animalIds[name]}`)).body.status;
const lastHistory = (name) =>
  db
    .prepare("SELECT to_status, changed_by FROM status_history WHERE animal_id = ? ORDER BY id DESC")
    .get(ids.animalIds[name]);

// In the test data, Max is Pending and has a Pending application.
describe("Staff review applications (proposal R-06, R-07)", () => {
  test("T-REVIEW-1: approving sets the application to Approved and the animal to Adopted", async () => {
    const id = applicationFor("Max");
    const res = await decide(id, "approve");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ id, status: "Approved" }));
    expect(applicationStatus(id)).toBe("Approved");
    expect(await animalStatus("Max")).toBe("Adopted");
    expect(lastHistory("Max")).toEqual({ to_status: "Adopted", changed_by: ids.staffId });
  });

  test("T-REVIEW-2: rejecting sets the application to Rejected and returns the animal to Available", async () => {
    const id = applicationFor("Max");
    const res = await decide(id, "reject");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("Rejected");
    expect(applicationStatus(id)).toBe("Rejected");
    expect(await animalStatus("Max")).toBe("Available");
    expect(lastHistory("Max").to_status).toBe("Available");
  });

  test("T-REVIEW-3: a second decision on the same application is a 409 and changes nothing", async () => {
    const id = applicationFor("Max");
    expect((await decide(id, "approve")).status).toBe(200);
    expect((await decide(id, "approve")).status).toBe(409);
    expect((await decide(id, "reject")).status).toBe(409);
    expect(applicationStatus(id)).toBe("Approved");
    expect(await animalStatus("Max")).toBe("Adopted");
  });

  test("T-REVIEW-4: an unknown application is a 404 and a bad ID is a 400", async () => {
    expect((await decide(9999, "approve")).status).toBe(404);
    expect((await decide(9999, "reject")).status).toBe(404);
    expect((await decide("abc", "approve")).status).toBe(400);
  });

  test("T-REVIEW-5: only logged-in staff can review", async () => {
    const id = applicationFor("Max");
    for (const action of ["approve", "reject"]) {
      expect((await decide(id, action, null)).status).toBe(401);
      expect((await decide(id, action, adopter())).status).toBe(403);
    }
    expect(applicationStatus(id)).toBe("Pending");
  });

  test("T-REVIEW-6: staff list only Pending applications, with the animal and applicant", async () => {
    const res = await request(app).get("/api/applications?status=Pending").set("Authorization", staff());
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((a) => a.status === "Pending")).toBe(true);
    const max = res.body.find((a) => a.id === applicationFor("Max"));
    expect(max).toEqual(
      expect.objectContaining({ animalName: "Max", applicantEmail: "adopter@shelter.test" }),
    );
    expect(res.body.map((a) => a.id)).not.toContain(applicationFor("Daisy")); // Approved
  });

  test("T-REVIEW-7: the list is staff only and supports only status=Pending", async () => {
    expect((await request(app).get("/api/applications")).status).toBe(401);
    expect(
      (await request(app).get("/api/applications").set("Authorization", adopter())).status,
    ).toBe(403);
    expect(
      (await request(app).get("/api/applications?status=Approved").set("Authorization", staff())).status,
    ).toBe(400);
  });

  test("T-REVIEW-8: a decision that can't be applied to the animal rolls everything back", async () => {
    // Buddy is Available but has a Pending application, so Available -> Available fails.
    const id = applicationFor("Buddy");
    expect((await decide(id, "reject")).status).toBe(409);
    expect(applicationStatus(id)).toBe("Pending");
    expect(await animalStatus("Buddy")).toBe("Available");
  });

  test("T-REVIEW-9: apply, then approve (the full adoption path, R-05 to R-07)", async () => {
    const apply = await request(app)
      .post("/api/applications")
      .set("Authorization", adopter())
      .send({ animalId: ids.animalIds.Luna, householdDetails: "Two adults, a yard." });
    expect(apply.status).toBe(201);
    expect(await animalStatus("Luna")).toBe("Pending");

    expect((await decide(apply.body.id, "approve")).status).toBe(200);
    expect(await animalStatus("Luna")).toBe("Adopted");

    const mine = await request(app).get("/api/applications/mine").set("Authorization", adopter());
    expect(mine.body.find((a) => a.id === apply.body.id).status).toBe("Approved");
  });
});