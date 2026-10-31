/**
 * Formate un nom de contact pour le TTS français.
 * Évite les mauvaises prononciations : on privilégie le prénom + fin du numéro.
 */

export function formatContactForSpeech(name?: string | null, phone?: string | null): string {
  const raw = (name || '').trim();
  const digits = (phone || '').replace(/\D/g, '');
  const last4 = digits.slice(-4);

  if (!raw && last4) {
    return `le numéro ${last4.split('').join(' ')}`;
  }
  if (!raw) return 'ce contact';

  // Prénom seulement (souvent mieux géré que le nom complet)
  const first = raw.split(/\s+/)[0];
  // Noms très courts / initials
  if (first.length <= 2) {
    return last4 ? `le contact numéro ${last4.split('').join(' ')}` : 'ce contact';
  }

  if (last4) {
    return `${first}, numéro ${last4.split('').join(' ')}`;
  }
  return first;
}

/** Message de confirmation transfert lisible à l'oral + clair à l'écran. */
export function buildTransferConfirmSpeech(opts: {
  amount: number;
  name?: string | null;
  phone?: string | null;
  linkaFees?: number | null;
  networkLabel?: string | null;
}): { speech: string; display: string } {
  const amountStr = Number(opts.amount).toLocaleString('fr-FR');
  const spokenWho = formatContactForSpeech(opts.name, opts.phone);
  const displayWho = opts.name?.trim() || opts.phone || 'ce contact';

  let speech = `Envoyer ${amountStr} francs à ${spokenWho}`;
  let display = `Envoyer ${amountStr} F à ${displayWho}`;

  if (opts.linkaFees != null && opts.linkaFees > 0) {
    const fees = opts.linkaFees.toLocaleString('fr-FR');
    const total = (Number(opts.amount) + opts.linkaFees).toLocaleString('fr-FR');
    const net = opts.networkLabel || 'autre réseau';
    speech += ` via Linka vers ${net}, frais ${fees} francs, total ${total} francs. Dites oui pour confirmer.`;
    display += ` (Linka · frais ${fees} F · total ${total} F)`;
  } else {
    speech += '. Dites oui pour confirmer.';
  }

  return { speech, display };
}
