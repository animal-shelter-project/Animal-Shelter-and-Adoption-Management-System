const fs = require("fs");
const os = require("os");
const path = require("path");

// Pictures go to a temporary folder, never the real server/uploads.
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "shelter-uploads-"));

const request = require("supertest");
const { app, db, resetData, tokenFor } = require("../test-utils/testApp");

// Pictures uploaded by users: a profile picture on the account, and photos
// of the adopter's home added to an adoption application.
let ids;
beforeEach(() => {
  ids = resetData();
});

const staff = () => `Bearer ${tokenFor(ids.staffId, "Staff")}`;
const adopter = () => `Bearer ${tokenFor(ids.adopterId, "Adopter")}`;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32, 2)]);
const dataUrl = (bytes, mime = "image/png") => `data:${mime};base64,${bytes.toString("base64")}`;
const fileExists = (url) => fs.existsSync(path.join(process.env.UPLOAD_DIR, path.basename(url)));

const ANSWERS = { homeType: "House", ownOrRent: "Own", hasYard: true, adults: 2, children: 0, hoursAlone: 4, otherPets: "" };
const apply = (body) =>
  request(app)
    .post("/api/applications")
    .set("Authorization", adopter())
    .send({ animalId: ids.animalIds.Luna, householdDetails: "Quiet house with a garden.", ...ANSWERS, ...body });

describe("Profile pictures", () => {
  test("T-AVATAR-1: a user uploads a profile picture; it is saved, served and shown in /me", async () => {
    const res = await request(app).put("/api/auth/me/photo").set("Authorization", adopter()).send({ image: dataUrl(PNG) });
    expect(res.status).toBe(200);
    expect(res.body.photoUrl).toMatch(/^\/uploads\/user-\d+-[0-9a-f]+\.png$/);
    expect(res.body.password_hash).toBeUndefined();

    const file = await request(app).get(res.body.photoUrl);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toMatch(/image\/png/);

    const me = await request(app).get("/api/auth/me").set("Authorization", adopter());
    expect(me.body.photoUrl).toBe(res.body.photoUrl);
  });

  test("T-AVATAR-2: a new picture replaces the old file; removing it goes back to initials", async () => {
    const first = (await request(app).put("/api/auth/me/photo").set("Authorization", staff()).send({ image: dataUrl(PNG) })).body.photoUrl;
    const second = (await request(app).put("/api/auth/me/photo").set("Authorization", staff()).send({ image: dataUrl(JPG, "image/jpeg") })).body.photoUrl;
    expect(second).toMatch(/\.jpg$/);
    expect(fileExists(first)).toBe(false);
    expect(fileExists(second)).toBe(true);

    const removed = await request(app).delete("/api/auth/me/photo").set("Authorization", staff());
    expect(removed.status).toBe(200);
    expect(removed.body.photoUrl).toBe(null);
    expect(fileExists(second)).toBe(false);
  });

  test("T-AVATAR-3: not an image, too big, or not logged in is refused and nothing is saved", async () => {
    const text = await request(app).put("/api/auth/me/photo").set("Authorization", adopter()).send({ image: dataUrl(Buffer.from("hello")) });
    expect(text.status).toBe(400);
    expect(text.body.fields.photo).toBe("Choose a JPEG, PNG or WebP photo.");
    const big = await request(app)
      .put("/api/auth/me/photo")
      .set("Authorization", adopter())
      .send({ image: dataUrl(Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)])) });
    expect(big.status).toBe(400);
    expect((await request(app).put("/api/auth/me/photo").send({ image: dataUrl(PNG) })).status).toBe(401);
    expect(db.prepare("SELECT photo FROM users WHERE id = ?").get(ids.adopterId).photo).toBe(null);
  });
});

describe("Home photos on an application", () => {
  test("T-HOME-1: an adopter adds home photos; they are saved with the application and staff see them", async () => {
    await request(app).put("/api/auth/me/photo").set("Authorization", adopter()).send({ image: dataUrl(PNG) });
    const res = await apply({ homePhotos: [dataUrl(PNG), dataUrl(JPG, "image/jpeg")] });
    expect(res.status).toBe(201);
    expect(res.body.homePhotos).toHaveLength(2);
    expect(res.body.homePhotos[0].url).toMatch(/^\/uploads\/home-[0-9a-f]+\.png$/);
    expect(res.body.homePhotos[1].url).toMatch(/\.jpg$/);
    res.body.homePhotos.forEach((p) => expect(fileExists(p.url)).toBe(true));

    const list = await request(app).get("/api/applications?status=pending").set("Authorization", staff());
    const mine = list.body.find((a) => a.id === res.body.id);
    expect(mine.homePhotos.map((p) => p.url)).toEqual(res.body.homePhotos.map((p) => p.url));
    expect(mine.applicantPhotoUrl).toMatch(/^\/uploads\/user-/);

    const own = await request(app).get("/api/applications/mine").set("Authorization", adopter());
    expect(own.body.find((a) => a.id === res.body.id).homePhotos).toHaveLength(2);
  });

  test("T-HOME-2: photos are optional; more than 3 or a non-image is refused and nothing is saved", async () => {
    const none = await apply({});
    expect(none.status).toBe(201);
    expect(none.body.homePhotos).toEqual([]);

    db.prepare("UPDATE animals SET status = 'Available' WHERE id = ?").run(ids.animalIds.Luna);
    db.prepare("DELETE FROM applications WHERE id = ?").run(none.body.id);
    const before = db.prepare("SELECT COUNT(*) AS n FROM applications").get().n;

    const four = await apply({ homePhotos: [1, 2, 3, 4].map(() => dataUrl(PNG)) });
    expect(four.status).toBe(400);
    expect(four.body.fields.homePhotos).toBe("Add up to 3 photos of your home.");
    const bad = await apply({ homePhotos: [dataUrl(PNG), dataUrl(Buffer.from("not an image"))] });
    expect(bad.status).toBe(400);
    expect(bad.body.fields.homePhotos).toBeTruthy();
    expect((await apply({ homePhotos: "a photo" })).status).toBe(400);

    expect(db.prepare("SELECT COUNT(*) AS n FROM applications").get().n).toBe(before);
    expect(db.prepare("SELECT COUNT(*) AS n FROM application_photos").get().n).toBe(0);
  });

  test("T-HOME-3: if the animal is no longer Available, the application and its photo files are not kept", async () => {
    const homeFiles = () => fs.readdirSync(process.env.UPLOAD_DIR).filter((f) => f.startsWith("home-")).sort();
    const filesBefore = homeFiles();
    const res = await request(app)
      .post("/api/applications")
      .set("Authorization", adopter())
      .send({ animalId: ids.animalIds.Max, householdDetails: "Quiet house.", ...ANSWERS, homePhotos: [dataUrl(PNG)] });
    expect(res.status).toBe(409);
    expect(db.prepare("SELECT COUNT(*) AS n FROM application_photos").get().n).toBe(0);
    expect(homeFiles()).toEqual(filesBefore);
  });
});
