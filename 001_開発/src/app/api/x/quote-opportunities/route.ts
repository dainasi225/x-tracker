import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  authorDiversityMultiplier,
  calculateQuoteOpportunityScore,
  normalizeQuoteKeywords,
  type PersonalHistoryStats,
} from "@/lib/quote-opportunity";

const X_API_BASE = "https://api.twitter.com/2";

type XUser = {
  id: string;
  username: string;
  name?: string;
  description?: string;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
  };
};

type XTweet = {
  id: string;
  text: string;
  author_id?: string;
  conversation_id?: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
    quote_count?: number;
  };
};

function buildQuery(rawQuery: string, nicheKeywords: string[]): string {
  const query = rawQuery.trim();
  if (query) return query;

  const keywords = nicheKeywords.slice(0, 3);
  if (keywords.length === 0) return "-is:retweet lang:ja";
  const topic = keywords.length === 1 ? keywords[0] : `(${keywords.join(" OR ")})`;
  return `${topic} -is:retweet lang:ja`;
}

function normalizeLimit(value: unknown): number {
  const parsed = Number(value ?? 15);
  return Math.max(10, Math.min(50, Number.isFinite(parsed) ? parsed : 15));
}

async function buildPersonalHistory(): Promise<PersonalHistoryStats> {
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const interactions = await prisma.interaction.findMany({
    where: {
      createdAt: { gte: since90d },
      result: { in: ["REPLIED", "FOLLOWED"] },
    },
    select: {
      type: true,
      result: true,
      sentiment: true,
      topic: true,
      target: { select: { followerCount: true, xFollowerCount: true } },
    },
  });

  if (interactions.length === 0) {
    return {
      successfulFollowerAvg: null,
      bestActionType: null,
      bestNicheTags: [],
      positiveRate: 0,
      totalSuccessfulInteractions: 0,
    };
  }

  const followerSamples = interactions
    .map((ix) => ix.target?.xFollowerCount ?? ix.target?.followerCount ?? null)
    .filter((value): value is number => typeof value === "number" && value > 0);
  const successfulFollowerAvg =
    followerSamples.length > 0
      ? Math.round(followerSamples.reduce((sum, x) => sum + x, 0) / followerSamples.length)
      : null;

  const actionCounts: Record<"REPLY" | "QUOTE" | "REPOST", number> = { REPLY: 0, QUOTE: 0, REPOST: 0 };
  for (const ix of interactions) {
    if (ix.type === "REPLY") actionCounts.REPLY += 1;
    else if (ix.type === "QUOTE") actionCounts.QUOTE += 1;
    else if (ix.type === "REPOST") actionCounts.REPOST += 1;
  }
  const bestActionType =
    Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[1] > 0
      ? (Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0][0] as "REPLY" | "QUOTE" | "REPOST")
      : null;

  const topicMap = new Map<string, number>();
  for (const ix of interactions) {
    if (!ix.topic) continue;
    ix.topic
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((tag) => {
        topicMap.set(tag, (topicMap.get(tag) ?? 0) + 1);
      });
  }
  const bestNicheTags = Array.from(topicMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const positiveCount = interactions.filter((ix) => ix.sentiment === "POSITIVE").length;
  const positiveRate = positiveCount / interactions.length;

  return {
    successfulFollowerAvg,
    bestActionType,
    bestNicheTags,
    positiveRate,
    totalSuccessfulInteractions: interactions.length,
  };
}

