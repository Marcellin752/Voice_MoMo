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

// ─── Gestion SMS Provider ──────────────────────────────────────────────────────

async function _sendSms(phone, message) {
  try {
    // 1. Alternative : TWILIO (Recommandé pour tester sans blocage de Sender ID)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      
      const formData = new URLSearchParams();
      // On s'assure que le numéro a le format international E.164
      let formattedPhone = phone.replace(/\D/g, ''); // Nettoyage sécurité
      
      if (formattedPhone.length === 10 && formattedPhone.startsWith('0')) {
        // Ex: 0157311172 (Format 10 chiffres Ivoirien/Africain classique)
        // On force l'indicatif +225 pour la Côte d'Ivoire (ou +229 si c'était le cas)
        // L'utilisateur peut aussi définir process.env.DEFAULT_COUNTRY_CODE dans Render
        const countryCode = process.env.DEFAULT_COUNTRY_CODE || "229";
        formattedPhone = `+${countryCode}${formattedPhone}`;
      } else if (formattedPhone.length === 8) {
        // Numéro local béninois classique (8 chiffres)
        const countryCode = process.env.DEFAULT_COUNTRY_CODE || "229";
        formattedPhone = `+${countryCode}${formattedPhone}`;
      } else {
        // S'il a déjà l'indicatif (ex: 2299012..., 336...)
        formattedPhone = `+${formattedPhone.replace(/^0+/, '')}`;
      }
      
      formData.append("To", formattedPhone);
      formData.append("From", process.env.TWILIO_PHONE_NUMBER);
      formData.append("Body", message);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData.toString()
      });
      
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        console.error("❌ [SMS] Échec de l'envoi via Twilio:", data || response.statusText);
      } else {
        console.log(`✅ [SMS] Message Twilio envoyé avec succès à ${phone} !`);
      }
      return;
    }

    // 2. Alternative : TERMII (Avec support de SMS_SENDER_ID)
    if (process.env.SMS_API_KEY) {
      const termiiUrl = process.env.SMS_PROVIDER_URL || "https://api.ng.termii.com/api/sms/send";
      
      const response = await fetch(termiiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: phone,
          from: process.env.SMS_SENDER_ID || "N-Alert", // Sender ID dynamique via .env (ex: "Termii")
          sms: message,
          type: "plain",
          channel: "generic",
          api_key: process.env.SMS_API_KEY
        })
      });
      
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        console.error("❌ [SMS] Échec de l'envoi via Termii:", data || response.statusText);
      } else {
        console.log(`✅ [SMS] Message Termii envoyé avec succès à ${phone} ! ID:`, data?.message_id);
      }
      return;
    }

    // 3. Mode Simulation
    console.log(`⚠️ [SMS] Aucun provider configuré. Simulation de l'envoi SMS à ${phone} : "${message}"`);
  } catch (err) {
    console.error("❌ [SMS] Erreur réseau lors de l'envoi du SMS :", err.message);
  }
}

// ─── Envoi et Vérification OTP ───────────────────────────────────────────────

const _otps = new Map(); // Fallback in-memory

async function sendOtp(phone) {
  const cleaned = _cleanPhone(phone);
  _validatePhone(cleaned);

  const useDb = await _isDbAvailable();

  if (useDb) {
    // Vérifier la limitation des tentatives (anti-spam : pas plus de 3 codes non expirés dans les 15 dernières minutes)
    const recent = await db.query(
      "SELECT count(*) FROM otps WHERE phone_number = $1 AND created_at > NOW() - INTERVAL '15 minutes'",
      [cleaned]
    );
    if (parseInt(recent.rows[0].count, 10) >= 3) {
      const err = new Error("Trop de tentatives. Veuillez patienter avant de demander un nouveau code.");
      err.status = 429;
      throw err;
    }
  }

  // Générer un code sécurisé à 6 chiffres
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  if (useDb) {
    // Invalider les anciens OTP non utilisés pour ce numéro
    await db.query("UPDATE otps SET is_used = TRUE WHERE phone_number = $1 AND is_used = FALSE", [cleaned]);
    // Insérer le nouveau
    await db.query(
      "INSERT INTO otps (phone_number, code, expires_at) VALUES ($1, $2, $3)",
      [cleaned, otpCode, expiresAt]
    );
  } else {
    _otps.set(cleaned, { code: otpCode, expiresAt });
  }

  console.log(`🔑 [OTP] Code OTP généré pour ${cleaned} : ${otpCode}`);
  
  // Envoi du SMS réel via le provider
  await _sendSms(cleaned, `Votre code de connexion Voice MoMo est : ${otpCode}. Il expire dans 5 minutes.`);

  return { 
    success: true, 
    message: "Code OTP envoyé par SMS."
    // Ne pas renvoyer le code au frontend en production
  };
}

async function verifyOtp(phone, code) {
  const cleaned = _cleanPhone(phone);
  _validatePhone(cleaned);

  if (!code || code.length !== 6) {
    const err = new Error("Le code OTP doit contenir 6 chiffres.");
    err.status = 400;
    throw err;
  }

  const useDb = await _isDbAvailable();

  if (useDb) {
    const result = await db.query(
      "SELECT * FROM otps WHERE phone_number = $1 AND code = $2 AND is_used = FALSE ORDER BY created_at DESC LIMIT 1",
      [cleaned, String(code)]
    );

    if (result.rows.length === 0) {
      const err = new Error("Code OTP incorrect ou déjà utilisé.");
      err.status = 400;
      throw err;
    }

    const storedOtp = result.rows[0];

    if (new Date() > new Date(storedOtp.expires_at)) {
      await db.query("UPDATE otps SET is_used = TRUE WHERE id = $1", [storedOtp.id]);
      const err = new Error("Code OTP expiré. Veuillez en demander un nouveau.");
      err.status = 400;
      throw err;
    }

    // Marquer comme utilisé
    await db.query("UPDATE otps SET is_used = TRUE WHERE id = $1", [storedOtp.id]);

  } else {
    // Mode in-memory
    const stored = _otps.get(cleaned);
    if (!stored) {
      const err = new Error("Code OTP inexistant. Veuillez en demander un nouveau.");
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
    _otps.delete(cleaned);
  }

  // Vérification de l'utilisateur
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

  // Création automatique de compte
  if (!user) {
    console.log(`👤 [OTP] Nouvel utilisateur détecté (${cleaned}), inscription automatique...`);
    const shortPhone = cleaned.slice(-4);
    const defaultName = `Utilisateur ${shortPhone}`;
    const regResult = await register(cleaned, "0000", defaultName); // PIN par défaut "0000" pour les comptes OTP-only
    return { token: regResult.token, user: regResult.user };
  }

  // Session pour utilisateur existant
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

