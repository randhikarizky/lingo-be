-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN "paymentUrl" TEXT;

-- CreateTable
CREATE TABLE "payment_audit_logs" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_audit_logs_transactionId_idx" ON "payment_audit_logs"("transactionId");

-- CreateIndex
CREATE INDEX "payment_audit_logs_userId_createdAt_idx" ON "payment_audit_logs"("userId", "createdAt");
