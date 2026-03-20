const transactionService = require("../services/transaction.service");

function listTransactions(req, res) {
  const { q, type } = req.query || {};
  const transactions = transactionService.getTransactions({ q, type });
  return res.json({ transactions });
}

function createTransaction(req, res, next) {
  const { title, desc, amount, type } = req.body || {};
  if (!amount || Number(amount) <= 0) {
    const error = new Error("Le montant doit etre superieur a zero.");
    error.status = 400;
    return next(error);
  }
  const tx = transactionService.createTransaction({ title, desc, amount, type });
  return res.status(201).json(tx);
}

module.exports = {
  listTransactions,
  createTransaction,
};
