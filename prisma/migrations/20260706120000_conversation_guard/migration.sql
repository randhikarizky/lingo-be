-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "focusScore" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "conversations" ADD COLUMN "guardRedirectCount" INTEGER NOT NULL DEFAULT 0;
