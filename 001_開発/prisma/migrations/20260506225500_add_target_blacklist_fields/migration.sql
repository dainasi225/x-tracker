-- AlterTable
ALTER TABLE "Target" ADD COLUMN "isBlacklisted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Target" ADD COLUMN "blacklistReason" TEXT;
