const jwt = require("jsonwebtoken");

/**
 * Middleware d'authentification JWT.
 * Vérifie le header Authorization: Bearer <token>
 * Attache req.user = { userId, phone } si valide.
 */

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Token manquant." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decoded.userId, phone: decoded.phone };
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Session expirée, veuillez vous reconnecter." });
    }
    return res.status(401).json({ error: "Token invalide." });
  }
}

module.exports = authenticate;
