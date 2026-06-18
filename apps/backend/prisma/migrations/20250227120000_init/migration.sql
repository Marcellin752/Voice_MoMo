-- CreateTable
CREATE TABLE "mtn_ussd_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "toNumber" TEXT,
    "amount" DECIMAL(15,2),
    "status" TEXT NOT NULL,
    "mtnResponse" TEXT,
    "voiceResponse" TEXT,
    "failureReason" TEXT,
    "mtnRef" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "mtn_ussd_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mtn_ussd_transactions_jobId_key" ON "mtn_ussd_transactions"("jobId");
CREATE INDEX "mtn_ussd_transactions_userId_idx" ON "mtn_ussd_transactions"("userId");

-- CreateTable
CREATE TABLE "mtn_modem_status" (
    "id" TEXT NOT NULL,
    "portPath" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "simNumber" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "signalLevel" INTEGER,
    "lastHeartbeat" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mtn_modem_status_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mtn_modem_status_portPath_key" ON "mtn_modem_status"("portPath");
