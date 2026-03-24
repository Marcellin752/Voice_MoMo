require("dotenv").config();

const express = require("express");
const authRoutes = require("./routes/auth.routes");
const usersRoutes = require("./routes/users.routes");
const transactionsRoutes = require("./routes/transactions.routes");
const voiceRoutes = require("./routes/voice.routes");

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares globaux
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

// Routes
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "voicemomo-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/voice", voiceRoutes);

// Error 404
app.use((req, res) => {
  res.status(404).json({ error: "Route introuvable." });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "Erreur interne.";
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

// Démarrage
app.listen(PORT, () => {
  console.log(`VoiceMomo backend running on http://localhost:${PORT}`);
});
