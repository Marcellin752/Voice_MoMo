const authService = require("../services/auth.service");

/**
 * POST /api/auth/register
 * Body: { phone, pin }
 */
async function register(req, res, next) {
  try {
    const { phone, pin } = req.body || {};
    const user = await authService.register(phone, pin);
    return res.status(201).json({ message: "Compte créé avec succès.", user });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/auth/login
 * Body: { phone, pin }
 */
async function login(req, res, next) {
  try {
    const { phone, pin } = req.body || {};
    const result = await authService.login(phone, pin);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login };
