const nlpService = require("../services/nlp.service");
const transactionService = require("../services/transaction.service");
const usersService = require("../services/users.service");

async function processVoiceCommand(req, res, next) {
  try {
    const { command } = req.body || {};
    const parsed = await nlpService.parseVoiceCommand(command);

    // Consultation de solde → retourne le vrai solde
    if (parsed.intent === "balance") {
      const { balance, currency } = await usersService.getBalance(req.user.userId);
      parsed.message = `Votre solde est de ${balance.toLocaleString("fr-FR")} ${currency}.`;
      return res.json(parsed);
    }

    // Transfert d'argent
    if (parsed.intent === "transfer" && parsed.amount) {
      await transactionService.createTransaction(req.user.userId, {
        title: parsed.recipient ? `Transfert à ${parsed.recipient}` : "Transfert vocal",
        desc:  "Opération initiée par commande vocale",
        amount: parsed.amount,
        type:  "out",
      });
    }

    // Recharge de crédit
    if (parsed.intent === "topup" && parsed.amount) {
      await transactionService.createTransaction(req.user.userId, {
        title: "Recharge vocale",
        desc:  "Opération initiée par commande vocale",
        amount: parsed.amount,
        type:  "recharge",
      });
    }

    // Paiement de facture
    if (parsed.intent === "payment" && parsed.amount) {
      const billLabel = parsed.bill_type
        ? `Facture ${parsed.bill_type}`
        : "Paiement de facture";
      await transactionService.createTransaction(req.user.userId, {
        title: billLabel,
        desc:  "Paiement initié par commande vocale",
        amount: parsed.amount,
        type:  "out",
      });
    }

    return res.json(parsed);
  } catch (error) {
    return next(error);
  }
}

module.exports = { processVoiceCommand };
