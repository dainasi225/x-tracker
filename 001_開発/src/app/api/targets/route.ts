import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const targets = await prisma.target.findMany({
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { interactions: true } } },
  });
  return NextResponse.json(targets);
}

export async function POST(request: Request) {
  const body = await request.json();
  const {
    username,
    displayName,
    bio,
    priority,
    phase,
    tags,
    notes,
    isFollowing,
    isFollowedByMe,
  } = body;

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  try {
    const target = await prisma.target.create({
      data: {
        username: username.replace("@", "").trim(),
        displayName: displayName || null,
        bio: bio || null,
        priority: priority || "MEDIUM",
        phase: phase || "PROSPECT",
        tags: tags || "",
        notes: notes || null,
        isFollowing: Boolean(isFollowing),
        isFollowedByMe: Boolean(isFollowedByMe),
      },
    });
    return NextResponse.json(target, { status: 201 });
  } catch {
    return NextResponse.json({ error: "username already exists" }, { status: 409 });
  }
}
