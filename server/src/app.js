const express = require("express");
const cors = require("cors");
const HttpError = require("./utils/HttpError");
const { CLIENT_ORIGIN } = require("./config");

require("./db");

// The Express app without app.listen(), so tests can use it with Supertest.
const app = express();

app.disable("x-powered-by");
app.use(cors(CLIENT_ORIGIN ? { origin: CLIENT_ORIGIN } : undefined));
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Animal Shelter API is running.",
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/animals", require("./routes/animals"));
app.use("/api/applications", require("./routes/applications"));

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found.",
  });
});

// Every error becomes JSON { error } with the right status. Express 5 also
// sends errors thrown from async handlers here.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large." });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details || {}) });
  }
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Something went wrong on the server." });
});

module.exports = app;
