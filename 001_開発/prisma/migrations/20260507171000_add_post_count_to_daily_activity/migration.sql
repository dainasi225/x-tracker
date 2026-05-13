-- Add postCount for daily post activity gauge
ALTER TABLE "DailyActivity" ADD COLUMN "postCount" INTEGER NOT NULL DEFAULT 0;
