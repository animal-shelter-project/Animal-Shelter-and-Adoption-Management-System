// TEMPORARY mock API for M1 front-end work, so the client can run before
// M3's real server is merged. No dependencies: `npm run mock-api`.
// Mimics the endpoints in the implementation plan on port 4000, with the
// data and status values from the team repo's server (Available, Pending,
// Adopted, Fostered).
// Once M3's server works, stop this and run the real one instead.
//
// Logins (password: password123):
//   adopter@shelter.test  (Adopter)
//   staff@shelter.test    (Staff)
//
// Options (environment variables) to rehearse edge cases:
//   MOCK_MODE=mongo     respond like a MongoDB backend: _id strings,
//                       { animals: [...] } wrappers, lowercase statuses
//   MOCK_DELAY=1500     add latency (ms) to every response
//   MOCK_TOKEN_TTL=60   issue JWT-shaped tokens that expire after N seconds
//                       (default 7200 = 2 h, as in the plan)
//   PORT=4000
//
// Staff can add animals: POST /api/animals (Add animal page).
//
// Extra dev-only endpoint to demo the status refresh (FR-08):
//   curl -X POST localhost:4000/api/mock/status -H "Content-Type: application/json" \
//        -d '{"id":1,"status":"Adopted"}'

import http from 'node:http';

const PORT = Number(process.env.PORT || 4000);
const MONGO = process.env.MOCK_MODE === 'mongo';
const DELAY = Number(process.env.MOCK_DELAY || 0);
const TTL = Number(process.env.MOCK_TOKEN_TTL || 7200);

// Mirrors server/src/seed.js (same logins, animals, statuses and
// applications). Real users have no name column.
const users = [
  { id: 1, email: 'staff@shelter.test', role: 'Staff' },
  { id: 2, email: 'adopter@shelter.test', role: 'Adopter' },
];

const animals = [
  { id: 1, name: 'Buddy', species: 'Dog', breed: 'Labrador Retriever', age: 3, status: 'Available' },
  { id: 2, name: 'Luna', species: 'Cat', breed: 'Domestic Shorthair', age: 2, status: 'Available' },
  { id: 3, name: 'Max', species: 'Dog', breed: 'German Shepherd', age: 5, status: 'Pending' },
  { id: 4, name: 'Daisy', species: 'Cat', breed: 'Siamese', age: 4, status: 'Adopted' },
  { id: 5, name: 'Charlie', species: 'Dog', breed: 'Beagle', age: 1, status: 'Available' },
  { id: 6, name: 'Bella', species: 'Rabbit', breed: 'Holland Lop', age: 1, status: 'Fostered' },
];

// Status history (R-09), oldest first. Mirrors server/src/seed.js.
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 19).replace('T', ' ');
let historyId = 0;
const history = [];
const addHistory = (animalId, fromStatus, toStatus, note, changedAt = ago(0)) =>
  history.push({ id: ++historyId, animalId, fromStatus, toStatus, note, changedAt, changedBy: 'staff@shelter.test' });
for (const [id, steps] of Object.entries({
  1: [['Available', 30, 'Added to the shelter']],
  2: [['Available', 25, 'Added to the shelter']],
  3: [['Available', 28, 'Added to the shelter'], ['Pending', 4, 'Adoption application submitted']],
  4: [['Available', 40, 'Added to the shelter'], ['Pending', 16, 'Adoption application submitted'], ['Adopted', 13, 'Application approved']],
  5: [['Available', 10, 'Added to the shelter']],
  6: [['Available', 21, 'Added to the shelter'], ['Fostered', 7, 'Went to a foster home']],
})) {
  let from = null;
  for (const [to, days, note] of steps) { addHistory(Number(id), from, to, note, ago(days)); from = to; }
}
// Same rules as server/src/services/AnimalStatusService.js (manual changes).
const MANUAL = { Available: ['Fostered', 'Adopted'], Fostered: ['Available', 'Adopted'], Adopted: ['Available'], Pending: [] };

const applications = [
  { id: 1, animalId: 4, adopterId: 2, status: 'Approved', submittedAt: '2026-10-01 10:00:00' },
  { id: 2, animalId: 3, adopterId: 2, status: 'Pending', submittedAt: '2026-10-10 10:00:00' },
];

// ---- Shape the output like SQLite (default) or MongoDB --------------------------
const oid = (n) => n.toString(16).padStart(24, '0'); // fake ObjectId
const outAnimal = (a) =>
  MONGO ? { _id: oid(a.id), ...omit(a, 'id'), status: a.status.toLowerCase() } : a;
const outUser = (u) => (MONGO ? { _id: oid(u.id), ...omit(u, 'id'), role: u.role.toLowerCase() } : u);
const outApp = (app) => {
  const animal = animals.find((a) => a.id === app.animalId);
  return MONGO
    ? { _id: oid(app.id), animalId: { _id: oid(animal.id), name: animal.name }, status: app.status.toLowerCase(), createdAt: app.submittedAt }
    : { ...app, animalName: animal.name, animalStatus: animal.status };
};
const findAnimal = (key) => animals.find((a) => (MONGO ? oid(a.id) === key : String(a.id) === key));
function omit(o, k) { const c = { ...o }; delete c[k]; return c; }

// ---- JWT-shaped token (unsigned; the mock only reads it back) --------------------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const makeToken = (u) =>
  `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: u.id, role: u.role, exp: Math.floor(Date.now() / 1000) + TTL })}.mock`;
function userFromToken(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  try {
    const p = JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString());
    if (p.exp * 1000 < Date.now()) return null;
    return users.find((u) => u.id === p.sub) || null;
  } catch {
    return null;
  }
}

