const fs = require("fs");
const os = require("os");
const path = require("path");

// Photos go to a temporary folder, never the real server/uploads.
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "shelter-uploads-"));

const request = require("supertest");
const { app, db, resetData, tokenFor } = require("../test-utils/testApp");

// v2: richer animal profiles, photos, name search, breed suggestions,
// duplicate warning and archiving.
let ids;
beforeEach(() => {
  ids = resetData();
});

const staff = () => `Bearer ${tokenFor(ids.staffId, "Staff")}`;
const adopter = () => `Bearer ${tokenFor(ids.adopterId, "Adopter")}`;
const countAnimals = () => db.prepare("SELECT COUNT(*) AS n FROM animals").get().n;

const FULL = {
  name: "Rocky",
  species: "Dog",
  breed: "Boxer",
  age: 0,
  ageMonths: 4,
  sex: "Male",
  size: "Large",
  description: "Loves fetch and naps in the sun.",
  goodWithKids: true,
  goodWithDogs: false,
  goodWithCats: null,
  adoptionFee: 150,
};

const add = (body, auth = staff()) =>
  request(app).post("/api/animals").set("Authorization", auth).send(body);

// Smallest bytes that pass the PNG signature check.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);
const dataUrl = (bytes, mime = "image/png") => `data:${mime};base64,${bytes.toString("base64")}`;
const putPhoto = (id, image, auth = staff()) =>
  request(app).put(`/api/animals/${id}/photo`).set("Authorization", auth).send({ image });

describe("Animal details (v2)", () => {
  test("T-DETAILS-1: a new animal keeps every detail (sex, size, months, description, good with, fee)", async () => {
    const res = await add(FULL);
    expect(res.status).toBe(201);
    const { id, createdAt, ...saved } = res.body;
    expect(id).toBeTruthy();
    expect(createdAt).toBeTruthy();
    expect(saved).toEqual({ ...FULL, status: "Available", photoUrl: null, archived: false });

    const again = await request(app).get(`/api/animals/${id}`);
    expect(again.body.ageMonths).toBe(4);
    expect(again.body.goodWithCats).toBe(null);
  });

  test("T-DETAILS-2: details left out get safe defaults", async () => {
    const res = await add({ name: "Nibbles", species: "Rabbit" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      breed: "",
      age: 0,
      ageMonths: 0,
      sex: "Unknown",
      size: "",
      description: "",
      goodWithKids: null,
      adoptionFee: 0,
    });
  });

  test("T-DETAILS-3: bad values are a 400 for that field and nothing is saved", async () => {
    const before = countAnimals();
    for (const [field, value] of [
      ["sex", "Robot"],
      ["size", "Huge"],
      ["ageMonths", 12],
      ["ageMonths", -1],
      ["adoptionFee", -5],
      ["adoptionFee", 12.5],
      ["goodWithKids", "maybe"],
      ["description", "x".repeat(1001)],
    ]) {
      const res = await add({ ...FULL, name: `Bad ${field}`, [field]: value });
      expect(res.status).toBe(400);
      expect(res.body.fields[field]).toBeTruthy();
    }
    expect(countAnimals()).toBe(before);
  });

  test("T-DETAILS-4: editing some details keeps the others", async () => {
    const created = (await add(FULL)).body;
    const res = await request(app)
      .put(`/api/animals/${created.id}`)
      .set("Authorization", staff())
      .send({ name: "Rocky", species: "Dog", adoptionFee: 75, goodWithCats: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ adoptionFee: 75, goodWithCats: true, sex: "Male", ageMonths: 4, description: FULL.description });
  });
});

describe("Name search and breed suggestions (v2)", () => {
  test("T-NAME-1: ?name= finds animals by part of their name, any case", async () => {
    const res = await request(app).get("/api/animals?name=BUD");
    expect(res.status).toBe(200);
    expect(res.body.map((a) => a.name)).toEqual(["Buddy"]);
  });

  test("T-NAME-2: name search combines with the other filters and treats % and _ literally", async () => {
    expect((await request(app).get("/api/animals?name=a&species=Cat")).body.map((a) => a.name)).toEqual(["Luna", "Daisy"]);
    expect((await request(app).get("/api/animals?name=%25")).body).toEqual([]);
  });

  test("T-BREEDS-1: breed suggestions are the breeds already used, one per spelling, sorted", async () => {
    await add({ ...FULL, name: "Copy", breed: "labrador retriever" });
    const dogs = await request(app).get("/api/animals/breeds?species=dog");
    expect(dogs.status).toBe(200);
    expect(dogs.body).toEqual(["Beagle", "German Shepherd", "Labrador Retriever"]);
    const all = await request(app).get("/api/animals/breeds");
    expect(all.body).toContain("Holland Lop");
  });
});

