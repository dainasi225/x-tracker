-- CreateTable
CREATE TABLE "QuoteCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tweetId" TEXT NOT NULL,
    "tweetUrl" TEXT,
    "conversationId" TEXT,
    "text" TEXT NOT NULL,
    "authorUsername" TEXT,
    "authorName" TEXT,
    "authorBio" TEXT,
    "authorFollowerCount" INTEGER,
    "authorFollowingCount" INTEGER,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "repostCount" INTEGER NOT NULL DEFAULT 0,
    "quoteCount" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "recommendedAction" TEXT NOT NULL,
    "quoteScore" INTEGER NOT NULL DEFAULT 0,
    "replyScore" INTEGER NOT NULL DEFAULT 0,
    "repostScore" INTEGER NOT NULL DEFAULT 0,
    "targetAddScore" INTEGER NOT NULL DEFAULT 0,
    "topicScore" INTEGER NOT NULL DEFAULT 0,
    "conversationScore" INTEGER NOT NULL DEFAULT 0,
    "influenceScore" INTEGER NOT NULL DEFAULT 0,
    "freshnessScore" INTEGER NOT NULL DEFAULT 0,
    "noiseScore" INTEGER NOT NULL DEFAULT 0,
    "reasons" TEXT NOT NULL DEFAULT '',
    "searchQuery" TEXT NOT NULL,
    "searchKeywords" TEXT NOT NULL DEFAULT '',
    "postedAt" DATETIME,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "searchCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "QuoteCandidate_tweetId_key" ON "QuoteCandidate"("tweetId");

