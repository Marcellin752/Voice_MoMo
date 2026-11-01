export type AmbiguousContact = { name: string; phone: string };

const CONFIRM_RE = /\b(oui|ok|d'accord|dac|confirme|vas[- ]?y|valide|exact|correct)\b/i;
const CANCEL_RE = /\b(non|annule|arrête|stop|pas maintenant|abandonne)\b/i;

const ORDINALS: Record<string, number> = {
  premier: 1,
  premiere: 1,
  '1er': 1,
  '1ère': 1,
  deuxieme: 2,
  second: 2,
  seconde: 2,
  troisieme: 3,
  troisième: 3,
  quatrieme: 4,
  quatrième: 4,
  cinquieme: 5,
  cinquième: 5,
};

export function isConfirmSpeech(text: string): boolean {
  return CONFIRM_RE.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

export function isCancelSpeech(text: string): boolean {
  return CANCEL_RE.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
}

export function matchContactFromSpeech(
  text: string,
  contacts: AmbiguousContact[]
): AmbiguousContact | null {
  if (!text?.trim() || !contacts.length) return null;

  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const digitOnly = normalized.replace(/\D/g, '');
  if (digitOnly.length === 1) {
    const idx = Number(digitOnly) - 1;
    if (idx >= 0 && idx < contacts.length) return contacts[idx];
  }

  for (const [word, n] of Object.entries(ORDINALS)) {
    if (normalized.includes(word)) {
      const idx = n - 1;
      if (idx >= 0 && idx < contacts.length) return contacts[idx];
    }
  }

  for (const contact of contacts) {
    const name = contact.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (name && (normalized.includes(name) || name.includes(normalized))) {
      return contact;
    }
  }

  const phoneDigits = normalized.replace(/\D/g, '');
  if (phoneDigits.length >= 8) {
    const hit = contacts.find((c) => c.phone.replace(/\D/g, '').includes(phoneDigits.slice(-8)));
    if (hit) return hit;
  }

  return null;
}

/** Extrait un PIN MTN (4–5 chiffres) depuis une phrase dictée. */
export function parsePinFromSpeech(text: string): string | null {
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  if (digits.length >= 4 && digits.length <= 5) return digits;
  return null;
}

/**
 * Consigne courte (demande du propriétaire, 2026-11-01) : on n'énumère plus chaque contact avec
 * son numéro ; la liste numérotée est à l'écran, et la sélection à la voix reste possible
 * (« un », « deux »…, voir matchContactFromSpeech).
 */
export function formatAmbiguityVoicePrompt(contacts: AmbiguousContact[], query: string): string {
  const n = Math.min(contacts.length, 5);
  return `J'ai trouvé ${n} contacts pour ${query}. Choisissez le bon dans la liste : touchez-le, ou dites sa position, un, deux, trois.`;
}
