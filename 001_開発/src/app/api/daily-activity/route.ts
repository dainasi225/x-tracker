import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") ?? "7");

  const activities = await prisma.dailyActivity.findMany({
    orderBy: { date: "desc" },
    take: days,
  });
  return NextResponse.json(activities);
}

const trackedFieldByType: Record<string, keyof Omit<DailyCounts, "date"> | null> = {
  REPLY: "replyCount",
  DM: "dmCount",
  FOLLOW: "followCount",
  LIKE: "likeCount",
  QUOTE: "quoteCount",
  REPOST: null,
  MENTION: null,
  OTHER: null,
};

type DailyCounts = {
  date: string;
  replyCount: number;
  dmCount: number;
  followCount: number;
  likeCount: number;
  quoteCount: number;
};

function buildEmptyCounts(date: string): DailyCounts {
  return {
    date,
    replyCount: 0,
    dmCount: 0,
    followCount: 0,
    likeCount: 0,
    quoteCount: 0,
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const days = Math.max(1, Math.min(365, Number(body?.days ?? 14) || 14));

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const interactions = await prisma.interaction.findMany({
    where: { createdAt: { gte: since } },
    select: { type: true, createdAt: true },
  });

  const dateMap = new Map<string, DailyCounts>();
  for (const interaction of interactions) {
    const field = trackedFieldByType[interaction.type] ?? null;
    if (!field) continue;
    const date = new Date(interaction.createdAt).toISOString().slice(0, 10);
    const current = dateMap.get(date) ?? buildEmptyCounts(date);
    current[field] += 1;
    dateMap.set(date, current);
  }

  const rows = Array.from(dateMap.values());
  const startDate = since.toISOString().slice(0, 10);

  await prisma.$transaction(async (tx) => {
    await tx.dailyActivity.deleteMany({
      where: { date: { gte: startDate } },
    });
    if (rows.length > 0) {
      await tx.dailyActivity.createMany({ data: rows });
    }
  });

  return NextResponse.json({
    rebuiltDays: days,
    touchedDates: rows.length,
    interactionScanned: interactions.length,
  });
}
