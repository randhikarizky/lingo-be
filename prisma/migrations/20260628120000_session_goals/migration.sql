-- Milestone 5.5: Session Goals
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "sessionGoals" JSONB;
