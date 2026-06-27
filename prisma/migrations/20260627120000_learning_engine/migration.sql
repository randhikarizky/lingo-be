-- Milestone 5: Learning Engine metadata on conversations
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "difficulty" TEXT NOT NULL DEFAULT 'beginner';
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "objective" TEXT NOT NULL DEFAULT '';
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "summary" JSONB;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "metrics" JSONB;

UPDATE "conversations" SET "scenarioType" = 'restaurant' WHERE "scenarioType" = 'free' OR "scenarioType" = '';
