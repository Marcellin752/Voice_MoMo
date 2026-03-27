/**
 * Délais de retry BullMQ : immédiat, +5s, +15s.
 */
export const USSD_BACKOFF = {
  type: "custom" as const,
  delay: (attemptsMade: number): number | null => {
    if (attemptsMade === 0) return 0;
    if (attemptsMade === 1) return 5000;
    if (attemptsMade === 2) return 15000;
    return null;
  },
};
