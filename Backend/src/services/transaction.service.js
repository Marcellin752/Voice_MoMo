const transactions = [
  { id: "t1", dayLabel: "Aujourd'hui", type: "in", title: "Depot Agence", desc: "Reference: 19384729", time: "15:32", amount: "+25 000" },
  { id: "t2", dayLabel: "Hier", type: "out", title: "Achat Credit", desc: "Vers: 0123456789", time: "19:27", amount: "-2 000" },
  { id: "t3", dayLabel: "Hier", type: "out", title: "Paiement Marchand", desc: "Super U", time: "11:45", amount: "-15 500" },
];

function getTransactions(filters = {}) {
  const search = (filters.q || "").toLowerCase();
  const type = filters.type;

  return transactions.filter((tx) => {
    const typeMatches = !type || type === "all" || tx.type === type;
    const textMatches =
      !search ||
      tx.title.toLowerCase().includes(search) ||
      tx.desc.toLowerCase().includes(search);
    return typeMatches && textMatches;
  });
}

function createTransaction(input) {
  const now = new Date();
  const amountValue = Number(input.amount);
  const normalizedAmount = Number.isNaN(amountValue) ? 0 : amountValue;
  const type = input.type === "in" ? "in" : "out";
  const sign = type === "in" ? "+" : "-";

  const tx = {
    id: `t_${Date.now()}`,
    dayLabel: "Aujourd'hui",
    type,
    title: input.title || "Operation",
    desc: input.desc || "Operation effectuee via API",
    time: now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    amount: `${sign}${Math.abs(normalizedAmount).toLocaleString("fr-FR")}`,
  };

  transactions.unshift(tx);
  return tx;
}

module.exports = {
  getTransactions,
  createTransaction,
};
