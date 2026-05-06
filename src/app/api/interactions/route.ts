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
  const {
    targetId,
    type,
    content,
    postUrl,
    isReplied,
    isLiked,
    isRetweeted,
    notes,
  } = body;

  if (!targetId || !type) {
    return NextResponse.json(
      { error: "targetId and type are required" },
      { status: 400 }
    );
  }

  const interaction = await prisma.interaction.create({
    data: {
      targetId,
      type,
      content: content || null,
      postUrl: postUrl || null,
      isReplied: Boolean(isReplied),
      isLiked: Boolean(isLiked),
      isRetweeted: Boolean(isRetweeted),
      notes: notes || null,
    },
    include: { target: true },
  });
  return NextResponse.json(interaction, { status: 201 });
}
