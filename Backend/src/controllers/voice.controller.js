const nlpService = require("../services/nlp.service");
const transactionService = require("../services/transaction.service");

function processVoiceCommand(req, res, next) {
  try {
    const { command } = req.body || {};
    const parsed = nlpService.parseVoiceCommand(command);

    if (parsed.intent === "transfer" && parsed.amount) {
      transactionService.createTransaction({
        title: "Transfert vocal",
        desc: "Operation initiee par commande vocale",
        amount: parsed.amount,
        type: "out",
      });
    }

    if (parsed.intent === "topup" && parsed.amount) {
      transactionService.createTransaction({
        title: "Recharge vocale",
        desc: "Operation initiee par commande vocale",
        amount: parsed.amount,
        type: "out",
      });
    }

    return res.json(parsed);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  processVoiceCommand,
};
