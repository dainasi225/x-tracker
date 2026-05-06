import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const X_API_BASE = "https://api.twitter.com/2";

type XUser = {
  id: string;
  username: string;
  name?: string;
  description?: string;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
  };
};

type XTweet = {
  in_reply_to_user_id?: string;
};

function normalizeUsername(value: string): string {
  return value.replace("@", "").trim().toLowerCase();
}

function buildFollowContext(
  followerCount: number | null,
  followingCount: number | null,
  myFollowerCount: number,
  myFfRatio: number
): { priority: "HIGH" | "MEDIUM" | "LOW"; tags: string[]; note: string } {
  const followers = followerCount ?? 0;
  const followings = Math.max(1, followingCount ?? 1);
  const ffRatio = followers / followings;
  const ratioToMe = myFollowerCount > 0 ? followers / myFollowerCount : 1;

  const tags = ["AUTO_DISCOVERED"];
  let score = 0;

  if (followers < 3000) {
    score += 2;
    tags.push("SMALL_ACCOUNT");
  } else if (followers < 10000) {
    score += 1;
    tags.push("MID_ACCOUNT");
  } else if (followers > 50000) {
    score -= 2;
    tags.push("LARGE_ACCOUNT");
  }

  if (ffRatio < 1.5) {
    score += 2;
    tags.push("FF_FRIENDLY");
  } else if (ffRatio > 5) {
    score -= 1;
    tags.push("FF_HIGH");
  }

  if (ratioToMe >= 0.3 && ratioToMe <= 3) {
    score += 2;
    tags.push("SIZE_MATCH");
  } else if (ratioToMe > 10) {
    score -= 2;
    tags.push("SIZE_GAP_LARGE");
  }

  if (myFfRatio > 0 && Math.abs(ffRatio - myFfRatio) <= 0.6) {
    score += 1;
    tags.push("FF_STYLE_MATCH");
  }

  const priority: "HIGH" | "MEDIUM" | "LOW" = score >= 4 ? "HIGH" : score <= 0 ? "LOW" : "MEDIUM";
  const note = `最近やりとり相手から自動追加 / followers=${followers}, following=${followings}, ff=${ffRatio.toFixed(
    2
  )}, ratioToMe=${ratioToMe.toFixed(2)}x`;
  return { priority, tags, note };
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
  const limit = Math.max(10, Math.min(100, Number(body?.limit ?? 40) || 40));

  const me = await prisma.userPersona.findUnique({
    where: { id: "default" },
    select: { xUsername: true, followerCount: true, ffRatio: true },
  });
  const myUsername = normalizeUsername(
    String(body?.username ?? me?.xUsername ?? process.env.X_MY_USERNAME ?? "")
  );
  const myFollowerCount = Number(me?.followerCount ?? 0);
  const myFfRatio = Number(me?.ffRatio ?? 1);

  if (!myUsername) {
    return NextResponse.json(
      { error: "自分のユーザー名が未設定です。設定画面で同期してください。" },
      { status: 400 }
    );
  }

  // 1) 自分の user_id 取得
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
  const meJson = await meRes.json();
  const myUserId = String(meJson?.data?.id ?? "");
  if (!myUserId) {
    return NextResponse.json({ error: "自分のXユーザーIDが取得できません" }, { status: 502 });
  }

  // 1.5) 自分のフォロワー一覧（最大 1,000）を取得
  const followerUsernameSet = new Set<string>();
  let paginationToken: string | null = null;
  for (let i = 0; i < 10; i++) {
    const followersRes: Response = await fetch(
      `${X_API_BASE}/users/${myUserId}/followers?max_results=100&user.fields=username${
        paginationToken ? `&pagination_token=${paginationToken}` : ""
      }`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        cache: "no-store",
      }
    );
    if (!followersRes.ok) break;
    const followersJson: {
      data?: { username?: string }[];
      meta?: { next_token?: string };
    } = await followersRes.json().catch(() => ({}));
    const users = (followersJson?.data ?? []) as { username?: string }[];
    users.forEach((u) => {
      if (!u?.username) return;
      followerUsernameSet.add(normalizeUsername(u.username));
    });
    paginationToken = String(followersJson?.meta?.next_token ?? "");
    if (!paginationToken) break;
  }

  // 2) メンションしてきた相手（自分へのやりとり）
  const mentionRes = await fetch(
    `${X_API_BASE}/users/${myUserId}/mentions?max_results=${Math.min(limit, 50)}&expansions=author_id&user.fields=username,name,description,public_metrics&tweet.fields=author_id`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
      cache: "no-store",
    }
  );
  const mentionUsers: XUser[] = [];
  if (mentionRes.ok) {
    const mentionJson = await mentionRes.json().catch(() => ({}));
    const users = (mentionJson?.includes?.users ?? []) as XUser[];
    mentionUsers.push(...users);
  }

  // 3) 自分が返信した相手（自分からのやりとり）
  const myTweetsRes = await fetch(
    `${X_API_BASE}/users/${myUserId}/tweets?max_results=${Math.min(limit, 100)}&tweet.fields=in_reply_to_user_id,referenced_tweets`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
      cache: "no-store",
    }
  );
  const repliedToIds = new Set<string>();
  if (myTweetsRes.ok) {
    const myTweetsJson = await myTweetsRes.json().catch(() => ({}));
    const tweets = (myTweetsJson?.data ?? []) as XTweet[];
    tweets.forEach((t) => {
      if (t.in_reply_to_user_id && t.in_reply_to_user_id !== myUserId) {
        repliedToIds.add(t.in_reply_to_user_id);
      }
    });
  }

  if (repliedToIds.size > 0) {
    const ids = Array.from(repliedToIds).slice(0, 100);
    const lookupRes = await fetch(
      `${X_API_BASE}/users?ids=${ids.join(",")}&user.fields=username,name,description,public_metrics`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        cache: "no-store",
      }
    );
    if (lookupRes.ok) {
      const lookupJson = await lookupRes.json().catch(() => ({}));
      const users = (lookupJson?.data ?? []) as XUser[];
      mentionUsers.push(...users);
    }
  }

  // 重複除去 + 自分除外
  const candidateMap = new Map<string, XUser>();
  for (const user of mentionUsers) {
    const uname = normalizeUsername(user.username ?? "");
    if (!uname || uname === myUsername) continue;
    if (!candidateMap.has(uname)) candidateMap.set(uname, user);
  }
  const candidates = Array.from(candidateMap.values());

  if (candidates.length === 0) {
    return NextResponse.json({
      scanned: 0,
      created: 0,
      skippedExisting: 0,
      message: "最近のやりとり相手が見つかりませんでした",
    });
  }

  const usernames = candidates.map((u) => normalizeUsername(u.username));
  const existing = await prisma.target.findMany({
    where: { username: { in: usernames } },
    select: {
      id: true,
      username: true,
      phase: true,
      isBlacklisted: true,
      tags: true,
    },
  });
  const existingByUsername = new Map(existing.map((x) => [normalizeUsername(x.username), x]));

  let created = 0;
  let updated = 0;
  let followersExcluded = 0;

  for (const u of candidates) {
    const uname = normalizeUsername(u.username);
    const followerCount = u.public_metrics?.followers_count ?? null;
    const followingCount = u.public_metrics?.following_count ?? null;
    const followContext = buildFollowContext(
      followerCount,
      followingCount,
      myFollowerCount,
      myFfRatio
    );
    const isFollowerNow = followerUsernameSet.has(uname);
    const existingTarget = existingByUsername.get(uname);
    const mergedTags = Array.from(
      new Set(
        [
          ...(existingTarget?.tags?.split(",").map((x) => x.trim()).filter(Boolean) ?? []),
          ...followContext.tags,
        ].filter(Boolean)
      )
    ).join(",");

    if (!existingTarget) {
      await prisma.target.create({
        data: {
          username: uname,
          displayName: u.name ?? null,
          bio: u.description ?? null,
          followerCount,
          followingCount,
          isFollowing: isFollowerNow,
          priority: followContext.priority,
          phase: isFollowerNow ? "PARTNER" : "PROSPECT",
          tags: mergedTags,
          notes: followContext.note,
        },
      });
      created += 1;
      if (isFollowerNow) followersExcluded += 1;
      continue;
    }

    if (existingTarget.isBlacklisted) continue;

    await prisma.target.update({
      where: { id: existingTarget.id },
      data: {
        displayName: u.name ?? null,
        bio: u.description ?? null,
        followerCount,
        followingCount,
        isFollowing: isFollowerNow ? true : undefined,
        priority: followContext.priority,
        phase: isFollowerNow ? "PARTNER" : undefined,
        tags: mergedTags,
        notes: followContext.note,
      },
    });
    updated += 1;
    if (isFollowerNow) followersExcluded += 1;
  }

  // 候補に含まれない既存ターゲットでも、フォロワー判定できたものは除外
  if (followerUsernameSet.size > 0) {
    const followerUsernames = Array.from(followerUsernameSet);
    const result = await prisma.target.updateMany({
      where: {
        username: { in: followerUsernames },
        isBlacklisted: false,
        isFollowing: false,
      },
      data: {
        isFollowing: true,
        phase: "PARTNER",
      },
    });
    followersExcluded += result.count;
  }

  return NextResponse.json({
    scanned: candidates.length,
    created,
    updated,
    followersExcluded,
    skippedExisting: Math.max(0, candidates.length - created - updated),
  });
}
