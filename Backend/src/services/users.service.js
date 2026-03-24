const db = require("../config/db");
const bcrypt = require("bcrypt");
const authService = require("./auth.service");

// Préférences de langue par userId (in-memory, pas de colonne DB)
const languageStore = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function _useDb() {
  return authService._isDbAvailable();
}

// ─── Profil ───────────────────────────────────────────────────────────────────

async function getProfile(userId) {
  if (await _useDb()) {
    const result = await db.query(
      "SELECT id, full_name, phone_number, balance, currency FROM users WHERE id = $1",
      [userId]
    );
    if (result.rows.length === 0) {
      const err = new Error("Utilisateur introuvable.");
      err.status = 404;
      throw err;
    }
    const u = result.rows[0];
    return { id: u.id, fullName: u.full_name, phone: u.phone_number, balance: parseFloat(u.balance), currency: u.currency };
  }

  const u = authService._getInMemoryUserById(userId);
  if (!u) {
    const err = new Error("Utilisateur introuvable.");
    err.status = 404;
    throw err;
  }
  return { id: u.id, fullName: u.fullName, phone: u.phone, balance: u.balance, currency: u.currency };
}

async function updateProfile(userId, data) {
  if (await _useDb()) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (typeof data.fullName === "string" && data.fullName.trim()) {
      fields.push(`full_name = $${idx++}`);
      values.push(data.fullName.trim());
    }
    if (typeof data.phone === "string" && data.phone.trim()) {
      fields.push(`phone_number = $${idx++}`);
      values.push(data.phone.trim());
    }
    if (fields.length === 0) {
      const err = new Error("Aucun champ valide à mettre à jour.");
      err.status = 400;
      throw err;
    }

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await db.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING id, full_name, phone_number, balance, currency`,
      values
    );
    const u = result.rows[0];
    return { id: u.id, fullName: u.full_name, phone: u.phone_number, balance: parseFloat(u.balance), currency: u.currency };
  }

  const u = authService._updateInMemoryUser(userId, data);
  if (!u) {
    const err = new Error("Utilisateur introuvable.");
    err.status = 404;
    throw err;
  }
  return { id: u.id, fullName: u.fullName, phone: u.phone, balance: u.balance, currency: u.currency };
}

// ─── Langue ───────────────────────────────────────────────────────────────────

function getLanguage(userId) {
  return { language: languageStore[userId] || "fr" };
}

function updateLanguage(userId, lang) {
  languageStore[userId] = lang;
  return { language: lang };
}

// ─── PIN ──────────────────────────────────────────────────────────────────────

async function updatePin(userId, oldPin, newPin) {
  // Vérifier l'ancien PIN
  let storedHash;
  if (await _useDb()) {
    const result = await db.query("SELECT pin_hash FROM users WHERE id = $1", [userId]);
    if (result.rows.length === 0) {
      const err = new Error("Utilisateur introuvable."); err.status = 404; throw err;
    }
    storedHash = result.rows[0].pin_hash;
  } else {
    const u = authService._getInMemoryUserById(userId);
    if (!u) { const err = new Error("Utilisateur introuvable."); err.status = 404; throw err; }
    storedHash = u.pinHash;
  }

  const valid = await bcrypt.compare(String(oldPin), storedHash);
  if (!valid) {
    const err = new Error("Ancien PIN incorrect."); err.status = 401; throw err;
  }

  const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
  const pinHash = await bcrypt.hash(String(newPin), ROUNDS);
  const pinUpdatedAt = new Date().toISOString();

  if (await _useDb()) {
    await db.query("UPDATE users SET pin_hash = $1, updated_at = NOW() WHERE id = $2", [pinHash, userId]);
  } else {
    authService._updateInMemoryPin(userId, pinHash);
  }

  return { pinUpdatedAt };
}

function getSecurityState() {
  return { pinUpdatedAt: null };
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function getNotifications(userId) {
  if (await _useDb()) {
    try {
      const result = await db.query(
        `SELECT id, title, body AS content, created_at
         FROM notifications WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );
      return result.rows.map((n) => ({
        id: String(n.id),
        title: n.title,
        content: n.content,
        when: new Date(n.created_at).toLocaleString("fr-FR"),
      }));
    } catch {
      // table notifications absente — fallback
    }
  }

  return [
    { id: "n1", title: "Dépôt reçu", content: "Vous avez reçu +25 000 FCFA.", when: "Aujourd'hui 15:32" },
    { id: "n2", title: "Paiement confirmé", content: "Votre paiement marchand a été validé.", when: "Hier 11:45" },
  ];
}

// ─── Solde ────────────────────────────────────────────────────────────────────

async function getBalance(userId) {
  if (await _useDb()) {
    const result = await db.query(
      "SELECT balance, currency FROM users WHERE id = $1",
      [userId]
    );
    if (result.rows.length === 0) {
      const err = new Error("Utilisateur introuvable.");
      err.status = 404;
      throw err;
    }
    return { balance: parseFloat(result.rows[0].balance), currency: result.rows[0].currency };
  }

  const u = authService._getInMemoryUserById(userId);
  if (!u) {
    const err = new Error("Utilisateur introuvable.");
    err.status = 404;
    throw err;
  }
  return { balance: u.balance, currency: u.currency };
}

module.exports = {
  getProfile,
  updateProfile,
  getLanguage,
  updateLanguage,
  updatePin,
  getSecurityState,
  getNotifications,
  getBalance,
};
