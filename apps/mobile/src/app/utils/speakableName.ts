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

/**
 * Message de confirmation (transfert ou dépôt) : à l'oral une vraie question qui répète la
 * demande ; à l'écran le nom complet. `operation` : 'envoyer' (transfert) ou 'déposer' (dépôt).
 */
export function buildTransferConfirmSpeech(opts: {
  amount: number;
  name?: string | null;
  phone?: string | null;
  linkaFees?: number | null;
  networkLabel?: string | null;
  operation?: 'envoyer' | 'déposer';
}): { speech: string; display: string } {
  const amountStr = Number(opts.amount).toLocaleString('fr-FR');
  const spokenWho = formatContactForSpeech(opts.name, opts.phone);
  const displayWho = opts.name?.trim() || opts.phone || 'ce contact';
  const verb = opts.operation === 'déposer' ? 'déposer' : 'envoyer';
  const link = opts.operation === 'déposer' ? 'sur le compte de' : 'à';
  const verbDisplay = verb.charAt(0).toUpperCase() + verb.slice(1);

  let speech = `Vous voulez ${verb} ${amountStr} francs ${link} ${spokenWho}`;
  let display = `${verbDisplay} ${amountStr} F ${link} ${displayWho}`;

  if (opts.linkaFees != null && opts.linkaFees > 0) {
    const fees = opts.linkaFees.toLocaleString('fr-FR');
    const total = (Number(opts.amount) + opts.linkaFees).toLocaleString('fr-FR');
    const net = opts.networkLabel || 'autre réseau';
    speech += `, via Linka vers ${net}, frais ${fees} francs, total ${total} francs`;
    display += ` (Linka · frais ${fees} F · total ${total} F)`;
  } else if (opts.networkLabel) {
    speech += `, sur ${opts.networkLabel}`;
    display += ` (${opts.networkLabel})`;
  }

  speech += '. Est-ce bien cela ? Dites oui pour confirmer, ou non pour annuler.';
  display += '. Dites oui pour confirmer.';

  return { speech, display };
}
