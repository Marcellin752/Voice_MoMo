/**
 * Catalogue des codes USSD MTN MoMo Bénin (chaînes profondes quand connues).
 * Les opérations sensibles exigent encore le PIN sur l'UI système MTN.
 */

export type BuiltUssd = {
  code: string;
  message: string;
  /** true = l'utilisateur doit encore compléter à l'écran (PIN / sous-menus). */
  interactive: boolean;
};

function amountOrThrow(amount: unknown): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 100) {
    throw new Error('Indiquez un montant d\'au moins 100 francs.');
  }
  return Math.floor(n);
}

/**
 * Construit le meilleur code USSD possible pour un intent MoMo.
 * Sources : codes éprouvés (*880*1*1*, *880*4*, *880*724*) + arborescence menu *880#
 * (1 transfert, 2 retrait, 3 crédit/forfaits, 4 compte, 5 paiements).
 */
export function buildMtnServiceUssd(
  intent: string,
  opts: { amount?: number | null; recipient?: string | null; billType?: string | null } = {}
): BuiltUssd {
  const i = intent.toLowerCase();
  const amt = opts.amount != null ? Number(opts.amount) : null;

  switch (i) {
    case 'recharge': {
      if (amt == null || !Number.isFinite(amt)) {
        return {
          code: '*880*3#',
          message: 'Menu achat crédit ouvert. Choisissez le montant puis validez avec votre PIN MTN.',
          interactive: true,
        };
      }
      const a = amountOrThrow(amt);
      // Crédit pour mon numéro — menu 3 (achat) → parcours crédit / montant
      return {
        code: `*880*3*1*${a}#`,
        message: `Recharge de ${a.toLocaleString('fr-FR')} francs lancée. Validez avec votre code PIN MTN à l'écran.`,
        interactive: true,
      };
    }

    case 'internet_day':
    case 'internet_week':
    case 'internet_month':
    case 'internet_unlimited':
    case 'gopack_day':
    case 'gopack_week':
    case 'gopack_month': {
      const label =
        i.startsWith('gopack') ? 'Go Pack' : i.includes('unlimited') ? 'internet illimité' : 'forfait internet';
      if (amt != null && Number.isFinite(amt) && amt >= 100) {
        const a = Math.floor(amt);
        return {
          code: `*880*3*2*${a}#`,
          message: `Achat ${label} (~${a.toLocaleString('fr-FR')} F) lancé. Confirmez l'option et le PIN à l'écran.`,
          interactive: true,
        };
      }
      return {
        code: '*880*3#',
        message: `Menu forfaits ouvert pour ${label}. Choisissez l'offre puis validez avec votre PIN.`,
        interactive: true,
      };
    }

    case 'withdraw': {
      if (amt != null && Number.isFinite(amt) && amt >= 100) {
        const a = Math.floor(amt);
        return {
          code: `*880*2*${a}#`,
          message: `Retrait de ${a.toLocaleString('fr-FR')} francs initié. Suivez les instructions agent/PIN à l'écran.`,
          interactive: true,
        };
      }
      return {
        code: '*880*2#',
        message: 'Menu retrait MoMo ouvert. Indiquez le montant et validez avec votre PIN.',
        interactive: true,
      };
    }

    case 'withdraw_gab':
      return {
        code: '*880*724#',
        message: 'Génération du code retrait GAB. Suivez les instructions MTN à l\'écran.',
        interactive: true,
      };

    case 'bill_payment': {
      const bill = (opts.billType || opts.recipient || '').toString().trim();
      if (amt != null && Number.isFinite(amt) && amt >= 100 && bill) {
        const a = Math.floor(amt);
        // Paiements marchands — menu 5 ; référence + montant quand disponibles
        const ref = bill.replace(/\s+/g, '');
        return {
          code: `*880*5*${ref}*${a}#`,
          message: `Paiement de ${a.toLocaleString('fr-FR')} francs (${bill}) lancé. Vérifiez puis saisissez votre PIN.`,
          interactive: true,
        };
      }
      if (amt != null && Number.isFinite(amt) && amt >= 100) {
        const a = Math.floor(amt);
        return {
          code: `*880*5*${a}#`,
          message: `Menu paiement ouvert pour ${a.toLocaleString('fr-FR')} francs. Complétez la référence puis le PIN.`,
          interactive: true,
        };
      }
      return {
        code: '*880*5#',
        message: 'Menu paiement marchand / factures ouvert. Suivez les instructions à l\'écran.',
        interactive: true,
      };
    }

    default:
      return {
        code: '*880#',
        message: 'Menu MoMo ouvert. Choisissez l\'option à l\'écran.',
        interactive: true,
      };
  }
}
