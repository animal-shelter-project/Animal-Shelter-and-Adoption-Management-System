const bcrypt = require("bcrypt");
const request = require("supertest");
const { app, db, resetData, tokenFor, PASSWORD } = require("../test-utils/testApp");

// v2: sign-up, contact details, password change and staff reset, staying
// logged in while active, and limits on password guessing.
let ids;
beforeEach(() => {
  ids = resetData();
});

const NEW = { email: "Jane@Example.com", password: "kibble-2026", name: "Jane Doe", phone: "(817) 555-0142", address: "12 Elm St, Arlington TX" };
const register = (body) => request(app).post("/api/auth/register").send(body);
const login = (email, password) => request(app).post("/api/auth/login").send({ email, password });
const bearer = (token) => `Bearer ${token}`;

describe("Sign-up (v2)", () => {
  test("T-REG-1: a visitor signs up as an Adopter and is logged in", async () => {
    const res = await register(NEW);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toEqual({
      id: res.body.user.id, email: "jane@example.com", role: "Adopter",
      name: "Jane Doe", phone: "(817) 555-0142", address: "12 Elm St, Arlington TX",
    });
    const mine = await request(app).get("/api/applications/mine").set("Authorization", bearer(res.body.token));
    expect(mine.status).toBe(200);
    expect((await login("jane@example.com", NEW.password)).status).toBe(200);
  });

  test("T-REG-2: sign-up can never create a Staff account", async () => {
    const res = await register({ ...NEW, role: "Staff" });
    expect(res.body.user.role).toBe("Adopter");
  });

  test("T-REG-3: missing or bad fields are a 400 for that field; nothing is saved", async () => {
    const before = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
    for (const [field, value] of [
      ["email", "not-an-email"],
      ["password", "short"],
      ["name", "  "],
      ["phone", "12"],
      ["phone", "call me"],
    ]) {
      const res = await register({ ...NEW, [field]: value });
      expect(res.status).toBe(400);
      expect(res.body.fields[field]).toBeTruthy();
    }
    expect(db.prepare("SELECT COUNT(*) AS n FROM users").get().n).toBe(before);
  });

  test("T-REG-4: an email that already has an account is a 409, any case", async () => {
    const res = await register({ ...NEW, email: "ADOPTER@shelter.test" });
    expect(res.status).toBe(409);
    expect(res.body.fields.email).toBeTruthy();
  });

  test("T-REG-5: the password is stored only as a bcrypt hash", async () => {
    await register(NEW);
    const row = db.prepare("SELECT password_hash FROM users WHERE email = ?").get("jane@example.com");
    expect(row.password_hash).not.toBe(NEW.password);
    expect(await bcrypt.compare(NEW.password, row.password_hash)).toBe(true);
  });
});

describe("Profile and passwords (v2)", () => {
  test("T-PROF-1: users see and update their own contact details", async () => {
    const token = tokenFor(ids.adopterId, "Adopter");
    const updated = await request(app)
      .put("/api/auth/me")
      .set("Authorization", bearer(token))
      .send({ name: "Alex Adopter", phone: "817-555-0100", address: "" });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual({ id: ids.adopterId, email: "adopter@shelter.test", role: "Adopter", name: "Alex Adopter", phone: "817-555-0100", address: "" });
    const me = await request(app).get("/api/auth/me").set("Authorization", bearer(token));
    expect(me.body.name).toBe("Alex Adopter");
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  test("T-PW-1: changing the password needs the current one and ends older sessions", async () => {
    const old = (await login("adopter@shelter.test", PASSWORD)).body.token;
    const wrong = await request(app)
      .put("/api/auth/password")
      .set("Authorization", bearer(old))
      .send({ currentPassword: "nope", newPassword: "new-password-1" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.fields.currentPassword).toBeTruthy();

    const short = await request(app)
      .put("/api/auth/password")
      .set("Authorization", bearer(old))
      .send({ currentPassword: PASSWORD, newPassword: "short" });
    expect(short.body.fields.newPassword).toBeTruthy();

    const ok = await request(app)
      .put("/api/auth/password")
      .set("Authorization", bearer(old))
      .send({ currentPassword: PASSWORD, newPassword: "new-password-1" });
    expect(ok.status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Authorization", bearer(old))).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", bearer(ok.body.token))).status).toBe(200);
    expect((await login("adopter@shelter.test", "new-password-1")).status).toBe(200);
    expect((await login("adopter@shelter.test", PASSWORD)).status).toBe(401);
  });

  test("T-PW-2: staff reset an adopter's password to a one-time temporary password", async () => {
    const staff = bearer(tokenFor(ids.staffId, "Staff"));
    const res = await request(app).post(`/api/users/${ids.adopterId}/reset-password`).set("Authorization", staff);
    expect(res.status).toBe(200);
    expect(res.body.temporaryPassword).toMatch(/^paws-[0-9a-f]{8}$/);
    expect((await login("adopter@shelter.test", res.body.temporaryPassword)).status).toBe(200);
    expect((await login("adopter@shelter.test", PASSWORD)).status).toBe(401);
  });

  test("T-PW-3: only staff can reset, and never another staff password", async () => {
    const adopter = bearer(tokenFor(ids.adopterId, "Adopter"));
    expect((await request(app).post(`/api/users/${ids.otherAdopterId}/reset-password`).set("Authorization", adopter)).status).toBe(403);
    const staff = bearer(tokenFor(ids.staffId, "Staff"));
    expect((await request(app).post(`/api/users/${ids.staffId}/reset-password`).set("Authorization", staff)).status).toBe(403);
    expect((await request(app).post("/api/users/999/reset-password").set("Authorization", staff)).status).toBe(404);
  });

  test("T-USERS-1: staff list adopter accounts and search them; never password hashes", async () => {
    const staff = bearer(tokenFor(ids.staffId, "Staff"));
    const all = await request(app).get("/api/users").set("Authorization", staff);
    expect(all.status).toBe(200);
    expect(all.body.map((u) => u.email)).toEqual(["adopter@shelter.test", "other@shelter.test"]);
    expect(JSON.stringify(all.body)).not.toMatch(/password/);
    const one = await request(app).get("/api/users?q=other").set("Authorization", staff);
    expect(one.body.map((u) => u.email)).toEqual(["other@shelter.test"]);
    expect((await request(app).get("/api/users").set("Authorization", bearer(tokenFor(ids.adopterId, "Adopter")))).status).toBe(403);
  });
});

describe("Sessions and password guessing (v2)", () => {
  test("T-SESS-1: an active user gets a fresh token without logging in again", async () => {
    const token = tokenFor(ids.staffId, "Staff", { expiresIn: "5m" });
    const res = await request(app).post("/api/auth/refresh").set("Authorization", bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe("Staff");
    expect((await request(app).post("/api/auth/refresh")).status).toBe(401);
  });

  test("T-LOCK-1: after 5 wrong passwords that email is locked for 15 minutes (429), even with the right password", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await login("adopter@shelter.test", "wrong")).status).toBe(401);
    }
    const locked = await login("adopter@shelter.test", PASSWORD);
    expect(locked.status).toBe(429);
    expect(locked.body.error).toMatch(/Too many failed attempts/);
    expect((await login("staff@shelter.test", PASSWORD)).status).toBe(200);
  });

  test("T-LOCK-2: a successful login clears earlier mistakes", async () => {
    for (let i = 0; i < 4; i += 1) await login("adopter@shelter.test", "wrong");
    expect((await login("adopter@shelter.test", PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i += 1) await login("adopter@shelter.test", "wrong");
    expect((await login("adopter@shelter.test", PASSWORD)).status).toBe(200);
  });
});
