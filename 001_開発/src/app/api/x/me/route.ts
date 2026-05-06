import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const X_API_BASE = "https://api.twitter.com/2";

/**
 * POST /api/x/me
 * X API認証で自分の公開メトリクスを取得し、UserPersonaへ同期する。
 */
export async function POST(request: Request) {
  const bearerToken = process.env.X_API_BEARER_TOKEN;
  if (!bearerToken) {
    return NextResponse.json(
      { error: "X_API_BEARER_TOKEN が設定されていません" },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const username =
    String(body?.username ?? process.env.X_MY_USERNAME ?? "")
      .replace("@", "")
      .trim();

  if (!username) {
    return NextResponse.json(
      { error: "username が必要です（入力 or X_MY_USERNAME）" },
      { status: 400 }
    );
  }

  const res = await fetch(
    `${X_API_BASE}/users/by/username/${username}?user.fields=public_metrics`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const title = String(detail?.title ?? "");
    if (title === "CreditsDepleted") {
      return NextResponse.json(
        {
          error:
            "X APIのクレジットが不足しています。Developer Portalで課金/プランを確認してください。",
          detail,
        },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: "X API エラー", detail },
      { status: res.status }
    );
  }

  const data = await res.json();
  const metrics = data?.data?.public_metrics;
  if (!metrics) {
    return NextResponse.json(
      { error: "自分のメトリクス取得に失敗しました" },
      { status: 502 }
    );
  }

  const followerCount = Number(metrics.followers_count ?? 0);
  const followingCount = Number(metrics.following_count ?? 0);
  const ffRatio = followerCount / Math.max(1, followingCount);

  const persona = await prisma.userPersona.upsert({
    where: { id: "default" },
    update: {
      xUsername: username,
      xApiCachedAt: new Date(),
      followerCount,
      ffRatio,
    },
    create: {
      id: "default",
      xUsername: username,
      xApiCachedAt: new Date(),
      followerCount,
      ffRatio,
      nicheKeywords: "",
      avgEngagementRate: 0,
    },
  });

  return NextResponse.json({
    username,
    followerCount: persona.followerCount,
    ffRatio: persona.ffRatio,
    xApiCachedAt: persona.xApiCachedAt,
  });
}
