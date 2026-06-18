/** Actions supportées par l’API vocale */
export type TransactionAction =
  | "transfer"
  | "withdraw"
  | "balance"
  | "billPayment"
  | "airtime"
  | "miniStatement"
  | "sendToBank";

export interface TransactionRequestBody {
  sessionId: string;
  userId: string;
  country: string;
  action: TransactionAction;
  params: Record<string, unknown>;
  encryptedPin: string;
}

export interface TransactionEnqueueResponse {
  jobId: string;
  status: "pending";
  estimatedSeconds: number;
  voiceResponse: string;
}

export interface TransactionStatusResponse {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  result?: {
    success: boolean;
    mtnMessage: string;
    voiceResponse: string;
    transactionId?: string;
  };
}
