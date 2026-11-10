const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");
const { app, db, resetData, tokenFor } = require("../test-utils/testApp");
const { backupNow } = require("../src/backup");

// v2: appointments (proposal R-11), the staff dashboard and backups.
let ids;
beforeEach(() => {
  ids = resetData();
});

const staff = () => `Bearer ${tokenFor(ids.staffId, "Staff")}`;
const adopter = () => `Bearer ${tokenFor(ids.adopterId, "Adopter")}`;
const pad = (n) => String(n).padStart(2, "0");
// A local "YYYY-MM-DDTHH:MM" some days from now at hh:mm.
const at = (days, hh, mm = 0) => {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hh)}:${pad(mm)}`;
};
const book = (animal, body, auth = staff()) =>
  request(app).post(`/api/animals/${ids.animalIds[animal]}/appointments`).set("Authorization", auth).send(body);

describe("Appointments (proposal R-11, v2)", () => {
  test("T-APPT-1: staff book an appointment and see it on the animal", async () => {
    const res = await book("Buddy", { startsAt: at(2, 10), durationMinutes: 45, purpose: "vet visit", notes: "Annual check" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ animalName: "Buddy", startsAt: at(2, 10).replace("T", " "), durationMinutes: 45, purpose: "Vet visit", status: "Scheduled", createdBy: "staff@shelter.test" });
    const list = await request(app).get(`/api/animals/${ids.animalIds.Buddy}/appointments`).set("Authorization", staff());
    expect(list.body).toHaveLength(1);
  });

  test("T-APPT-2: an overlapping time for the same animal is a 409; back-to-back or another animal is fine", async () => {
    await book("Buddy", { startsAt: at(2, 10), durationMinutes: 60, purpose: "Vet visit" });
    const clash = await book("Buddy", { startsAt: at(2, 10, 30), purpose: "Grooming" });
    expect(clash.status).toBe(409);
    expect(clash.body.error).toMatch(/already has "Vet visit"/);
    expect((await book("Buddy", { startsAt: at(2, 11), purpose: "Grooming" })).status).toBe(201);
    expect((await book("Luna", { startsAt: at(2, 10, 30), purpose: "Grooming" })).status).toBe(201);
  });

  test("T-APPT-3: past times, impossible dates and bad fields are 400s", async () => {
    for (const [field, body] of [
      ["startsAt", { startsAt: at(-1, 10), purpose: "Other" }],
      ["startsAt", { startsAt: "2027-02-30T10:00", purpose: "Other" }],
      ["startsAt", { startsAt: "tomorrow", purpose: "Other" }],
      ["purpose", { startsAt: at(1, 10), purpose: "Party" }],
      ["durationMinutes", { startsAt: at(1, 10), purpose: "Other", durationMinutes: 600 }],
      ["notes", { startsAt: at(1, 10), purpose: "Other", notes: "x".repeat(301) }],
    ]) {
      const res = await book("Buddy", body);
      expect(res.status).toBe(400);
      expect(res.body.fields[field]).toBeTruthy();
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM appointments").get().n).toBe(0);
  });

  test("T-APPT-4: staff mark an appointment done or cancelled; a cancelled slot can be booked again", async () => {
    const id = (await book("Buddy", { startsAt: at(3, 9), purpose: "Vaccination" })).body.id;
    const res = await request(app).patch(`/api/appointments/${id}`).set("Authorization", staff()).send({ status: "Cancelled" });
    expect(res.body.status).toBe("Cancelled");
    expect((await request(app).patch(`/api/appointments/${id}`).set("Authorization", staff()).send({ status: "Done" })).status).toBe(409);
    expect((await book("Buddy", { startsAt: at(3, 9), purpose: "Vaccination" })).status).toBe(201);
  });

  test("T-APPT-5: only staff can see or book appointments", async () => {
    expect((await book("Buddy", { startsAt: at(1, 9), purpose: "Other" }, adopter())).status).toBe(403);
    expect((await request(app).get("/api/appointments").set("Authorization", adopter())).status).toBe(403);
    expect((await request(app).get(`/api/animals/${ids.animalIds.Buddy}/appointments`)).status).toBe(401);
  });
});

describe("Staff dashboard (v2)", () => {
  test("T-DASH-1: counts by status, pending applications, upcoming appointments and longest waiting", async () => {
    await book("Luna", { startsAt: at(1, 15), purpose: "Meet and greet" });
    await book("Charlie", { startsAt: at(20, 15), purpose: "Grooming" });
    const res = await request(app).get("/api/dashboard").set("Authorization", staff());
    expect(res.status).toBe(200);
    expect(res.body.animals).toEqual({ Available: 4, Pending: 1, Adopted: 1, Fostered: 1 });
    expect(res.body.pendingApplications).toBe(2);
    expect(res.body.upcomingAppointments.map((a) => a.animalName)).toEqual(["Luna"]);
    expect(res.body.longestWaiting[0].name).toBe("Buddy");
    expect((await request(app).get("/api/dashboard").set("Authorization", adopter())).status).toBe(403);
  });
});

describe("Backups (v2)", () => {
  test("T-BACKUP-1: a backup is a complete copy of the database, and only the newest are kept", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shelter-backups-"));
    for (let i = 0; i < 3; i += 1) fs.writeFileSync(path.join(dir, `shelter-2020010${i + 1}-000000.db`), "old");
    const file = backupNow(dir, 2);
    expect(fs.existsSync(file)).toBe(true);
    const kept = fs.readdirSync(dir).sort();
    expect(kept).toHaveLength(2);
    expect(kept).toContain(path.basename(file));
    expect(fs.readFileSync(file).subarray(0, 15).toString()).toBe("SQLite format 3");
  });
});
