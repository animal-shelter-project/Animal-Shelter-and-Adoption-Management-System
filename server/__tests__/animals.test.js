const request = require("supertest");
const { app, resetData } = require("../test-utils/testApp");

beforeEach(() => resetData());

const names = (res) => res.body.map((a) => a.name);

describe("GET /api/animals (US-01, FR-01)", () => {
  test("T-API-01: no filters returns every animal, all statuses", async () => {
    const res = await request(app).get("/api/animals");
    expect(res.status).toBe(200);
    expect(names(res)).toEqual(["Buddy", "Luna", "Max", "Daisy", "Charlie", "Bella", "Pip"]);
    expect(res.body[0]).toEqual(
      expect.objectContaining({ id: 1, name: "Buddy", species: "Dog", breed: "Labrador Retriever", age: 3, status: "Available" }),
    );
  });

  test("T-API-02: species filter is exact and case-insensitive", async () => {
    const res = await request(app).get("/api/animals?species=dog");
    expect(names(res)).toEqual(["Buddy", "Max", "Charlie"]);
  });

  test("T-API-03: breed filter is a partial, case-insensitive match", async () => {
    const res = await request(app).get("/api/animals?breed=SHEP");
    expect(names(res)).toEqual(["Max"]);
  });

  test("T-API-04: status filter, matched case-insensitively", async () => {
    expect(names(await request(app).get("/api/animals?status=Available"))).toEqual(["Buddy", "Luna", "Charlie", "Pip"]);
    expect(names(await request(app).get("/api/animals?status=pending"))).toEqual(["Max"]);
    expect(names(await request(app).get("/api/animals?status=Fostered"))).toEqual(["Bella"]);
  });

  test("T-API-05: filters combine", async () => {
    const res = await request(app).get("/api/animals?species=Dog&status=Available&breed=bea");
    expect(names(res)).toEqual(["Charlie"]);
  });

  test("T-API-06: no matches is 200 with an empty list", async () => {
    const res = await request(app).get("/api/animals?breed=Poodle");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("T-API-07: % and _ in a breed search are literal, not wildcards", async () => {
    expect(names(await request(app).get("/api/animals?breed=50%25"))).toEqual(["Pip"]);
    expect(names(await request(app).get("/api/animals?breed=%25"))).toEqual(["Pip"]);
    expect(names(await request(app).get("/api/animals?breed=_"))).toEqual(["Pip"]);
  });

  test("T-API-08: blank filters are ignored", async () => {
    const res = await request(app).get("/api/animals?species=%20%20&breed=&status=");
    expect(res.body).toHaveLength(7);
  });

  test("T-API-09: unknown status is 400 and lists the allowed values", async () => {
    const res = await request(app).get("/api/animals?status=Banana");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown status/);
    expect(res.body.allowed).toEqual(["Available", "Pending", "Adopted", "Fostered"]);
  });

  test("T-API-10: repeated or over-long filters are 400, not 500", async () => {
    expect((await request(app).get("/api/animals?species=Dog&species=Cat")).status).toBe(400);
    expect((await request(app).get(`/api/animals?breed=${"x".repeat(61)}`)).status).toBe(400);
  });

  test("T-API-11: SQL in a filter is treated as text", async () => {
    const res = await request(app).get("/api/animals?species=" + encodeURIComponent("Dog' OR '1'='1"));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/animals/:id (US-02, FR-02)", () => {
  test("T-API-12: existing id returns that animal", async () => {
    const res = await request(app).get("/api/animals/3");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ id: 3, name: "Max", status: "Pending" }));
  });

  test("T-API-13: unknown id is 404", async () => {
    const res = await request(app).get("/api/animals/999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Animal not found.");
  });

  test.each(["abc", "0", "-1", "1.5", "1e3", "99999999999"])(
    "T-API-14: malformed id %s is 400",
    async (id) => {
      const res = await request(app).get(`/api/animals/${id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid animal id.");
    },
  );
});

describe("General API behaviour", () => {
  test("T-API-15: health check", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("T-API-16: unknown route is JSON 404", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Route not found.");
  });

  test("T-API-17: CORS header is present for the browser client", async () => {
    const res = await request(app).get("/api/animals").set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBeDefined();
  });
});
