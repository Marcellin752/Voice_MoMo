const db = require("../config/db");
const authService = require("./auth.service");

// ─── Store in-memory (fallback sans DB) ──────────────────────────────────────
const _transactions = [
  { id: "t1", userId: null, dayLabel: "Aujourd'hui", type: "in",  title: "Dépôt Agence",     desc: "Référence: 19384729", time: "15:32", amount: "+25 000" },
  { id: "t2", userId: null, dayLabel: "Hier",         type: "out", title: "Achat Crédit",     desc: "Vers: 0123456789",   time: "19:27", amount: "-2 000"  },
  { id: "t3", userId: null, dayLabel: "Hier",         type: "out", title: "Paiement Marchand",desc: "Super U",            time: "11:45", amount: "-15 500" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _dayLabel(date) {
  const now = new Date();
  const d = new Date(date);
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function _formatAmount(amount, type) {
  const abs = Math.abs(parseFloat(amount)).toLocaleString("fr-FR");
  return type === "in" || type === "receive" || type === "recharge" ? `+${abs}` : `-${abs}`;
}

function _mapDbType(dbType) {
  if (dbType === "receive") return "in";
  if (dbType === "recharge") return "recharge";
  return "out"; // send, payment
}

function _mapDbRow(row) {
  const type = _mapDbType(row.type);
  return {
    id:       String(row.id),
    dayLabel: _dayLabel(row.created_at),
    type,
    title:    row.label || "Opération",
    desc:     row.note  || "",
    time:     new Date(row.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    amount:   _formatAmount(row.amount, type),
  };
}

// ─── Fonctions publiques ──────────────────────────────────────────────────────

async function getTransactions(userId, filters = {}) {
  if (await authService._isDbAvailable()) {
    try {
      const conditions = ["(t.sender_id = $1 OR t.receiver_id = $1)"];
      const values = [userId];
      let idx = 2;

      if (filters.q) {
        conditions.push(`(t.label ILIKE $${idx} OR t.note ILIKE $${idx})`);
        values.push(`%${filters.q}%`);
        idx++;
      }

      const result = await db.query(
        `SELECT t.id, t.type, t.amount, t.label, t.note, t.created_at
         FROM transactions t
         WHERE ${conditions.join(" AND ")}
         ORDER BY t.created_at DESC`,
        values,
      );
      return result.rows.map(_mapDbRow);
    } catch {
      // table absente → fallback
    }
  }

  // Mode in-memory — filtre par userId pour que les nouveaux comptes soient vides
  const search = (filters.q || "").toLowerCase();
  const typeFilter = filters.type;
  return _transactions.filter((tx) => {
    const matchUser = tx.userId === userId;
    const matchType = !typeFilter || typeFilter === "all" || tx.type === typeFilter;
    const matchText = !search || tx.title.toLowerCase().includes(search) || tx.desc.toLowerCase().includes(search);
    return matchUser && matchType && matchText;
  });
}

async function createTransaction(userId, input) {
  const { title, desc, amount, type } = input;
  const numericAmount = parseFloat(amount);

  if (isNaN(numericAmount) || numericAmount <= 0) {
    const err = new Error("Le montant doit être supérieur à zéro.");
    err.status = 400;
    throw err;
  }

  if (await authService._isDbAvailable()) {
    try {
      const dbType = type === "in" ? "receive" : type === "recharge" ? "recharge" : "send";
      const senderId   = dbType === "receive" ? null : userId;
      const receiverId = dbType === "receive" ? userId : null;

      // Vérifier le solde avant débit
      if (dbType === "send") {
        const balanceResult = await db.query("SELECT balance FROM users WHERE id = $1", [userId]);
        const currentBalance = parseFloat(balanceResult.rows[0]?.balance || 0);
        if (numericAmount > currentBalance) {
          const err = new Error("Solde insuffisant pour effectuer cette opération.");
          err.status = 400;
          throw err;
        }
      }

      const result = await db.query(
        `INSERT INTO transactions (type, amount, sender_id, receiver_id, label, note, fee)
         VALUES ($1, $2, $3, $4, $5, $6, 0)
         RETURNING *`,
        [dbType, numericAmount, senderId, receiverId, title || "Opération", desc || null],
      );

      // Mettre à jour le solde en DB
      if (dbType === "send") {
        await db.query("UPDATE users SET balance = balance - $1 WHERE id = $2", [numericAmount, userId]);
      } else if (dbType === "receive" || dbType === "recharge") {
        await db.query("UPDATE users SET balance = balance + $1 WHERE id = $2", [numericAmount, userId]);
      }

      return _mapDbRow(result.rows[0]);
    } catch (e) {
      if (e.status === 400) throw e;
      // table absente → fallback in-memory
    }
  }

  // Mode in-memory
  const mobileType = type === "in" || type === "recharge" ? type : "out";

  // Vérifier le solde avant débit (in-memory)
  if (mobileType === "out") {
    const u = authService._getInMemoryUserById(userId);
    if (u && numericAmount > u.balance) {
      const err = new Error("Solde insuffisant pour effectuer cette opération.");
      err.status = 400;
      throw err;
    }
  }

  const now = new Date();
  const tx = {
    id:       `t_${Date.now()}`,
    userId,
    dayLabel: "Aujourd'hui",
    type:     mobileType,
    title:    title || "Opération",
    desc:     desc  || "Opération effectuée via application",
    time:     now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    amount:   _formatAmount(numericAmount, mobileType),
  };
  _transactions.unshift(tx);

  // Mettre à jour le solde in-memory
  const u = authService._getInMemoryUserById(userId);
  if (u) {
    if (mobileType === "out") {
      authService._updateInMemoryUser(userId, { balance: u.balance - numericAmount });
    } else {
      authService._updateInMemoryUser(userId, { balance: u.balance + numericAmount });
    }
  }

  return tx;
}

module.exports = { getTransactions, createTransaction };
