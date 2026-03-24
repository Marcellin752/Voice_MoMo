const db = require("../config/db");

async function getProfile(userId) {
  const result = await db.query(
    "SELECT id, full_name, phone_number, balance, currency, created_at FROM users WHERE id = $1",
    [userId],
  );
  if (result.rows.length === 0) {
    const err = new Error("Utilisateur introuvable.");
    err.status = 404;
    throw err;
  }
  const u = result.rows[0];
  return {
    id: u.id,
    fullName: u.full_name,
    phone: u.phone_number,
    balance: parseFloat(u.balance),
    currency: u.currency,
    createdAt: u.created_at,
  };
}

async function updateProfile(userId, data) {
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
    values,
  );
  const u = result.rows[0];
  return {
    id: u.id,
    fullName: u.full_name,
    phone: u.phone_number,
    balance: parseFloat(u.balance),
    currency: u.currency,
  };
}

async function updatePin(userId, newPin) {
  const bcrypt = require("bcrypt");
  const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
  const pinHash = await bcrypt.hash(String(newPin), ROUNDS);

  await db.query(
    "UPDATE users SET pin_hash = $1, updated_at = NOW() WHERE id = $2",
    [pinHash, userId],
  );
  return { message: "PIN mis à jour avec succès." };
}

async function getNotifications(userId) {
  const result = await db.query(
    "SELECT id, type, title, body, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  return result.rows;
}

module.exports = { getProfile, updateProfile, updatePin, getNotifications };
