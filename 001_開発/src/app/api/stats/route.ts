import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const DAILY_LIMITS = {
  postCount: 50,
  replyCount: 100,
  dmCount: 50,
  followCount: 400,
  likeCount: 1000,
  quoteCount: 50,
};

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);

  const [
    targetCount,
    interactionCount,
    highPriorityCount,
    phaseBreakdown,
    interactionsByType,
    resultBreakdown,
    todayActivity,
  ] = await Promise.all([
    prisma.target.count(),
    prisma.interaction.count(),
    prisma.target.count({ where: { priority: "HIGH" } }),
    prisma.target.groupBy({ by: ["phase"], _count: { phase: true } }),
    prisma.interaction.groupBy({ by: ["type"], _count: { type: true } }),
    prisma.interaction.groupBy({ by: ["result"], _count: { result: true } }),
    prisma.dailyActivity.findUnique({ where: { date: today } }),
  ]);

  const activity = todayActivity ?? {
    replyCount: 0,
    postCount: 0,
    dmCount: 0,
    followCount: 0,
    likeCount: 0,
    quoteCount: 0,
  };

  const warnings = Object.entries(DAILY_LIMITS)
    .filter(([key, limit]) => (activity as Record<string, number>)[key] >= limit * 0.8)
    .map(([key, limit]) => ({
      field: key,
      current: (activity as Record<string, number>)[key],
      limit,
    }));

  return NextResponse.json({
    targetCount,
    interactionCount,
    highPriorityCount,
    phaseBreakdown,
    interactionsByType,
    resultBreakdown,
    todayActivity: activity,
    dailyLimits: DAILY_LIMITS,
    warnings,
  });
}
