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

const putRecord = (animalId, recordId, body, auth = staff()) => {
  const req = request(app).put(`/api/animals/${animalId}/medical-records/${recordId}`);
  if (auth) req.set("Authorization", auth);
  return req.send(body);
};

const deleteRecord = (animalId, recordId, auth = staff()) => {
  const req = request(app).delete(`/api/animals/${animalId}/medical-records/${recordId}`);
  if (auth) req.set("Authorization", auth);
  return req;
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

  test("T-MED-API-7: staff can correct a record; fields left out keep their value", async () => {
    const animalId = ids.animalIds.Buddy;
    const created = await postRecord(animalId, {
      recordDate: "2026-10-20",
      recordType: "Vaccination",
      notes: "Rabies vacine",
    });

    const fixed = await putRecord(animalId, created.body.id, { notes: "  Rabies vaccine, next due 2027  " });
    expect(fixed.status).toBe(200);
    expect(fixed.body).toEqual({
      ...created.body,
      notes: "Rabies vaccine, next due 2027",
    });

    const moved = await putRecord(animalId, created.body.id, { recordDate: "2026-10-18", recordType: "Check-up" });
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ recordDate: "2026-10-18", recordType: "Check-up", notes: "Rabies vaccine, next due 2027" });
    expect((await getRecords(animalId)).body).toEqual([moved.body]);
  });

  test("T-MED-API-8: invalid changes return 400 and leave the record unchanged", async () => {
    const animalId = ids.animalIds.Buddy;
    const created = await postRecord(animalId, { recordDate: "2026-10-20", recordType: "Checkup" });

    for (const body of [
      { recordDate: "2026-02-30" },
      { recordType: "  " },
      { notes: 7 },
      [],
    ]) {
      const res = await putRecord(animalId, created.body.id, body);
      expect(res.status).toBe(400);
      expect(res.body.error).toEqual(expect.any(String));
    }
    expect((await getRecords(animalId)).body).toEqual([created.body]);
  });

  test("T-MED-API-9: staff can delete a record entered by mistake", async () => {
    const animalId = ids.animalIds.Buddy;
    const keep = await postRecord(animalId, { recordDate: "2026-10-19", recordType: "Checkup" });
    const mistake = await postRecord(animalId, { recordDate: "2026-10-20", recordType: "Vaccination" });

    const res = await deleteRecord(animalId, mistake.body.id);
    expect(res.status).toBe(204);
    expect((await getRecords(animalId)).body).toEqual([keep.body]);
    expect((await deleteRecord(animalId, mistake.body.id)).status).toBe(404);
  });

  test("T-MED-API-10: edit and delete need Staff, the right animal and a real record", async () => {
    const animalId = ids.animalIds.Buddy;
    const created = await postRecord(animalId, { recordDate: "2026-10-20", recordType: "Checkup" });
    const id = created.body.id;

    expect((await putRecord(animalId, id, { notes: "x" }, null)).status).toBe(401);
    expect((await deleteRecord(animalId, id, null)).status).toBe(401);
    expect((await putRecord(animalId, id, { notes: "x" }, adopter())).status).toBe(403);
    expect((await deleteRecord(animalId, id, adopter())).status).toBe(403);

    // A record can only be changed through its own animal.
    expect((await putRecord(ids.animalIds.Luna, id, { notes: "x" })).status).toBe(404);
    expect((await deleteRecord(ids.animalIds.Luna, id)).status).toBe(404);
    expect((await putRecord(animalId, 9999, { notes: "x" })).status).toBe(404);
    expect((await putRecord(animalId, "abc", { notes: "x" })).status).toBe(400);
    expect((await deleteRecord("abc", id)).status).toBe(400);

    expect((await getRecords(animalId)).body).toEqual([created.body]);
  });
});
