const authService = require("../services/auth.service");

/**
 * POST /api/auth/register
 * Body: { phone, pin, fullName? }
 */
async function register(req, res, next) {
  try {
    const { phone, pin, fullName } = req.body || {};
    const result = await authService.register(phone, pin, fullName);
    return res.status(201).json({
      message: "Compte créé avec succès.",
      token: result.token,
      user: result.user,
    });
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

/**
 * POST /api/auth/send-otp
 * Body: { phone }
 */
async function sendOtp(req, res, next) {
  try {
    const { phone } = req.body || {};
    const result = await authService.sendOtp(phone);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/auth/verify-otp
 * Body: { phone, code }
 */
async function verifyOtp(req, res, next) {
  try {
    const { phone, code } = req.body || {};
    const result = await authService.verifyOtp(phone, code);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, sendOtp, verifyOtp };

