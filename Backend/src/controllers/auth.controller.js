const authService = require("../services/auth.service");

function login(req, res, next) {
  try {
    const { phone } = req.body || {};
    const result = authService.loginWithPhone(phone);
    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  login,
};
