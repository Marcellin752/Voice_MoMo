const transactionService = require("../services/transaction.service");

async function listTransactions(req, res, next) {
  try {
    const { q, type } = req.query || {};
    const transactions = await transactionService.getTransactions(req.user.userId, { q, type });
    return res.json({ transactions });
  } catch (err) {
    return next(err);
  }
}

async function createTransaction(req, res, next) {
  try {
    const { title, desc, amount, type } = req.body || {};
    if (!amount || Number(amount) <= 0) {
      const error = new Error("Le montant doit être supérieur à zéro.");
      error.status = 400;
      return next(error);
    }
    const tx = await transactionService.createTransaction(req.user.userId, { title, desc, amount, type });
    return res.status(201).json(tx);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listTransactions, createTransaction };
