import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const target = await prisma.target.findUnique({
    where: { id: params.id },
    include: {
      interactions: { orderBy: { createdAt: "desc" } },
      strategies: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!target) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(target);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const target = await prisma.target.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(target);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.target.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
