import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const X_API_BASE = "https://api.twitter.com/2";

type XTweet = {
  id: string;
  text?: string;
  created_at?: string;
  author_id?: string;
  in_reply_to_user_id?: string;
  conversation_id?: string;
};

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

function normalizeUsername(value: string): string {
  return value.replace("@", "").trim().toLowerCase();
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

  // 1) 自分ユーザーID
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

  // 2) 自分の最近投稿（返信先IDを取得）
  const myTweetsRes = await fetch(
    `${X_API_BASE}/users/${myUserId}/tweets?max_results=${limit}&tweet.fields=created_at,conversation_id,in_reply_to_user_id`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
      cache: "no-store",
    }
  );
  const myTweets = myTweetsRes.ok
    ? (((await myTweetsRes.json().catch(() => ({})))?.data ?? []) as XTweet[])
    : [];

  // 3) 自分へのメンション（相手ユーザーを取得）
  const mentionRes = await fetch(
    `${X_API_BASE}/users/${myUserId}/mentions?max_results=${Math.min(limit, 50)}&expansions=author_id&user.fields=username,name,description,public_metrics&tweet.fields=author_id,created_at`,
    {
      headers: { Authorization: `Bearer ${bearerToken}` },
      cache: "no-store",
    }
  );
  const mentionJson = mentionRes.ok ? await mentionRes.json().catch(() => ({})) : {};
  const mentionTweets = ((mentionJson?.data ?? []) as XTweet[]).filter(
    (t) => t.author_id && t.author_id !== myUserId
  );
  const mentionUsers = (mentionJson?.includes?.users ?? []) as XUser[];

  // 4) 返信先ユーザー情報
  const repliedIds = Array.from(
    new Set(
      myTweets
        .map((t) => t.in_reply_to_user_id)
        .filter((id): id is string => Boolean(id) && id !== myUserId)
    )
  ).slice(0, 100);

  let repliedUsers: XUser[] = [];
  if (repliedIds.length > 0) {
    const usersRes = await fetch(
      `${X_API_BASE}/users?ids=${repliedIds.join(",")}&user.fields=username,name,description,public_metrics`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
        cache: "no-store",
      }
    );
    if (usersRes.ok) {
      const usersJson = await usersRes.json().catch(() => ({}));
      repliedUsers = (usersJson?.data ?? []) as XUser[];
    }
  }

  const userMap = new Map<string, XUser>();
  [...mentionUsers, ...repliedUsers].forEach((u) => {
    if (!u?.id) return;
    userMap.set(u.id, u);
  });

  // 5) 先にターゲットを用意（なければ自動作成）
  const usernames = Array.from(
    new Set(
      Array.from(userMap.values())
        .map((u) => normalizeUsername(u.username ?? ""))
        .filter(Boolean)
    )
  );

  const existingTargets = await prisma.target.findMany({
    where: { username: { in: usernames } },
    select: { id: true, username: true },
  });
  const targetByUsername = new Map(existingTargets.map((t) => [normalizeUsername(t.username), t.id]));

  const missingUsers = Array.from(userMap.values()).filter(
    (u) => !targetByUsername.has(normalizeUsername(u.username ?? ""))
  );
  if (missingUsers.length > 0) {
    await prisma.target.createMany({
      data: missingUsers.map((u) => ({
        username: normalizeUsername(u.username ?? ""),
        displayName: u.name ?? null,
        bio: u.description ?? null,
        followerCount: u.public_metrics?.followers_count ?? null,
        followingCount: u.public_metrics?.following_count ?? null,
        priority: "MEDIUM",
        phase: "PROSPECT",
        tags: "AUTO_DISCOVERED,AUTO_SYNCED",
        notes: "インタラクション一括同期で自動追加",
      })),
    });

    const allTargets = await prisma.target.findMany({
      where: { username: { in: usernames } },
      select: { id: true, username: true },
    });
    allTargets.forEach((t) => targetByUsername.set(normalizeUsername(t.username), t.id));
  }

  // 6) 自動生成する interaction 候補
  const autoInteractions: {
    targetId: string;
    type: string;
    content: string | null;
    postUrl: string;
    result: string;
    sentiment: null;
    topic: string;
    notes: string;
    createdAt?: Date;
  }[] = [];

  myTweets.forEach((t) => {
    if (!t.in_reply_to_user_id) return;
    const user = userMap.get(t.in_reply_to_user_id);
    if (!user?.username) return;
    const targetId = targetByUsername.get(normalizeUsername(user.username));
    if (!targetId) return;
    autoInteractions.push({
      targetId,
      type: "REPLY",
      content: t.text ?? null,
      postUrl: `https://x.com/${myUsername}/status/${t.id}`,
      result: "NO_RESPONSE",
      sentiment: null,
      topic: "AUTO_SYNC_REPLY",
      notes: "X API 一括同期（自分の返信）",
      createdAt: t.created_at ? new Date(t.created_at) : undefined,
    });
  });

  mentionTweets.forEach((t) => {
    if (!t.author_id) return;
    const user = userMap.get(t.author_id);
    if (!user?.username) return;
    const targetId = targetByUsername.get(normalizeUsername(user.username));
    if (!targetId) return;
    autoInteractions.push({
      targetId,
      type: "MENTION",
      content: t.text ?? null,
      postUrl: `https://x.com/${user.username}/status/${t.id}`,
      result: "NO_RESPONSE",
      sentiment: null,
      topic: "AUTO_SYNC_MENTION",
      notes: "X API 一括同期（相手からのメンション）",
      createdAt: t.created_at ? new Date(t.created_at) : undefined,
    });
  });

  if (autoInteractions.length === 0) {
    return NextResponse.json({
      fetched: { myTweets: myTweets.length, mentions: mentionTweets.length },
      imported: 0,
      skipped: 0,
    });
  }

  const postUrls = autoInteractions.map((x) => x.postUrl);
  const existingInteractions = await prisma.interaction.findMany({
    where: { postUrl: { in: postUrls } },
    select: { postUrl: true },
  });
  const existingPostSet = new Set(
    existingInteractions.map((x) => x.postUrl).filter((v): v is string => Boolean(v))
  );

  const toCreate = autoInteractions.filter((x) => !existingPostSet.has(x.postUrl));
  if (toCreate.length > 0) {
    await prisma.interaction.createMany({ data: toCreate });
  }

  return NextResponse.json({
    fetched: { myTweets: myTweets.length, mentions: mentionTweets.length },
    imported: toCreate.length,
    skipped: autoInteractions.length - toCreate.length,
  });
}
