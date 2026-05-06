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
