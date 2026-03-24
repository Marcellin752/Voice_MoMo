const usersService = require("../services/users.service");

function getProfile(req, res) {
  return res.json(usersService.getProfile());
}

function updateProfile(req, res) {
  const profile = usersService.updateProfile(req.body || {});
  return res.json(profile);
}

function getLanguage(req, res) {
  return res.json(usersService.getLanguage());
}

function updateLanguage(req, res, next) {
  const { language } = req.body || {};
  if (language !== "fr" && language !== "en") {
    const error = new Error("La langue doit être 'fr' ou 'en'.");
    error.status = 400;
    return next(error);
  }
  return res.json(usersService.updateLanguage(language));
}

function updatePin(req, res, next) {
  const { oldPin, newPin, confirmPin } = req.body || {};
  if (!oldPin || !newPin || !confirmPin) {
    const error = new Error("oldPin, newPin et confirmPin sont requis.");
    error.status = 400;
    return next(error);
  }
  if (!/^\d{4}$/.test(String(newPin)) || !/^\d{4}$/.test(String(confirmPin))) {
    const error = new Error(
      "Le nouveau PIN doit contenir exactement 4 chiffres.",
    );
    error.status = 400;
    return next(error);
  }
  if (String(newPin) !== String(confirmPin)) {
    const error = new Error(
      "Le nouveau PIN et sa confirmation ne correspondent pas.",
    );
    error.status = 400;
    return next(error);
  }
  return res.json(usersService.updatePin());
}

function getSecurity(req, res) {
  return res.json(usersService.getSecurityState());
}
function getNotifications(req, res) {
  return res.json({ notifications: usersService.getNotifications() });
}

module.exports = {
  getProfile,
  updateProfile,
  getLanguage,
  updateLanguage,
  updatePin,
  getSecurity,
  getNotifications,
};
