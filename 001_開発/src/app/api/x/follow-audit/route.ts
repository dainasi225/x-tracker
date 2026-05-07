import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const X_API_BASE = "https://api.twitter.com/2";
const MAX_RESULTS_PER_PAGE = 100;

type XUsersPage = {
  data?: { username?: string }[];
  meta?: { next_token?: string };
};

function normalizeUsername(value: string): string {
  return value.replace("@", "").trim().toLowerCase();
}

async function fetchUsernameSet(params: {
  userId: string;
  relation: "followers" | "following";
  bearerToken: string;
  maxPages: number;
}) {
  const usernames = new Set<string>();
  let paginationToken: string | null = null;

  for (let i = 0; i < params.maxPages; i += 1) {
    const url = `${X_API_BASE}/users/${params.userId}/${params.relation}?max_results=${MAX_RESULTS_PER_PAGE}&user.fields=username${
      paginationToken ? `&pagination_token=${paginationToken}` : ""
    }`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${params.bearerToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      return {
        ok: false as const,
        status: res.status,
        detail,
      };
    }

    const json: XUsersPage = await res.json().catch(() => ({}));
    (json.data ?? []).forEach((user) => {
      if (!user?.username) return;
      usernames.add(normalizeUsername(user.username));
    });

    paginationToken = json.meta?.next_token ?? null;
    if (!paginationToken) break;
  }

  return {
    ok: true as const,
    usernames,
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
  const maxPages = Math.max(1, Math.min(20, Number(body?.maxPages ?? 10) || 10));

  const me = await prisma.userPersona.findUnique({
    where: { id: "default" },
    select: { xUsername: true },
  });
  const myUsername = normalizeUsername(
    String(body?.username ?? me?.xUsername ?? process.env.X_MY_USERNAME ?? "")
  );
  if (!myUsername) {
    return NextResponse.json(
      { error: "自分のユーザー名が未設定です。設定画面で同期してください。" },
      { status: 400 }
    );
  }

  const meRes = await fetch(
    `${X_API_BASE}/users/by/username/${myUsername}?user.fields=id`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
      cache: "no-store",
    }
  );
  if (!meRes.ok) {
    const detail = await meRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: "自分のXユーザー情報取得に失敗しました", detail },
      { status: meRes.status }
    );
  }
  const meJson = await meRes.json().catch(() => ({}));
  const myUserId = String(meJson?.data?.id ?? "");
  if (!myUserId) {
    return NextResponse.json(
      { error: "自分のXユーザーIDが取得できません" },
      { status: 502 }
    );
  }

  const followingResult = await fetchUsernameSet({
    userId: myUserId,
    relation: "following",
    bearerToken,
    maxPages,
  });
  if (!followingResult.ok) {
    return NextResponse.json(
      {
        error: "フォロー一覧の取得に失敗しました",
        detail: followingResult.detail,
      },
      { status: followingResult.status }
    );
  }

  const followerResult = await fetchUsernameSet({
    userId: myUserId,
    relation: "followers",
    bearerToken,
    maxPages,
  });
  if (!followerResult.ok) {
    return NextResponse.json(
      {
        error: "フォロワー一覧の取得に失敗しました",
        detail: followerResult.detail,
      },
      { status: followerResult.status }
    );
  }

  const followingOnly = Array.from(followingResult.usernames).filter(
    (username) => !followerResult.usernames.has(username)
  );

  const trackedTargets =
    followingOnly.length > 0
      ? await prisma.target.findMany({
          where: { username: { in: followingOnly } },
          select: {
            id: true,
            username: true,
            displayName: true,
            phase: true,
            isBlacklisted: true,
          },
        })
      : [];
  const trackedByUsername = new Map(
    trackedTargets.map((target) => [normalizeUsername(target.username), target])
  );

  const unmatched = followingOnly.sort().map((username) => {
    const target = trackedByUsername.get(username);
    return {
      username,
      tracked: Boolean(target),
      targetId: target?.id ?? null,
      displayName: target?.displayName ?? null,
      phase: target?.phase ?? null,
      isBlacklisted: target?.isBlacklisted ?? false,
    };
  });

  return NextResponse.json({
    username: myUsername,
    maxPages,
    followingCount: followingResult.usernames.size,
    followerCount: followerResult.usernames.size,
    unmatchedCount: unmatched.length,
    trackedUnmatchedCount: unmatched.filter((item) => item.tracked).length,
    unmatched,
  });
}
