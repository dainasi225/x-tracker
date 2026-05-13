-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Target" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "followerCount" INTEGER,
    "followingCount" INTEGER,
    "isFollowing" BOOLEAN NOT NULL DEFAULT false,
    "isFollowedByMe" BOOLEAN NOT NULL DEFAULT false,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklistReason" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "phase" TEXT NOT NULL DEFAULT 'PROSPECT',
    "tags" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "lastApproachedAt" DATETIME,
    "nextApproachAt" DATETIME,
    "xApiCachedAt" DATETIME,
    "xFollowerCount" INTEGER,
    "xFollowingCount" INTEGER,
    "xTweetCount" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Target" ("bio", "blacklistReason", "createdAt", "displayName", "followerCount", "followingCount", "id", "isBlacklisted", "isFollowing", "lastApproachedAt", "nextApproachAt", "notes", "phase", "priority", "tags", "updatedAt", "username", "xApiCachedAt", "xFollowerCount", "xFollowingCount", "xTweetCount") SELECT "bio", "blacklistReason", "createdAt", "displayName", "followerCount", "followingCount", "id", "isBlacklisted", "isFollowing", "lastApproachedAt", "nextApproachAt", "notes", "phase", "priority", "tags", "updatedAt", "username", "xApiCachedAt", "xFollowerCount", "xFollowingCount", "xTweetCount" FROM "Target";
DROP TABLE "Target";
ALTER TABLE "new_Target" RENAME TO "Target";
CREATE UNIQUE INDEX "Target_username_key" ON "Target"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
