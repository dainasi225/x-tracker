import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { targetId, approach, result, nextAction } = body;

  if (!targetId || !approach) {
    return NextResponse.json({ error: "targetId and approach are required" }, { status: 400 });
  }

  const strategy = await prisma.strategy.create({
    data: {
      targetId,
      approach,
      result: result || null,
      nextAction: nextAction || null,
    },
  });
  return NextResponse.json(strategy, { status: 201 });
}
