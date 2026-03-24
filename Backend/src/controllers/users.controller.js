const usersService = require("../services/users.service");

async function getProfile(req, res, next) {
  try {
    const profile = await usersService.getProfile(req.user.userId);
    return res.json(profile);
  } catch (err) {
    return next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const profile = await usersService.updateProfile(req.user.userId, req.body || {});
    return res.json(profile);
  } catch (err) {
    return next(err);
  }
}

function getLanguage(req, res) {
  return res.json(usersService.getLanguage(req.user.userId));
}

function updateLanguage(req, res, next) {
  const { language } = req.body || {};
  if (language !== "fr" && language !== "en") {
    const error = new Error("La langue doit être 'fr' ou 'en'.");
    error.status = 400;
    return next(error);
  }
  return res.json(usersService.updateLanguage(req.user.userId, language));
}

async function updatePin(req, res, next) {
  const { oldPin, newPin, confirmPin } = req.body || {};
  if (!oldPin || !newPin || !confirmPin) {
    const error = new Error("oldPin, newPin et confirmPin sont requis.");
    error.status = 400;
    return next(error);
  }
  if (!/^\d{4}$/.test(String(newPin)) || !/^\d{4}$/.test(String(confirmPin))) {
    const error = new Error("Le nouveau PIN doit contenir exactement 4 chiffres.");
    error.status = 400;
    return next(error);
  }
  if (String(newPin) !== String(confirmPin)) {
    const error = new Error("Le nouveau PIN et sa confirmation ne correspondent pas.");
    error.status = 400;
    return next(error);
  }
  try {
    const result = await usersService.updatePin(req.user.userId, newPin);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

function getSecurity(req, res) {
  return res.json(usersService.getSecurityState());
}

async function getNotifications(req, res, next) {
  try {
    const notifications = await usersService.getNotifications(req.user.userId);
    return res.json({ notifications });
  } catch (err) {
    return next(err);
  }
}

async function getBalance(req, res, next) {
  try {
    const result = await usersService.getBalance(req.user.userId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  getLanguage,
  updateLanguage,
  updatePin,
  getSecurity,
  getNotifications,
  getBalance,
};
