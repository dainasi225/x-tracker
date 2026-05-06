import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const interaction = await prisma.interaction.update({
    where: { id: params.id },
    data: body,
  });
  return NextResponse.json(interaction);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  await prisma.interaction.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
