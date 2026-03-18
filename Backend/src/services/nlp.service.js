function parseVoiceCommand(command) {
  const text = String(command || "").toLowerCase().trim();
  if (!text) {
    return { intent: "unknown", message: "Commande vide." };
  }

  if (text.includes("solde")) {
    return { intent: "balance", message: "Votre solde actuel est de 15 000 FCFA." };
  }

  if (text.includes("envoi") || text.includes("envoyer") || text.includes("transfert")) {
    const amount = text.match(/\d+/)?.[0] || null;
    return {
      intent: "transfer",
      amount: amount ? Number(amount) : null,
      message: amount
        ? `Transfert de ${amount} FCFA pret a etre confirme.`
        : "Montant non detecte pour le transfert.",
    };
  }

  if (text.includes("recharge") || text.includes("credit")) {
    const amount = text.match(/\d+/)?.[0] || null;
    return {
      intent: "topup",
      amount: amount ? Number(amount) : null,
      message: amount
        ? `Recharge de ${amount} FCFA prete a etre confirmee.`
        : "Montant non detecte pour la recharge.",
    };
  }

  return {
    intent: "unknown",
    message: "Commande non reconnue.",
  };
}

module.exports = {
  parseVoiceCommand,
};
