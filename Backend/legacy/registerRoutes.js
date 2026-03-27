/**
 * Enregistre les routes API Voice MoMo historiques (auth, users, transactions, voice, mmi).
 * @param {import("express").Express} app
 */
function registerLegacyRoutes(app) {
  const authRoutes = require("./routes/auth.routes");
  const usersRoutes = require("./routes/users.routes");
  const transactionsRoutes = require("./routes/transactions.routes");
  const voiceRoutes = require("./routes/voice.routes");
  const mmiRoutes = require("./routes/mmi.routes");

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "voicemomo-backend" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/transactions", transactionsRoutes);
  app.use("/api/voice", voiceRoutes);
  app.use("/api/mmi", mmiRoutes);
}

module.exports = { registerLegacyRoutes };
