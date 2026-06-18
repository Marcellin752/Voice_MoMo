const express = require("express");
const mmiController = require("../controllers/mmi.controller");
const auth = require("../middleware/auth");

const router = express.Router();

// Tous les endpoints MMI nécessitent l'authentification
router.use(auth);

// ─── Routes des Réseaux ──────────────────────────────────────────────────

// Récupérer tous les réseaux disponibles
router.get("/networks", mmiController.getAllNetworks);

// Récupérer le réseau préféré de l'utilisateur
router.get("/networks/preferred", mmiController.getPreferredNetwork);

// Définir le réseau préféré de l'utilisateur
router.post("/networks/preferred", mmiController.setPreferredNetwork);

// Récupérer les statistiques globales des réseaux
router.get("/networks/stats", mmiController.getNetworkStats);

// ─── Routes des Codes MMI ──────────────────────────────────────────────────

// Récupérer tous les codes MMI pour un réseau
router.get("/codes/:networkCode", mmiController.getMMICodesByNetwork);

// Récupérer un code MMI spécifique
router.get("/codes/:networkCode/:codeType", mmiController.getMMICode);

// ─── Routes d'Exécution MMI ──────────────────────────────────────────────────

// Exécuter un code MMI
router.post("/execute", mmiController.executeMMI);

// Récupérer l'historique des exécutions MMI
router.get("/executions/history", mmiController.getExecutionHistory);

// Récupérer les statistiques des exécutions MMI
router.get("/executions/stats", mmiController.getExecutionStats);

module.exports = router;
