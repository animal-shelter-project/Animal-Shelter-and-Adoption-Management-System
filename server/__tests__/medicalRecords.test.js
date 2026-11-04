const request = require("supertest");
const { app, db, resetData, tokenFor } = require("../test-utils/testApp");

let ids;
beforeEach(() => {
  ids = resetData();
});

const staff = () => `Bearer ${tokenFor(ids.staffId, "Staff")}`;
const adopter = () => `Bearer ${tokenFor(ids.adopterId, "Adopter")}`;

const postRecord = (animalId, body, auth = staff()) => {
  const req = request(app).post(`/api/animals/${animalId}/medical-records`);
  if (auth) req.set("Authorization", auth);
  return req.send(body);
};

const getRecords = (animalId, auth = staff()) => {
  const req = request(app).get(`/api/animals/${animalId}/medical-records`);
  if (auth) req.set("Authorization", auth);
  return req;
};

describe("Medical records (proposal R-10 / US-10)", () => {
  test("T-MED-API-1: staff can create a record and retrieve it for that animal", async () => {
    const animalId = ids.animalIds.Buddy;
    const created = await postRecord(animalId, {
      recordDate: "2026-10-20",
      recordType: "Vaccination",
      notes: "Rabies vaccine administered",
    });

    expect(created.status).toBe(201);
    expect(created.body).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        animalId,
        recordDate: "2026-10-20",
        recordType: "Vaccination",
        notes: "Rabies vaccine administered",
        createdAt: expect.any(String),
      }),
    );

    const listed = await getRecords(animalId);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toEqual(created.body);

    // Records belong only to the animal in the URL.
    expect((await getRecords(ids.animalIds.Luna)).body).toEqual([]);
  });

  test("T-MED-API-2: records are listed newest first, with newest ID first on equal dates", async () => {
    const animalId = ids.animalIds.Buddy;
    const older = await postRecord(animalId, {
      recordDate: "2026-10-19",
      recordType: "Checkup",
    });
    const sameDateFirst = await postRecord(animalId, {
      recordDate: "2026-10-20",
      recordType: "Vaccination",
    });
    const sameDateSecond = await postRecord(animalId, {
      recordDate: "2026-10-20",
      recordType: "Medication",
    });

    expect([older.status, sameDateFirst.status, sameDateSecond.status]).toEqual([201, 201, 201]);
    const listed = await getRecords(animalId);
    expect(listed.body.map((record) => record.id)).toEqual([
      sameDateSecond.body.id,
      sameDateFirst.body.id,
      older.body.id,
    ]);
  });

  test("T-MED-API-3: invalid record fields or a non-object body return 400", async () => {
    const animalId = ids.animalIds.Buddy;

    for (const body of [
      { recordDate: "not-a-date", recordType: "Checkup" },
      { recordDate: "2026-02-30", recordType: "Checkup" },
      { recordDate: "2026-10-20", recordType: "   " },
      { recordDate: "2026-10-20" },
      { recordDate: "2026-10-20", recordType: "Checkup", notes: 7 },
    ]) {
      const res = await postRecord(animalId, body);
      expect(res.status).toBe(400);
      expect(res.body.error).toEqual(expect.any(String));
    }

    const nullBody = await request(app)
      .post(`/api/animals/${animalId}/medical-records`)
      .set("Authorization", staff())
      .set("Content-Type", "application/json")
      .send("null");
    expect(nullBody.status).toBe(400);
    expect(nullBody.body.error).toEqual(expect.any(String));
  });

  test("T-MED-API-4: medical records require Staff authentication for both endpoints", async () => {
    const animalId = ids.animalIds.Buddy;
    const body = { recordDate: "2026-10-20", recordType: "Checkup" };

    expect((await postRecord(animalId, body, null)).status).toBe(401);
    expect((await getRecords(animalId, null)).status).toBe(401);
    expect((await postRecord(animalId, body, adopter())).status).toBe(403);
    expect((await getRecords(animalId, adopter())).status).toBe(403);
  });

  test("T-MED-API-5: invalid animal IDs return 400 and unknown animals return 404", async () => {
    const body = { recordDate: "2026-10-20", recordType: "Checkup" };

    expect((await postRecord("abc", body)).status).toBe(400);
    expect((await getRecords("abc")).status).toBe(400);
    expect((await postRecord(9999, body)).status).toBe(404);
    expect((await getRecords(9999)).status).toBe(404);
  });

  test("T-MED-API-6: deleting an animal cascades to its medical records", async () => {
    const animalId = ids.animalIds.Buddy;
    const created = await postRecord(animalId, {
      recordDate: "2026-10-20",
      recordType: "Checkup",
    });
    expect(created.status).toBe(201);

    // Clear the other animal relationships so the animal itself can be deleted.
    db.prepare("DELETE FROM applications WHERE animal_id = ?").run(animalId);
    db.prepare("DELETE FROM status_history WHERE animal_id = ?").run(animalId);
    db.prepare("DELETE FROM animals WHERE id = ?").run(animalId);
    const row = db.prepare("SELECT id FROM medical_records WHERE id = ?").get(created.body.id);
    expect(row).toBeUndefined();
  });
});
