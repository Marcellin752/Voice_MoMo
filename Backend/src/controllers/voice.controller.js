const nlpService = require("../services/nlp.service");
const transactionService = require("../services/transaction.service");

async function processVoiceCommand(req, res, next) {
  try {
    const { command } = req.body || {};
    const parsed = nlpService.parseVoiceCommand(command);

    if (parsed.intent === "transfer" && parsed.amount) {
      await transactionService.createTransaction(req.user.userId, {
        title: "Transfert vocal",
        desc:  "Opération initiée par commande vocale",
        amount: parsed.amount,
        type:  "out",
      });
    }

    if (parsed.intent === "topup" && parsed.amount) {
      await transactionService.createTransaction(req.user.userId, {
        title: "Recharge vocale",
        desc:  "Opération initiée par commande vocale",
        amount: parsed.amount,
        type:  "recharge",
      });
    }

    return res.json(parsed);
  } catch (error) {
    return next(error);
  }
}

module.exports = { processVoiceCommand };
