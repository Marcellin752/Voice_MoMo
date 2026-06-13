/**
 * UX Fix #3 (Bloquant): Feedback progressif pendant les traitements longs.
 *
 * Sans cela, l'utilisateur voit "Traitement en cours..." figé pendant 10s+
 * et pense que l'application a planté. Ces messages échelonnés le rassurent
 * et lui indiquent que le système travaille toujours.
 */

export interface ProgressiveStep {
  /** Délai en millisecondes avant d'afficher ce message (0 = immédiat). */
  delayMs: number;
  message: string;
}

/** Étapes pour l'analyse vocale (audio → NLP Gemini). */
export const NLP_PROCESSING_STEPS: ProgressiveStep[] = [
  { delayMs: 0, message: 'Je traite votre demande...' },
  { delayMs: 4000, message: "J'analyse votre message vocal..." },
  { delayMs: 9000, message: 'Encore un instant, presque terminé...' },
];

/** Étapes pour l'exécution USSD (transfert, solde, recharge). */
export const USSD_PROCESSING_STEPS: ProgressiveStep[] = [
  { delayMs: 0, message: 'Je traite votre demande...' },
  { delayMs: 4000, message: 'Connexion au réseau MTN...' },
  { delayMs: 10000, message: 'Le réseau MTN met un peu de temps à répondre. Merci de patienter...' },
];

/**
 * Affiche les messages d'attente échelonnés via `setFeedback`.
 * Retourne une fonction d'arrêt à appeler dès que la réponse arrive,
 * pour éviter qu'un message d'attente n'écrase le résultat final.
 */
export function startProgressiveFeedback(
  setFeedback: (message: string) => void,
  steps: ProgressiveStep[] = NLP_PROCESSING_STEPS
): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const step of steps) {
    if (step.delayMs <= 0) {
      setFeedback(step.message);
    } else {
      timers.push(setTimeout(() => setFeedback(step.message), step.delayMs));
    }
  }

  return () => {
    timers.forEach(clearTimeout);
  };
}
