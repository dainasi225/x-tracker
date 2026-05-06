import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [targetCount, interactionCount, highPriorityCount, interactionsByType] =
    await Promise.all([
      prisma.target.count(),
      prisma.interaction.count(),
      prisma.target.count({ where: { priority: "HIGH" } }),
      prisma.interaction.groupBy({
        by: ["type"],
        _count: { type: true },
      }),
    ]);

  return NextResponse.json({
    targetCount,
    interactionCount,
    highPriorityCount,
    interactionsByType,
  });
}
