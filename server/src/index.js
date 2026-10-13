const express = require("express");
const cors = require("cors");

require("./db");

const animalRoutes = require("./routes/animals");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Animal Shelter API is running.",
  });
});

app.use("/api/animals", animalRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found.",
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});