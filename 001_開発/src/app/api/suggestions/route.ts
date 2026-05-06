import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  buildEngagementRecord,
  calculateDetailedScore,
  recommendedAction,
} from "@/lib/score";

const DEFAULT_TOP_N = 5;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const topN = parseInt(searchParams.get("n") ?? String(DEFAULT_TOP_N));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const targets = await prisma.target.findMany({
    where: {
      phase: { not: "PARTNER" },
      isFollowing: false,
      isBlacklisted: false,
    },
    include: {
      interactions: {
        where: { createdAt: { gte: since90d } },
        select: { result: true, sentiment: true, createdAt: true },
      },
    },
  });

  const myPersona = await prisma.userPersona.findUnique({
    where: { id: "default" },
  });

  const scored = targets
    .map((t) => {
      const eng = buildEngagementRecord(t, t.interactions);
      const { score, factors } = calculateDetailedScore(
        eng,
        myPersona
          ? {
              followerCount: myPersona.followerCount,
              nicheKeywords: myPersona.nicheKeywords
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
              avgEngagementRate: myPersona.avgEngagementRate,
              ffRatio: myPersona.ffRatio,
            }
          : undefined
      );

      return {
        id: t.id,
        username: t.username,
        displayName: t.displayName,
        phase: t.phase,
        priority: t.priority,
        followerCount: eng.followerCount,
        score,
        factors,
        action: recommendedAction(t.phase),
        approachedToday:
          t.lastApproachedAt != null &&
          new Date(t.lastApproachedAt) >= todayStart,
        lastApproachedAt: t.lastApproachedAt,
      };
    })
    .sort((a, b) => {
      if (a.approachedToday !== b.approachedToday)
        return a.approachedToday ? 1 : -1;
      return b.score - a.score;
    })
    .slice(0, topN);

  return NextResponse.json(scored);
}
