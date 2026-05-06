import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const DEFAULT_ID = "default";

export async function GET() {
  const persona = await prisma.userPersona.findUnique({
    where: { id: DEFAULT_ID },
  });

  if (!persona) {
    return NextResponse.json({
      id: DEFAULT_ID,
      xUsername: "",
      xApiCachedAt: null,
      followerCount: 0,
      nicheKeywords: "",
      avgEngagementRate: 0,
      ffRatio: 1,
    });
  }

  return NextResponse.json(persona);
}

export async function POST(request: Request) {
  const body = await request.json();
  const followerCount = Math.max(0, Number(body?.followerCount ?? 0));
  const avgEngagementRate = Math.max(0, Number(body?.avgEngagementRate ?? 0));
  const ffRatio = Math.max(0, Number(body?.ffRatio ?? 1));
  const xUsername = String(body?.xUsername ?? "")
    .replace("@", "")
    .trim();
  const nicheKeywords = String(body?.nicheKeywords ?? "").trim();

  const persona = await prisma.userPersona.upsert({
    where: { id: DEFAULT_ID },
    update: {
      followerCount,
      xUsername: xUsername || null,
      nicheKeywords,
      avgEngagementRate,
      ffRatio,
    },
    create: {
      id: DEFAULT_ID,
      followerCount,
      xUsername: xUsername || null,
      nicheKeywords,
      avgEngagementRate,
      ffRatio,
    },
  });

  return NextResponse.json(persona);
}