export async function POST(request: Request) {
  const bearerToken = process.env.X_API_BEARER_TOKEN;
  if (!bearerToken) {
    return NextResponse.json(
      { error: "X_API_BEARER_TOKEN が設定されていません" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const myPersona = await prisma.userPersona.findUnique({ where: { id: "default" } });
  const nicheKeywords = normalizeQuoteKeywords(
    String(body?.keywords ?? myPersona?.nicheKeywords ?? "")
  );
  const query = buildQuery(String(body?.query ?? ""), nicheKeywords);
  const limit = normalizeLimit(body?.limit);
  const personalHistory = await buildPersonalHistory();

  const params = new URLSearchParams({
    query,
    max_results: String(limit),
    expansions: "author_id",
    "tweet.fields": "author_id,created_at,public_metrics,lang,conversation_id",
    "user.fields": "username,name,description,public_metrics",
  });

  const res = await fetch(`${X_API_BASE}/tweets/search/recent?${params.toString()}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: "引用チャンス検索に失敗しました", detail },
      { status: res.status }
    );
  }

  const json = await res.json();
  const tweets = (json?.data ?? []) as XTweet[];
  const users = (json?.includes?.users ?? []) as XUser[];
  const usersById = new Map(users.map((user) => [user.id, user]));
  const myFollowerCount = Number(myPersona?.followerCount ?? 0);

  const scored = tweets.map((tweet) => {
    const author = tweet.author_id ? usersById.get(tweet.author_id) : undefined;
    const metrics = tweet.public_metrics ?? {};
    const createdAt = tweet.created_at ? new Date(tweet.created_at) : new Date();
    const score = calculateQuoteOpportunityScore({
      text: tweet.text,
      authorName: author?.name ?? null,
      authorBio: author?.description ?? null,
      authorFollowerCount: author?.public_metrics?.followers_count ?? null,
      authorFollowingCount: author?.public_metrics?.following_count ?? null,
      createdAt,
      metrics: {
        likeCount: metrics.like_count ?? 0,
        replyCount: metrics.reply_count ?? 0,
        repostCount: metrics.retweet_count ?? 0,
        quoteCount: metrics.quote_count ?? 0,
      },
      myFollowerCount,
      nicheKeywords,
      personalHistory,
    });

    return {
      tweetId: tweet.id,
      tweetUrl: author?.username ? `https://x.com/${author.username}/status/${tweet.id}` : null,
      conversationId: tweet.conversation_id ?? tweet.id,
      text: tweet.text,
      createdAt: createdAt.toISOString(),
      author: author
        ? {
            id: author.id,
            username: author.username,
            name: author.name ?? null,
            bio: author.description ?? null,
            followerCount: author.public_metrics?.followers_count ?? null,
            followingCount: author.public_metrics?.following_count ?? null,
            tweetCount: author.public_metrics?.tweet_count ?? null,
          }
        : null,
      metrics: {
        likeCount: metrics.like_count ?? 0,
        replyCount: metrics.reply_count ?? 0,
        repostCount: metrics.retweet_count ?? 0,
        quoteCount: metrics.quote_count ?? 0,
      },
      score,
    };
  });

  // 会話重複排除：conversation_id ごとに最高スコアの1件だけ残す
  type ScoredOpportunity = (typeof scored)[number];
  const dedupByConversation = new Map<string, ScoredOpportunity>();
  for (const opportunity of scored) {
    const existing = dedupByConversation.get(opportunity.conversationId);
    if (!existing || existing.score.score < opportunity.score.score) {
      dedupByConversation.set(opportunity.conversationId, opportunity);
    }
  }
  const conversationDeduped = Array.from(dedupByConversation.values()).sort(
    (a, b) => b.score.score - a.score.score
  );

  // 著者多様性：同じ著者が連続する場合、2件目以降のスコアに減衰乗数をかける
  const authorAppearances = new Map<string, number>();
  const opportunities = conversationDeduped
    .map((opportunity) => {
      const authorId = opportunity.author?.id ?? "unknown";
      const position = authorAppearances.get(authorId) ?? 0;
      authorAppearances.set(authorId, position + 1);
      const multiplier = authorDiversityMultiplier(position);
      const adjustedTotal = Math.round(opportunity.score.score * multiplier);
      const adjustedActions = {
        quote: Math.round(opportunity.score.actionScores.quote * multiplier),
        reply: Math.round(opportunity.score.actionScores.reply * multiplier),
        repost: Math.round(opportunity.score.actionScores.repost * multiplier),
        targetAdd: Math.round(opportunity.score.actionScores.targetAdd * multiplier),
      };
      return {
        ...opportunity,
        authorPosition: position,
        score: {
          ...opportunity.score,
          score: adjustedTotal,
          actionScores: adjustedActions,
        },
      };
    })
    .sort((a, b) => b.score.score - a.score.score);

  let savedCount = 0;
  let saveError: string | null = null;
  try {
    for (const opportunity of opportunities) {
      await prisma.quoteCandidate.upsert({
        where: { tweetId: opportunity.tweetId },
        create: {
          tweetId: opportunity.tweetId,
          tweetUrl: opportunity.tweetUrl,
          conversationId: opportunity.conversationId,
          text: opportunity.text,
          authorUsername: opportunity.author?.username ?? null,
          authorName: opportunity.author?.name ?? null,
          authorBio: opportunity.author?.bio ?? null,
          authorFollowerCount: opportunity.author?.followerCount ?? null,
          authorFollowingCount: opportunity.author?.followingCount ?? null,
          likeCount: opportunity.metrics.likeCount,
          replyCount: opportunity.metrics.replyCount,
          repostCount: opportunity.metrics.repostCount,
          quoteCount: opportunity.metrics.quoteCount,
          totalScore: opportunity.score.score,
          recommendedAction: opportunity.score.action,
          quoteScore: opportunity.score.actionScores.quote,
          replyScore: opportunity.score.actionScores.reply,
          repostScore: opportunity.score.actionScores.repost,
          targetAddScore: opportunity.score.actionScores.targetAdd,
          topicScore: opportunity.score.axes.topic,
          conversationScore: opportunity.score.axes.conversation,
          influenceScore: opportunity.score.axes.influence,
          freshnessScore: opportunity.score.axes.freshness,
          noiseScore: opportunity.score.axes.noise,
          reasons: opportunity.score.reasons.join(" / "),
          searchQuery: query,
          searchKeywords: nicheKeywords.join(","),
          postedAt: new Date(opportunity.createdAt),
        },
        update: {
          tweetUrl: opportunity.tweetUrl,
          conversationId: opportunity.conversationId,
          text: opportunity.text,
          authorUsername: opportunity.author?.username ?? null,
          authorName: opportunity.author?.name ?? null,
          authorBio: opportunity.author?.bio ?? null,
          authorFollowerCount: opportunity.author?.followerCount ?? null,
          authorFollowingCount: opportunity.author?.followingCount ?? null,
          likeCount: opportunity.metrics.likeCount,
          replyCount: opportunity.metrics.replyCount,
          repostCount: opportunity.metrics.repostCount,
          quoteCount: opportunity.metrics.quoteCount,
          totalScore: opportunity.score.score,
          recommendedAction: opportunity.score.action,
          quoteScore: opportunity.score.actionScores.quote,
          replyScore: opportunity.score.actionScores.reply,
          repostScore: opportunity.score.actionScores.repost,
          targetAddScore: opportunity.score.actionScores.targetAdd,
          topicScore: opportunity.score.axes.topic,
          conversationScore: opportunity.score.axes.conversation,
          influenceScore: opportunity.score.axes.influence,
          freshnessScore: opportunity.score.axes.freshness,
          noiseScore: opportunity.score.axes.noise,
          reasons: opportunity.score.reasons.join(" / "),
          searchQuery: query,
          searchKeywords: nicheKeywords.join(","),
          postedAt: new Date(opportunity.createdAt),
          lastSeenAt: new Date(),
          searchCount: { increment: 1 },
        },
      });
      savedCount += 1;
    }
  } catch (error) {
    saveError =
      error instanceof Error
        ? error.message
        : "引用チャンス候補の保存に失敗しました";
  }

  return NextResponse.json({
    query,
    keywords: nicheKeywords,
    scanned: tweets.length,
    deduplicated: tweets.length - conversationDeduped.length,
    savedCount,
    saveError,
    personalHistory,
    opportunities,
  });
}
