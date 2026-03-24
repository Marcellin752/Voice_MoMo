const db = require("../config/db");

// Types valides selon le schéma (ENUM transaction_type)
const VALID_TYPES = ["send", "receive", "recharge", "payment"];

async function getTransactions(userId, filters = {}) {
  const conditions = ["t.sender_id = $1 OR t.receiver_id = $1"];
  const values = [userId];
  let idx = 2;

  if (filters.type && VALID_TYPES.includes(filters.type)) {
    conditions.push(`t.type = $${idx++}`);
    values.push(filters.type);
  }

  if (filters.q) {
    conditions.push(`(t.label ILIKE $${idx++} OR t.note ILIKE $${idx - 1})`);
    values.push(`%${filters.q}%`);
  }

  const result = await db.query(
    `SELECT t.id, t.type, t.status, t.amount, t.label,
            t.phone_number, t.service_code, t.note, t.fee, t.created_at,
            t.sender_id, t.receiver_id
     FROM transactions t
     WHERE ${conditions.join(" AND ")}
     ORDER BY t.created_at DESC`,
    values,
  );
  return result.rows;
}

async function createTransaction(userId, input) {
  const {
    type,
    amount,
    label,
    phone_number,
    service_code,
    account_number,
    note,
    fee,
  } = input;

  if (!VALID_TYPES.includes(type)) {
    const err = new Error(
      `Type invalide. Valeurs acceptées: ${VALID_TYPES.join(", ")}`,
    );
    err.status = 400;
    throw err;
  }

  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    const err = new Error("Le montant doit être un nombre supérieur à zéro.");
    err.status = 400;
    throw err;
  }

  if (!label || String(label).trim().length === 0) {
    const err = new Error("Le libellé (label) est requis.");
    err.status = 400;
    throw err;
  }

  // sender_id = l'utilisateur connecté pour send/recharge/payment
  // receiver_id = l'utilisateur connecté pour receive
  const senderId = type === "receive" ? null : userId;
  const receiverId = type === "receive" ? userId : null;

  const result = await db.query(
    `INSERT INTO transactions
       (type, amount, sender_id, receiver_id, label, phone_number, service_code, account_number, note, fee)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      type,
      amountNum,
      senderId,
      receiverId,
      label.trim(),
      phone_number || null,
      service_code || null,
      account_number || null,
      note || null,
      parseFloat(fee) || 0,
    ],
  );

  return result.rows[0];
}

module.exports = { getTransactions, createTransaction };
