-- Milestone 6: Subscription & Usage Foundation
CREATE TYPE "PlanType" AS ENUM ('FREE', 'STARTER', 'PRO', 'LIFETIME');
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED');
CREATE TYPE "UsageType" AS ENUM ('SPEAKING', 'CHAT', 'TTS', 'STT');

CREATE TABLE IF NOT EXISTS "user_plans" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "plan" "PlanType" NOT NULL DEFAULT 'FREE',
  "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_plans_userId_key" ON "user_plans"("userId");

ALTER TABLE "user_plans"
  ADD CONSTRAINT "user_plans_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "usage_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "UsageType" NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "usage_logs_userId_createdAt_idx" ON "usage_logs"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "usage_logs_userId_type_createdAt_idx" ON "usage_logs"("userId", "type", "createdAt");

ALTER TABLE "usage_logs"
  ADD CONSTRAINT "usage_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
