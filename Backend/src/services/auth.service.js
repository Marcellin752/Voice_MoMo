const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;

// Structure : { phone -> { id, phone, pinHash } }
const usersDB = {};

/**
 * Inscrit un utilisateur (crée un hash de son PIN).
 * @param {string} phone
 * @param {string} pin   — 4 chiffres
 * @returns {{ id, phone }}
 */
async function register(phone, pin) {
  const cleaned = _cleanPhone(phone);
  _validatePhone(cleaned);
  _validatePin(pin);

  if (usersDB[cleaned]) {
    const err = new Error("Ce numéro est déjà enregistré.");
    err.status = 409;
    throw err;
  }

  const pinHash = await bcrypt.hash(String(pin), ROUNDS);
  const user = { id: `u_${Date.now()}`, phone: cleaned, pinHash };
  usersDB[cleaned] = user;

  return { id: user.id, phone: user.phone };
}

/**
 * Connecte un utilisateur et retourne un JWT signé.
 * @param {string} phone
 * @param {string} pin
 * @returns {{ token: string, user: { id, phone } }}
 */
async function login(phone, pin) {
  const cleaned = _cleanPhone(phone);
  _validatePhone(cleaned);
  _validatePin(pin);

  const user = usersDB[cleaned];
  if (!user) {
    const err = new Error("Numéro introuvable.");
    err.status = 404;
    throw err;
  }

  const match = await bcrypt.compare(String(pin), user.pinHash);
  if (!match) {
    const err = new Error("PIN incorrect.");
    err.status = 401;
    throw err;
  }

  const token = jwt.sign(
    { userId: user.id, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );

  return { token, user: { id: user.id, phone: user.phone } };
}

// Helpers privés

function _cleanPhone(phone) {
  return String(phone || "").replace(/\s+/g, "");
}

function _validatePhone(cleaned) {
  if (cleaned.length < 8) {
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

module.exports = { register, login };
