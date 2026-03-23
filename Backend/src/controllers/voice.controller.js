const nlpService = require("../services/nlp.service");
const transactionService = require("../services/transaction.service");

/**
 * POST /api/voice/command
 * Body: { command: string }
 */
function processVoiceCommand(req, res, next) {
  try {
    const { command } = req.body || {};
    const parsed = nlpService.parseVoiceCommand(command);

    if (parsed.intent === "transfer" && parsed.amount) {
      transactionService.createTransaction({
        title: "Transfert vocal",
        desc: "Opération initiée par commande vocale",
        amount: parsed.amount,
        type: "out", // transfert = débit
      });
    }

    if (parsed.intent === "topup" && parsed.amount) {
      transactionService.createTransaction({
        title: "Recharge vocale",
        desc: "Opération initiée par commande vocale",
        amount: parsed.amount,
        type: "recharge", // recharge = son propre type
      });
    }

    return res.json(parsed);
  } catch (error) {
    return next(error);
  }
}

module.exports = { processVoiceCommand };
