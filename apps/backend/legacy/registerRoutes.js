/**
 * Enregistre les routes API Voice MoMo historiques (auth, users, transactions, voice, mmi).
 * @param {import("express").Express} app
 */
function registerLegacyRoutes(app) {
  const path = require("path");
  const fs = require("fs");
  const express = require("express");
  const authRoutes = require("./routes/auth.routes");
  const usersRoutes = require("./routes/users.routes");
  const transactionsRoutes = require("./routes/transactions.routes");
  const voiceRoutes = require("./routes/voice.routes");
  const mmiRoutes = require("./routes/mmi.routes");

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "voicemomo-backend" });
  });

  // Page d’install Village de l’Innovation (QR) — fichiers dans apps/backend/public/installer
  // (copiés depuis docs/installer). Fallback : docs/installer à la racine du monorepo.
  const installerCandidates = [
    path.join(__dirname, "../public/installer"),
    path.join(__dirname, "../../../docs/installer"),
  ];
  const installerDir = installerCandidates.find((d) => fs.existsSync(path.join(d, "index.html")));
  if (installerDir) {
    app.use(
      "/installer",
      express.static(installerDir, {
        index: "index.html",
        fallthrough: false,
        setHeaders(res, filePath) {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "public, max-age=300");
          }
        },
      })
    );
  }

  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/transactions", transactionsRoutes);
  app.use("/api/voice", voiceRoutes);
  app.use("/api/mmi", mmiRoutes);
}

module.exports = { registerLegacyRoutes };
