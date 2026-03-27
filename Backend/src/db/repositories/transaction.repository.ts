import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

/**
 * Persistance des transactions USSD MTN.
 */
export async function createPendingTransaction(data: {
  userId: string;
  jobId: string;
  action: string;
  country: string;
  toNumber?: string | null;
  amount?: number | null;
}) {
  return prisma.mtnUssdTransaction.create({
    data: {
      userId: data.userId,
      jobId: data.jobId,
      action: data.action,
      country: data.country,
      toNumber: data.toNumber ?? undefined,
      amount: data.amount != null ? new Prisma.Decimal(data.amount) : undefined,
      status: "PENDING",
    },
  });
}

export async function updateTransactionByJobId(
  jobId: string,
  data: {
    status: string;
    mtnResponse?: string;
    voiceResponse?: string;
    failureReason?: string;
    mtnRef?: string;
    retryCount?: number;
  }
) {
  const done = data.status === "COMPLETED" || data.status === "FAILED";
  return prisma.mtnUssdTransaction.update({
    where: { jobId },
    data: {
      status: data.status,
      mtnResponse: data.mtnResponse,
      voiceResponse: data.voiceResponse,
      failureReason: data.failureReason,
      mtnRef: data.mtnRef,
      retryCount: data.retryCount,
      ...(done ? { completedAt: new Date() } : {}),
    },
  });
}

export async function findByJobId(jobId: string) {
  return prisma.mtnUssdTransaction.findUnique({ where: { jobId } });
}
