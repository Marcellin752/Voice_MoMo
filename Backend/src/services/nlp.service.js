function parseVoiceCommand(command) {
  const text = String(command || "")
    .toLowerCase()
    .trim();
  if (!text) {
    return { intent: "unknown", message: "Commande vide." };
  }

  if (text.includes("solde")) {
    return {
      intent: "balance",
      message: "Votre solde actuel est de 15 000 FCFA.",
    };
  }

  if (
    text.includes("envoi") ||
    text.includes("envoyer") ||
    text.includes("transfert")
  ) {
    const amount = text.match(/\d+/)?.[0] || null;
    return {
      intent: "transfer",
      amount: amount ? Number(amount) : null,
      message: amount
        ? `Transfert de ${amount} FCFA prêt à être confirmé.`
        : "Montant non détecté pour le transfert.",
    };
  }

  if (text.includes("recharge") || text.includes("credit")) {
    const amount = text.match(/\d+/)?.[0] || null;
    return {
      intent: "topup",
      amount: amount ? Number(amount) : null,
      message: amount
        ? `Recharge de ${amount} FCFA prête à être confirmée.`
        : "Montant non détecté pour la recharge.",
    };
  }

  return { intent: "unknown", message: "Commande non reconnue." };
}

module.exports = { parseVoiceCommand };
