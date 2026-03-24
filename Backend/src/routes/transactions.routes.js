const express = require("express");
const transactionsController = require("../controllers/transactions.controller");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);
router.get("/", transactionsController.listTransactions);
router.post("/", transactionsController.createTransaction);

module.exports = router;
