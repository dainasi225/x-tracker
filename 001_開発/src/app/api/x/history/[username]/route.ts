import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const X_API_BASE = "https://api.twitter.com/2";

type XTweet = {
  id: string;
  text?: string;
  conversation_id?: string;
  created_at?: string;
  referenced_tweets?: { type: "retweeted" | "quoted" | "replied_to"; id: string }[];
};

function toInteractionType(tweet: XTweet): string {
  const refs = tweet.referenced_tweets ?? [];
  if (refs.some((r) => r.type === "retweeted")) return "REPOST";
  if (refs.some((r) => r.type === "quoted")) return "QUOTE";
  if (refs.some((r) => r.type === "replied_to")) return "REPLY";
  if (tweet.conversation_id && tweet.conversation_id !== tweet.id) return "REPLY";
  return "OTHER";
}

/**
 * POST /api/x/history/[username]?limit=50
 *
 * 既存アカウントの過去投稿を X API から取得し、Interaction に取り込む。
 * - すでに同じ postUrl があるものはスキップ（重複防止）
 * - 取得件数は 5〜100 の範囲（デフォルト 30）
 */
export async function POST(
  request: Request,
  { params }: { params: { username: string } }
) {
  const bearerToken = process.env.X_API_BEARER_TOKEN;
  if (!bearerToken) {
    return NextResponse.json(
      { error: "X_API_BEARER_TOKEN が設定されていません" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.max(
    5,
    Math.min(100, Number.parseInt(searchParams.get("limit") ?? "30", 10) || 30)
  );

  const target = await prisma.target.findUnique({
    where: { username: params.username },
    select: { id: true, username: true },
  });

  if (!target) {
    return NextResponse.json({ error: "ターゲットが見つかりません" }, { status: 404 });
  }

  // 1) username -> user id
  const userRes = await fetch(
    `${X_API_BASE}/users/by/username/${params.username}?user.fields=id`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
      cache: "no-store",
    }
  );

  if (!userRes.ok) {
    const detail = await userRes.json().catch(() => ({}));
    return NextResponse.json({ error: "X API ユーザー取得エラー", detail }, { status: userRes.status });
  }

  const userJson = await userRes.json();
  const userId = userJson?.data?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "X ユーザーIDが取得できませんでした" }, { status: 502 });
  }

  // 2) tweets history
  const tweetsRes = await fetch(
    `${X_API_BASE}/users/${userId}/tweets?max_results=${limit}&tweet.fields=created_at,conversation_id,referenced_tweets`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
      cache: "no-store",
    }
  );

  if (!tweetsRes.ok) {
    const detail = await tweetsRes.json().catch(() => ({}));
    return NextResponse.json({ error: "X API 履歴取得エラー", detail }, { status: tweetsRes.status });
  }

  const tweetsJson = await tweetsRes.json();
  const tweets = (tweetsJson?.data ?? []) as XTweet[];

  if (tweets.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0, totalFetched: 0 });
  }

  const postUrls = tweets.map((t) => `https://x.com/${target.username}/status/${t.id}`);
  const existing = await prisma.interaction.findMany({
    where: { targetId: target.id, postUrl: { in: postUrls } },
    select: { postUrl: true },
  });
  const existingSet = new Set(existing.map((e) => e.postUrl).filter((v): v is string => Boolean(v)));

  const toCreate = tweets
    .filter((t) => !existingSet.has(`https://x.com/${target.username}/status/${t.id}`))
    .map((t) => ({
      targetId: target.id,
      type: toInteractionType(t),
      content: t.text ?? null,
      postUrl: `https://x.com/${target.username}/status/${t.id}`,
      result: "NO_RESPONSE",
      sentiment: null,
      topic: "IMPORTED_FROM_X",
      notes: "X API から取り込んだ過去データ",
      createdAt: t.created_at ? new Date(t.created_at) : undefined,
    }));

  if (toCreate.length > 0) {
    await prisma.interaction.createMany({ data: toCreate });
  }

  return NextResponse.json({
    imported: toCreate.length,
    skipped: tweets.length - toCreate.length,
    totalFetched: tweets.length,
  });
}

