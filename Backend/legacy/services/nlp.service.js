const NLP_MODULE_URL = process.env.NLP_MODULE_URL || "http://localhost:8000";

// ─── Parser simple (fallback) ─────────────────────────────────────────────────

function _parseLocal(command) {
  const text = String(command || "").toLowerCase().trim();
  if (!text) return { intent: "unknown", message: "Commande vide." };

  if (text.includes("solde") || text.includes("balance") || text.includes("combien")) {
    return { intent: "balance", message: "Consultation de votre solde en cours." };
  }

  if (text.includes("envoi") || text.includes("envoyer") || text.includes("transfert") || text.includes("envoie")) {
    const amount = text.match(/(\d[\d\s]*)/)?.[0]?.replace(/\s/g, "") || null;
    return {
      intent: "transfer",
      amount: amount ? Number(amount) : null,
      message: amount
        ? `Transfert de ${Number(amount).toLocaleString("fr-FR")} FCFA prêt à être confirmé.`
        : "Quel montant voulez-vous envoyer ?",
    };
  }

  if (text.includes("recharge") || text.includes("crédit") || text.includes("credit") || text.includes("airtime")) {
    const amount = text.match(/(\d[\d\s]*)/)?.[0]?.replace(/\s/g, "") || null;
    return {
      intent: "topup",
      amount: amount ? Number(amount) : null,
      message: amount
        ? `Recharge de ${Number(amount).toLocaleString("fr-FR")} FCFA prête à être confirmée.`
        : "Quel montant voulez-vous recharger ?",
    };
  }

  if (text.includes("payer") || text.includes("paye") || text.includes("facture")) {
    return { intent: "payment", message: "Quel service souhaitez-vous payer ?" };
  }

  return { intent: "unknown", message: "Commande non reconnue. Essayez : solde, envoie, recharge." };
}

// ─── Appel au module NLP Python (Gemini) ─────────────────────────────────────

async function _parseWithAI(command) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  const res = await fetch(`${NLP_MODULE_URL}/ai/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: command, locale: "fr-FR" }),
    signal: controller.signal,
  });

  clearTimeout(timeout);
  if (!res.ok) throw new Error(`NLP module HTTP ${res.status}`);
  const data = await res.json();

  // Adapter le format du module NLP au format attendu par voice.controller
  const intentMap = {
    balance:      "balance",
    transfer:     "transfer",
    recharge:     "topup",
    bill_payment: "payment",
    confirm:      "confirm",
    cancel:       "cancel",
    help:         "help",
    unknown:      "unknown",
  };

  return {
    intent:  intentMap[data.intent] || "unknown",
    amount:  data.amount || null,
    recipient: data.recipient || null,
    message: data.confirmation_message || data.understood_text || "Commande traitée.",
  };
}

// ─── Fonction principale ──────────────────────────────────────────────────────

async function parseVoiceCommand(command) {
  try {
    return await _parseWithAI(command);
  } catch {
    // Module NLP indisponible → fallback regex
    return _parseLocal(command);
  }
}

module.exports = { parseVoiceCommand };
