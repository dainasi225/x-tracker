import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const X_API_BASE = "https://api.twitter.com/2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間キャッシュ（API費用最小化）

/**
 * GET /api/x/user/[username]
 *
 * X API v2 でユーザー情報を取得してキャッシュする。
 * 24h 以内にキャッシュ済みの場合は API を叩かず DB の値を返す。
 *
 * 必要な環境変数: X_API_BEARER_TOKEN
 * ※ Bearer Token は Read-only で十分。従量課金は 1リクエスト約 $0.003 程度。
 */
export async function POST(
  _request: Request,
  { params }: { params: { username: string } }
) {
  const bearerToken = process.env.X_API_BEARER_TOKEN;
  if (!bearerToken) {
    return NextResponse.json(
      { error: "X_API_BEARER_TOKEN が設定されていません" },
      { status: 503 }
    );
  }

  const target = await prisma.target.findUnique({
    where: { username: params.username },
    select: {
      id: true,
      xApiCachedAt: true,
      xFollowerCount: true,
      xFollowingCount: true,
      xTweetCount: true,
    },
  });

  if (!target) {
    return NextResponse.json({ error: "ターゲットが見つかりません" }, { status: 404 });
  }

  // キャッシュ有効期間内ならそのまま返す
  if (
    target.xApiCachedAt &&
    Date.now() - new Date(target.xApiCachedAt).getTime() < CACHE_TTL_MS
  ) {
    return NextResponse.json({
      cached: true,
      cachedAt: target.xApiCachedAt,
      followerCount: target.xFollowerCount,
      followingCount: target.xFollowingCount,
      tweetCount: target.xTweetCount,
    });
  }

  // X API v2 呼び出し
  const res = await fetch(
    `${X_API_BASE}/users/by/username/${params.username}?user.fields=public_metrics`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
      // Next.js のキャッシュは使わず毎回フレッシュを取得（DBでキャッシュ管理する）
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: "X API エラー", detail: body },
      { status: res.status }
    );
  }

  const data = await res.json();
  const metrics = data?.data?.public_metrics;

  if (!metrics) {
    return NextResponse.json({ error: "メトリクスが取得できませんでした" }, { status: 502 });
  }

  // DB に保存（キャッシュ更新）
  const updated = await prisma.target.update({
    where: { id: target.id },
    data: {
      xFollowerCount: metrics.followers_count,
      xFollowingCount: metrics.following_count,
      xTweetCount: metrics.tweet_count,
      xApiCachedAt: new Date(),
      // 手動入力フィールドも同期（任意）
      followerCount: metrics.followers_count,
      followingCount: metrics.following_count,
    },
    select: {
      xFollowerCount: true,
      xFollowingCount: true,
      xTweetCount: true,
      xApiCachedAt: true,
    },
  });

  return NextResponse.json({
    cached: false,
    cachedAt: updated.xApiCachedAt,
    followerCount: updated.xFollowerCount,
    followingCount: updated.xFollowingCount,
    tweetCount: updated.xTweetCount,
  });
}