describe("Duplicate warning (v2)", () => {
  test("T-DUP-1: adding a second Buddy the dog is a 409 naming the existing animal; nothing is saved", async () => {
    const before = countAnimals();
    const res = await add({ name: "buddy", species: "DOG", breed: "Lab" });
    expect(res.status).toBe(409);
    expect(res.body.duplicate).toMatchObject({ id: ids.animalIds.Buddy, name: "Buddy" });
    expect(countAnimals()).toBe(before);
  });

  test("T-DUP-2: staff can still add it on purpose, and the same name for another species is fine", async () => {
    expect((await add({ name: "Buddy", species: "Dog", allowDuplicate: true })).status).toBe(201);
    expect((await add({ name: "Buddy", species: "Cat" })).status).toBe(201);
  });
});

describe("Archiving (v2)", () => {
  test("T-ARCH-1: an archived animal disappears from the catalog and its public profile", async () => {
    const res = await request(app).delete(`/api/animals/${ids.animalIds.Luna}`).set("Authorization", staff());
    expect(res.status).toBe(200);
    expect(res.body.archived).toBe(true);

    const list = await request(app).get("/api/animals");
    expect(list.body.map((a) => a.name)).not.toContain("Luna");
    expect((await request(app).get(`/api/animals/${ids.animalIds.Luna}`)).status).toBe(404);
    const asAdopter = await request(app).get(`/api/animals/${ids.animalIds.Luna}`).set("Authorization", adopter());
    expect(asAdopter.status).toBe(404);
  });

  test("T-ARCH-2: staff still see it, can list archived animals, and can restore it", async () => {
    await request(app).delete(`/api/animals/${ids.animalIds.Luna}`).set("Authorization", staff());
    const profile = await request(app).get(`/api/animals/${ids.animalIds.Luna}`).set("Authorization", staff());
    expect(profile.status).toBe(200);
    expect(profile.body.archived).toBe(true);

    const withArchived = await request(app).get("/api/animals?archived=include").set("Authorization", staff());
    expect(withArchived.body.map((a) => a.name)).toContain("Luna");
    const publicTry = await request(app).get("/api/animals?archived=include");
    expect(publicTry.body.map((a) => a.name)).not.toContain("Luna");

    const restored = await request(app).post(`/api/animals/${ids.animalIds.Luna}/restore`).set("Authorization", staff());
    expect(restored.status).toBe(200);
    expect(restored.body.archived).toBe(false);
    expect((await request(app).get(`/api/animals/${ids.animalIds.Luna}`)).status).toBe(200);
  });

  test("T-ARCH-3: an animal with an application under review can't be archived; only staff can archive", async () => {
    const pending = await request(app).delete(`/api/animals/${ids.animalIds.Max}`).set("Authorization", staff());
    expect(pending.status).toBe(409);
    expect((await request(app).delete(`/api/animals/${ids.animalIds.Luna}`).set("Authorization", adopter())).status).toBe(403);
    expect((await request(app).delete(`/api/animals/${ids.animalIds.Luna}`)).status).toBe(401);
    expect((await request(app).post(`/api/animals/${ids.animalIds.Luna}/restore`).set("Authorization", staff())).status).toBe(409);
  });
});

describe("Photos (v2)", () => {
  test("T-PHOTO-1: staff upload a PNG; the profile points to it and it is served as an image", async () => {
    const res = await putPhoto(ids.animalIds.Buddy, dataUrl(PNG));
    expect(res.status).toBe(200);
    expect(res.body.photoUrl).toMatch(/^\/uploads\/animal-\d+-[0-9a-f]+\.png$/);

    const file = await request(app).get(res.body.photoUrl);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toMatch(/image\/png/);
  });

  test("T-PHOTO-2: files that aren't JPEG, PNG or WebP, or are over 2 MB, are refused", async () => {
    const text = await putPhoto(ids.animalIds.Buddy, dataUrl(Buffer.from("<script>alert(1)</script>")));
    expect(text.status).toBe(400);
    expect(text.body.fields.photo).toBeTruthy();
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    expect((await putPhoto(ids.animalIds.Buddy, dataUrl(big))).status).toBe(400);
    expect((await putPhoto(ids.animalIds.Buddy, "not a data url")).status).toBe(400);
    expect((await request(app).get(`/api/animals/${ids.animalIds.Buddy}`)).body.photoUrl).toBe(null);
  });

  test("T-PHOTO-3: a new photo replaces the old file, and removing it goes back to the portrait", async () => {
    const first = (await putPhoto(ids.animalIds.Buddy, dataUrl(PNG))).body.photoUrl;
    const second = (await putPhoto(ids.animalIds.Buddy, dataUrl(PNG))).body.photoUrl;
    expect(second).not.toBe(first);
    expect(fs.existsSync(path.join(process.env.UPLOAD_DIR, path.basename(first)))).toBe(false);

    const removed = await request(app).delete(`/api/animals/${ids.animalIds.Buddy}/photo`).set("Authorization", staff());
    expect(removed.body.photoUrl).toBe(null);
    expect(fs.existsSync(path.join(process.env.UPLOAD_DIR, path.basename(second)))).toBe(false);
  });

  test("T-PHOTO-4: only staff can change photos", async () => {
    expect((await putPhoto(ids.animalIds.Buddy, dataUrl(PNG), adopter())).status).toBe(403);
    expect((await putPhoto(999, dataUrl(PNG))).status).toBe(404);
  });
});
