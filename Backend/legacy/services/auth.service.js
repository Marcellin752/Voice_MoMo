const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;

// ─── Détection de la DB ───────────────────────────────────────────────────────
let _dbAvailable = null;

async function _isDbAvailable() {
  if (_dbAvailable !== null) return _dbAvailable;
  try {
    await db.query("SELECT 1");
    _dbAvailable = true;
    console.log("[auth] Base de données connectée.");
  } catch {
    _dbAvailable = false;
    console.warn("[auth] Base de données indisponible — mode in-memory activé.");
  }
  return _dbAvailable;
}

// ─── Store in-memory (fallback sans DB) ──────────────────────────────────────
// Map<phone, { id, fullName, phone, pinHash, balance, currency }>
const _users = new Map();
let _userIdCounter = 1;

// ─── Fonctions publiques ──────────────────────────────────────────────────────

async function register(phone, pin, fullName) {
  const cleaned = _cleanPhone(phone);
  _validatePhone(cleaned);
  _validatePin(pin);

  const name =
    fullName && String(fullName).trim().length >= 2
      ? String(fullName).trim()
      : cleaned;

  const useDb = await _isDbAvailable();

  if (useDb) {
    const existing = await db.query(
      "SELECT id FROM users WHERE phone_number = $1",
      [cleaned]
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
      [name, cleaned, pinHash]
    );

    const user = result.rows[0];
    const token = _generateToken(user.id, user.phone_number);
    await _saveSession(user.id, token);
    return { token, user: _formatDbUser(user) };
  }

  // Mode in-memory
  if (_users.has(cleaned)) {
    const err = new Error("Ce numéro de téléphone est déjà enregistré.");
    err.status = 409;
    throw err;
  }

  const pinHash = await bcrypt.hash(String(pin), ROUNDS);
  const id = `u_${_userIdCounter++}`;
  const userData = { id, fullName: name, phone: cleaned, pinHash, balance: 15000, currency: "FCFA" };
  _users.set(cleaned, userData);

  const token = _generateToken(id, cleaned);
  return { token, user: { id, fullName: name, phone: cleaned, balance: 15000, currency: "FCFA" } };
}

async function login(phone, pin) {
  const cleaned = _cleanPhone(phone);
  _validatePhone(cleaned);
  _validatePin(pin);

  const useDb = await _isDbAvailable();

  if (useDb) {
    const result = await db.query(
      "SELECT * FROM users WHERE phone_number = $1 AND is_active = TRUE",
      [cleaned]
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

    const token = _generateToken(user.id, user.phone_number);
    await _saveSession(user.id, token);
    return { token, user: _formatDbUser(user) };
  }

  // Mode in-memory
  const userData = _users.get(cleaned);
  if (!userData) {
    const err = new Error("Numéro introuvable ou compte désactivé.");
    err.status = 404;
    throw err;
  }

  const match = await bcrypt.compare(String(pin), userData.pinHash);
  if (!match) {
    const err = new Error("PIN incorrect.");
    err.status = 401;
    throw err;
  }

  const token = _generateToken(userData.id, cleaned);
  return {
    token,
    user: { id: userData.id, fullName: userData.fullName, phone: cleaned, balance: userData.balance, currency: userData.currency },
  };
}

async function logout(token) {
  const useDb = await _isDbAvailable();
  if (useDb) {
    await db.query("UPDATE sessions SET revoked = TRUE WHERE token = $1", [token]);
  }
}

// ─── Helpers privés ───────────────────────────────────────────────────────────

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

function _generateToken(userId, phone) {
  return jwt.sign(
    { userId, phone },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function _saveSession(userId, token) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query(
    "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
    [userId, token, expiresAt]
  );
}

function _formatDbUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    phone: user.phone_number,
    balance: parseFloat(user.balance || 0),
    currency: user.currency,
  };
}

// Expose le store in-memory pour que users.service puisse y accéder
function _getInMemoryUser(phone) {
  return _users.get(String(phone).replace(/\s+/g, ""));
}

function _getInMemoryUserById(userId) {
  for (const u of _users.values()) {
    if (u.id === userId) return u;
  }
  return null;
}

function _updateInMemoryUser(userId, data) {
  for (const [phone, u] of _users.entries()) {
    if (u.id === userId) {
      if (data.fullName) u.fullName = data.fullName;
      if (data.phone) {
        _users.delete(phone);
        u.phone = data.phone;
        _users.set(data.phone, u);
      }
      return u;
    }
  }
  return null;
}

function _updateInMemoryPin(userId, pinHash) {
  for (const u of _users.values()) {
    if (u.id === userId) {
      u.pinHash = pinHash;
      return true;
    }
  }
  return false;
}

const _otps = new Map(); // phone -> { code, expiresAt }

async function sendOtp(phone) {
  const cleaned = _cleanPhone(phone);
  _validatePhone(cleaned);

  // Générer un code à 4 chiffres
  const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  _otps.set(cleaned, { code: otpCode, expiresAt });
  console.log(`🔑 [OTP] Code OTP généré pour ${cleaned} : ${otpCode}`);

  return { 
    success: true, 
    message: "Code OTP envoyé par SMS.",
    // Pour faciliter la démo et le dev, on renvoie le code dans la réponse
    code: otpCode
  };
}

async function verifyOtp(phone, code) {
  const cleaned = _cleanPhone(phone);
  _validatePhone(cleaned);

  const stored = _otps.get(cleaned);
  if (!stored) {
    const err = new Error("Code OTP expiré ou inexistant. Veuillez en demander un nouveau.");
    err.status = 400;
    throw err;
  }

  if (new Date() > stored.expiresAt) {
    _otps.delete(cleaned);
    const err = new Error("Code OTP expiré.");
    err.status = 400;
    throw err;
  }

  if (String(stored.code) !== String(code)) {
    const err = new Error("Code OTP incorrect.");
    err.status = 400;
    throw err;
  }

  // Code valide, supprimer
  _otps.delete(cleaned);

  const useDb = await _isDbAvailable();
  let user = null;

  if (useDb) {
    const existing = await db.query(
      "SELECT * FROM users WHERE phone_number = $1 AND is_active = TRUE",
      [cleaned]
    );
    if (existing.rows.length > 0) {
      user = _formatDbUser(existing.rows[0]);
    }
  } else {
    const memUser = _users.get(cleaned);
    if (memUser) {
      user = { id: memUser.id, fullName: memUser.fullName, phone: cleaned, balance: memUser.balance, currency: memUser.currency };
    }
  }

  // Si l'utilisateur n'existe pas, on l'inscrit automatiquement
  if (!user) {
    console.log(`👤 [OTP] Nouvel utilisateur détecté (${cleaned}), inscription automatique...`);
    const shortPhone = cleaned.slice(-4);
    const defaultName = `Utilisateur ${shortPhone}`;
    const regResult = await register(cleaned, "0000", defaultName);
    return { token: regResult.token, user: regResult.user };
  }

  // Si l'utilisateur existe déjà, on génère une session
  console.log(`👤 [OTP] Utilisateur existant connecté : ${cleaned}`);
  const token = _generateToken(user.id, cleaned);
  
  if (useDb) {
    await _saveSession(user.id, token);
  }

  return { token, user };
}

module.exports = {
  register,
  login,
  logout,
  sendOtp,
  verifyOtp,
  _isDbAvailable,
  _getInMemoryUserById,
  _updateInMemoryUser,
  _updateInMemoryPin,
};

