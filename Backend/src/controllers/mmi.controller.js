const mmiService = require("../services/mmi.service");
const networkService = require("../services/network.service");

/**
 * Récupère tous les réseaux disponibles
 */
async function getAllNetworks(req, res, next) {
  try {
    const networks = await networkService.getAllNetworks();
    return res.json({ networks });
  } catch (err) {
    return next(err);
  }
}

/**
 * Définit le réseau préféré de l'utilisateur
 */
async function setPreferredNetwork(req, res, next) {
  try {
    const { networkCode } = req.body;

    if (!networkCode) {
      const error = new Error("Le code du réseau est requis");
      error.status = 400;
      return next(error);
    }

    const network = await networkService.setUserPreferredNetwork(
      req.user.userId,
      networkCode
    );

    return res.json({
      message: "Réseau préféré mis à jour",
      network
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Récupère le réseau préféré de l'utilisateur
 */
async function getPreferredNetwork(req, res, next) {
  try {
    const network = await networkService.getUserPreferredNetwork(req.user.userId);

    if (!network) {
      return res.json({ network: null, message: "Aucun réseau préféré défini" });
    }

    return res.json({ network });
  } catch (err) {
    return next(err);
  }
}

/**
 * Récupère tous les codes MMI disponibles pour un réseau
 */
async function getMMICodesByNetwork(req, res, next) {
  try {
    const { networkCode } = req.params;

    if (!networkCode) {
      const error = new Error("Le code du réseau est requis");
      error.status = 400;
      return next(error);
    }

    const codes = await mmiService.getMMICodesByNetwork(networkCode);

    return res.json({
      networkCode,
      codes,
      total: codes.length
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Récupère un code MMI spécifique
 */
async function getMMICode(req, res, next) {
  try {
    const { networkCode, codeType } = req.params;

    if (!networkCode || !codeType) {
      const error = new Error("Le code du réseau et le type de code sont requis");
      error.status = 400;
      return next(error);
    }

    const code = await mmiService.getMMICode(networkCode, codeType);

    return res.json({ code });
  } catch (err) {
    return next(err);
  }
}

/**
 * Exécute un code MMI sur le téléphone de l'utilisateur
 */
async function executeMMI(req, res, next) {
  try {
    const { networkCode, codeType, destinationNumber, amount } = req.body;

    if (!networkCode || !codeType) {
      const error = new Error("Le code du réseau et le type de code sont requis");
      error.status = 400;
      return next(error);
    }

    // Valider le réseau
    await networkService.getNetworkByCode(networkCode);

    // Valider que le réseau est actif
    const isActive = await networkService.isNetworkActive(networkCode);
    if (!isActive) {
      const error = new Error(`Le réseau ${networkCode} n'est pas disponible`);
      error.status = 503;
      throw error;
    }

    // Exécuter le code MMI
    const result = await mmiService.executeMMI(
      req.user.userId,
      networkCode,
      codeType,
      { destinationNumber, amount }
    );

    return res.status(201).json({
      message: "Code MMI exécuté avec succès",
      execution: result
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Récupère l'historique des exécutions MMI de l'utilisateur
 */
async function getExecutionHistory(req, res, next) {
  try {
    const { networkCode } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const history = await mmiService.getExecutionHistory(
      req.user.userId,
      networkCode,
      limit
    );

    return res.json({
      total: history.length,
      history
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Récupère les statistiques des exécutions MMI
 */
async function getExecutionStats(req, res, next) {
  try {
    const stats = await mmiService.getExecutionStats(req.user.userId);

    return res.json({ stats });
  } catch (err) {
    return next(err);
  }
}

/**
 * Récupère les statistiques globales des réseaux
 */
async function getNetworkStats(req, res, next) {
  try {
    const stats = await networkService.getNetworkStats();

    return res.json({ stats });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAllNetworks,
  setPreferredNetwork,
  getPreferredNetwork,
  getMMICodesByNetwork,
  getMMICode,
  executeMMI,
  getExecutionHistory,
  getExecutionStats,
  getNetworkStats
};