// ---- HTTP plumbing -------------------------------------------------------------
function send(res, status, body) {
  setTimeout(() => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
    });
    res.end(body === undefined ? '' : JSON.stringify(body));
  }, status === 204 ? 0 : DELAY);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === 'GET' && path === '/api/health') return send(res, 200, { ok: true });

  if (req.method === 'GET' && path === '/api/animals') {
    const species = url.searchParams.get('species');
    const breed = url.searchParams.get('breed');
    const status = url.searchParams.get('status');
    const result = animals.filter(
      (a) =>
        (!species || a.species.toLowerCase() === species.toLowerCase()) &&
        (!breed || a.breed.toLowerCase().includes(breed.toLowerCase())) &&
        (!status || a.status.toLowerCase() === status.toLowerCase()),
    ).map(outAnimal);
    return send(res, 200, MONGO ? { animals: result, count: result.length } : result);
  }

  // Staff: status history and status changes (R-09 / R-12).
  const hist = /^\/api\/animals\/([^/]+)\/(history|status)$/.exec(path);
  if (hist && ((req.method === 'GET' && hist[2] === 'history') || (req.method === 'PATCH' && hist[2] === 'status'))) {
    const user = userFromToken(req);
    if (!user) return send(res, 401, { error: 'Please log in to continue.' });
    if (user.role !== 'Staff') return send(res, 403, { error: "You don't have permission to do that." });
    const animal = findAnimal(decodeURIComponent(hist[1]));
    if (!animal) return send(res, 404, { error: 'Animal not found.' });
    if (hist[2] === 'history') {
      return send(res, 200, history.filter((h) => h.animalId === animal.id).map((h) => { const copy = { ...h }; delete copy.animalId; return copy; }));
    }
    const { status, note } = await readBody(req);
    if (animal.status === 'Pending') {
      return send(res, 409, { error: `${animal.name} has an adoption application under review. Approve or reject the application instead.` });
    }
    if (!MANUAL[animal.status].includes(status)) {
      return send(res, 409, { error: `${animal.name} can't go from ${animal.status} to ${status}.` });
    }
    addHistory(animal.id, animal.status, status, typeof note === 'string' && note.trim() ? note.trim() : null);
    animal.status = status;
    return send(res, 200, MONGO ? { animal: outAnimal(animal) } : outAnimal(animal));
  }

  const one = /^\/api\/animals\/([^/]+)$/.exec(path);
  if (req.method === 'GET' && one) {
    const key = decodeURIComponent(one[1]);
    if (MONGO && !/^[0-9a-f]{24}$/i.test(key)) return send(res, 400, { message: 'Invalid animal id' });
    const animal = findAnimal(key);
    if (!animal) return send(res, 404, { error: 'Animal not found' });
    return send(res, 200, MONGO ? { animal: outAnimal(animal) } : outAnimal(animal));
  }

  // Staff add an animal (proposal R-01 / US-01). Same rules as the real server.
  if (req.method === 'POST' && path === '/api/animals') {
    const user = userFromToken(req);
    if (!user) return send(res, 401, { error: 'Please log in to continue.' });
    if (user.role !== 'Staff') return send(res, 403, { error: "You don't have permission to do that." });
    const body = await readBody(req);
    const fields = {};
    const text = (k, label, max) => {
      const v = typeof body[k] === 'string' ? body[k].trim().replace(/\s+/g, ' ') : '';
      if (!v) fields[k] = `${label} is required.`;
      else if (v.length > max) fields[k] = `${label} must be ${max} characters or fewer.`;
      return v;
    };
    const name = text('name', 'Name', 60);
    const species = text('species', 'Species', 40);
    const breed = text('breed', 'Breed', 60);
    const age = Number(String(body.age ?? '').trim());
    if (String(body.age ?? '').trim() === '' || !Number.isInteger(age) || age < 0 || age > 40) {
      fields.age = 'Age must be a whole number of years, 0 or more.';
    }
    const status = body.status || 'Available';
    if (!['Available', 'Pending', 'Adopted', 'Fostered'].includes(status)) fields.status = 'Unknown status.';
    if (Object.keys(fields).length) return send(res, 400, { error: 'Please fix the highlighted fields.', fields });
    const animal = { id: Math.max(...animals.map((a) => a.id)) + 1, name, species, breed, age, status };
    animals.push(animal);
    addHistory(animal.id, null, animal.status, 'Added to the shelter');
    return send(res, 201, MONGO ? { animal: outAnimal(animal) } : outAnimal(animal));
  }

  if (req.method === 'POST' && path === '/api/auth/login') {
    const { email, password } = await readBody(req);
    const user = users.find((u) => u.email === String(email || '').toLowerCase());
    if (!user || password !== 'password123') return send(res, 401, { error: 'Invalid email or password' });
    return send(res, 200, { token: makeToken(user), user: outUser(user) });
  }

  if (req.method === 'GET' && path === '/api/applications/mine') {
    const user = userFromToken(req);
    if (!user) return send(res, 401, { error: 'Not logged in' });
    if (user.role !== 'Adopter') return send(res, 403, { error: "You don't have permission to do that." });
    const list = applications.filter((a) => a.adopterId === user.id).reverse().map(outApp);
    return send(res, 200, MONGO ? { applications: list } : list);
  }

  // Dev-only: change an animal's status to demo the badge refresh.
  if (req.method === 'POST' && path === '/api/mock/status') {
    const { id, status } = await readBody(req);
    const animal = animals.find((a) => a.id === Number(id));
    if (!animal) return send(res, 404, { error: 'Animal not found' });
    animal.status = status;
    return send(res, 200, outAnimal(animal));
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(PORT, () =>
  console.log(`Mock API (${MONGO ? 'mongo' : 'sqlite'} shape) at http://localhost:${PORT}/api`),
);
