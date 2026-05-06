-- CreateTable
CREATE TABLE "UserPersona" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "nicheKeywords" TEXT NOT NULL DEFAULT '',
    "avgEngagementRate" REAL NOT NULL DEFAULT 0,
    "ffRatio" REAL NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
