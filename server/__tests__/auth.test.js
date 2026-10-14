const request = require("supertest");
const jwt = require("jsonwebtoken");
const { app, resetData, tokenFor, PASSWORD } = require("../test-utils/testApp");

let ids;
beforeEach(() => {
  ids = resetData();
});

const login = (body) => request(app).post("/api/auth/login").send(body);

describe("POST /api/auth/login (US-05)", () => {
  test("T-LOGIN-1: valid staff login returns a token and the user", async () => {
    const res = await login({ email: "staff@shelter.test", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: ids.staffId, email: "staff@shelter.test", role: "Staff" });
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload).toEqual(expect.objectContaining({ id: ids.staffId, role: "Staff" }));
    expect(payload.exp - payload.iat).toBe(2 * 60 * 60); // 2 hours
  });

  test("T-LOGIN-2: wrong password is 401", async () => {
    const res = await login({ email: "staff@shelter.test", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password.");
  });

  test("T-LOGIN-3: unknown email gets the same 401 message (no account guessing)", async () => {
    const res = await login({ email: "nobody@shelter.test", password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password.");
  });

  test("T-LOGIN-4: email is case-insensitive and trimmed", async () => {
    const res = await login({ email: "  Adopter@Shelter.TEST ", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("Adopter");
  });

  test("T-LOGIN-5: the password hash is never returned", async () => {
    const res = await login({ email: "staff@shelter.test", password: PASSWORD });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  test.each([
    [{}],
    [{ email: "staff@shelter.test" }],
    [{ password: PASSWORD }],
    [{ email: "   ", password: PASSWORD }],
    [{ email: 123, password: PASSWORD }],
  ])("T-LOGIN-6: missing or bad fields are 400 (%j)", async (body) => {
    const res = await login(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Email and password are required.");
  });

  test("T-LOGIN-7: malformed JSON is 400, not 500", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Request body is not valid JSON.");
  });
});

describe("requireAuth / requireRole (US-05)", () => {
  const mine = (token) => {
    const req = request(app).get("/api/applications/mine");
    return token ? req.set("Authorization", `Bearer ${token}`) : req;
  };

  test("T-AUTH-API-1: no token is 401", async () => {
    const res = await mine();
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Please log in to continue.");
  });

  test("T-AUTH-API-2: a tampered or garbage token is 401", async () => {
    expect((await mine("not-a-jwt")).status).toBe(401);
    const forged = jwt.sign({ id: ids.adopterId, role: "Adopter" }, "wrong-secret");
    expect((await mine(forged)).status).toBe(401);
  });

  test("T-AUTH-API-3: an expired token is 401 with a session-expired message", async () => {
    const expired = tokenFor(ids.adopterId, "Adopter", { expiresIn: -10 });
    const res = await mine(expired);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/session expired/i);
  });

  test("T-AUTH-API-4: a token for a deleted account is 401", async () => {
    const res = await mine(tokenFor(9999, "Adopter"));
    expect(res.status).toBe(401);
  });

  test("T-ROLE-1: a Staff token on an Adopter-only route is 403", async () => {
    const res = await mine(tokenFor(ids.staffId, "Staff"));
    expect(res.status).toBe(403);
  });

  test("T-ROLE-2: the role comes from the database, not the token", async () => {
    // A staff user whose token claims Adopter is still treated as Staff.
    const res = await mine(tokenFor(ids.staffId, "Adopter"));
    expect(res.status).toBe(403);
  });

  test("T-AUTH-API-5: 'Bearer' scheme is required", async () => {
    const token = tokenFor(ids.adopterId, "Adopter");
    const res = await request(app).get("/api/applications/mine").set("Authorization", `Token ${token}`);
    expect(res.status).toBe(401);
  });
});
