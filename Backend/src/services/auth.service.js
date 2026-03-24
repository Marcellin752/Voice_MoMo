const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;

async function register(phone, pin, fullName) {
  const cleaned = _cleanPhone(phone);
  _validatePhone(cleaned);
  _validatePin(pin);

  if (!fullName || String(fullName).trim().length < 2) {
    const err = new Error("Le nom complet est requis (minimum 2 caractères).");
    err.status = 400;
    throw err;
  }

  const existing = await db.query(
    "SELECT id FROM users WHERE phone_number = $1",
    [cleaned],
  );
  if (existing.rows.length > 0) {
    const err = new Error("Ce numéro de téléphone est déjà enregistré.");
    err.status = 409;
    throw err;
  }

  const pinHash = await bcrypt.hash(String(pin), ROUNDS);
  const result = await db.query(
    `INSERT INTO users (full_name, phone_number, pin_hash)
     VALUES ($1, $2, $3)
     RETURNING id, full_name, phone_number, balance, currency, created_at`,
    [fullName.trim(), cleaned, pinHash],
  );

  const user = result.rows[0];
  const token = _generateToken(user);
  await _saveSession(user.id, token);

  return { token, user: _formatUser(user) };
}

async function login(phone, pin) {
  const cleaned = _cleanPhone(phone);
  _validatePhone(cleaned);
  _validatePin(pin);

  const result = await db.query(
    "SELECT * FROM users WHERE phone_number = $1 AND is_active = TRUE",
    [cleaned],
  );

  if (result.rows.length === 0) {
    const err = new Error("Numéro introuvable ou compte désactivé.");
    err.status = 404;
    throw err;
  }

  const user = result.rows[0];
  const match = await bcrypt.compare(String(pin), user.pin_hash);

  if (!match) {
    const err = new Error("PIN incorrect.");
    err.status = 401;
    throw err;
  }

  const token = _generateToken(user);
  await _saveSession(user.id, token);

  return { token, user: _formatUser(user) };
}

async function logout(token) {
  await db.query("UPDATE sessions SET revoked = TRUE WHERE token = $1", [
    token,
  ]);
}

async function verifyToken(token) {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const error = new Error(
      err.name === "TokenExpiredError"
        ? "Session expirée, veuillez vous reconnecter."
        : "Token invalide.",
    );
    error.status = 401;
    throw error;
  }

  const result = await db.query(
    `SELECT id FROM sessions
     WHERE token = $1 AND revoked = FALSE AND expires_at > NOW()`,
    [token],
  );

  if (result.rows.length === 0) {
    const err = new Error("Session révoquée ou expirée.");
    err.status = 401;
    throw err;
  }

  return { userId: decoded.userId, phone: decoded.phone };
}

function _cleanPhone(phone) {
  return String(phone || "").replace(/\s+/g, "");
}

function _validatePhone(c) {
  if (c.length < 8) {
    const err = new Error("Numéro de téléphone invalide (minimum 8 chiffres).");
    err.status = 400;
    throw err;
  }
}

function _validatePin(pin) {
  if (!pin || !/^\d{4}$/.test(String(pin))) {
    const err = new Error("Le PIN doit contenir exactement 4 chiffres.");
    err.status = 400;
    throw err;
  }
}

function _generateToken(user) {
  return jwt.sign(
    { userId: user.id, phone: user.phone_number },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

async function _saveSession(userId, token) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query(
    "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
    [userId, token, expiresAt],
  );
}

function _formatUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    phone: user.phone_number,
    balance: parseFloat(user.balance || 0),
    currency: user.currency,
    createdAt: user.created_at,
  };
}

module.exports = { register, login, logout, verifyToken };
