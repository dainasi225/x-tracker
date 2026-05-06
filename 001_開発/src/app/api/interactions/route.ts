import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get("targetId");

  const interactions = await prisma.interaction.findMany({
    where: targetId ? { targetId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { target: true },
  });
  return NextResponse.json(interactions);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { targetId, type, content, postUrl, result, sentiment, topic, notes } = body;

  if (!targetId || !type) {
    return NextResponse.json({ error: "targetId and type are required" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // DailyActivity を upsert してカウントを増やす
  const countField = {
    REPLY: "replyCount",
    DM: "dmCount",
    FOLLOW: "followCount",
    LIKE: "likeCount",
    QUOTE: "quoteCount",
    REPOST: null,
    MENTION: null,
    OTHER: null,
  }[type as string] as string | null;

  const [interaction] = await prisma.$transaction(async (tx) => {
    const created = await tx.interaction.create({
      data: {
        targetId,
        type,
        content: content || null,
        postUrl: postUrl || null,
        result: result || "NO_RESPONSE",
        sentiment: sentiment || null,
        topic: topic || null,
        notes: notes || null,
      },
      include: { target: true },
    });

    // Target の lastApproachedAt を更新
    // FOLLOWED（相手がフォローしてくれた）なら、運用対象から外すため PARTNER に移行
    await tx.target.update({
      where: { id: targetId },
      data: {
        lastApproachedAt: new Date(),
        ...(result === "FOLLOWED" ? { phase: "PARTNER", isFollowing: true } : {}),
      },
    });

    // DailyActivity カウントを更新
    if (countField) {
      await tx.dailyActivity.upsert({
        where: { date: today },
        create: { date: today, [countField]: 1 },
        update: { [countField]: { increment: 1 } },
      });
    }

    return [created];
  });

  return NextResponse.json(interaction, { status: 201 });
}
