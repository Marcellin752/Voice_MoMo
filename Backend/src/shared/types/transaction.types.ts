import type { TransactionAction } from "./api.types";

export interface UssdJobPayload {
  sessionId: string;
  userId: string;
  country: string;
  action: TransactionAction;
  params: Record<string, unknown>;
  encryptedPin: string;
}
