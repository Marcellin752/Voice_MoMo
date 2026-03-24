// Simulation en mémoire (à remplacer par la vraie DB)
const transactions = [
  {
    id: "t1",
    dayLabel: "Aujourd'hui",
    type: "in",
    title: "Depot Agence",
    desc: "Reference: 19384729",
    time: "15:32",
    amount: "+25 000",
  },
  {
    id: "t2",
    dayLabel: "Hier",
    type: "out",
    title: "Achat Credit",
    desc: "Vers: 0123456789",
    time: "19:27",
    amount: "-2 000",
  },
  {
    id: "t3",
    dayLabel: "Hier",
    type: "out",
    title: "Paiement Marchand",
    desc: "Super U",
    time: "11:45",
    amount: "-15 500",
  },
];

/**
 * Retourne les transactions filtrées.
 * @param {{ q?: string, type?: string }} filters
 */
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

/**
 * Crée une nouvelle transaction et l'ajoute en tête de liste.
 * @param {{ title?: string, desc?: string, amount: number, type: "in"|"out"|"recharge" }} input
 */
function createTransaction(input) {
  const now = new Date();
  const amountValue = Number(input.amount);
  const normalizedAmount = Number.isNaN(amountValue) ? 0 : amountValue;

  // "in" = crédit, tout le reste (out, recharge) = débit
  const isCredit = input.type === "in";
  const sign = isCredit ? "+" : "-";

  const tx = {
    id: `t_${Date.now()}`,
    dayLabel: "Aujourd'hui",
    type:
      input.type === "in"
        ? "in"
        : input.type === "recharge"
          ? "recharge"
          : "out",
    title: input.title || "Opération",
    desc: input.desc || "Opération effectuée via API",
    time: now.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    amount: `${sign}${Math.abs(normalizedAmount).toLocaleString("fr-FR")}`,
  };

  transactions.unshift(tx);
  return tx;
}

module.exports = { getTransactions, createTransaction };
