-- Sync conversations/messages with Prisma schema (character + personality + correction)
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "characterId" TEXT NOT NULL DEFAULT 'maya';
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "personality" TEXT NOT NULL DEFAULT 'santai';

ALTER TABLE "conversations" ALTER COLUMN "title" DROP NOT NULL;

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "correction" JSONB;
