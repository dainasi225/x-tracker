import { prisma } from "@/lib/db";
import InteractionList from "./InteractionList";
import AddInteractionForm from "./AddInteractionForm";

async function getData(targetId?: string) {
  const [targets, interactions] = await Promise.all([
    prisma.target.findMany({
      orderBy: [{ priority: "asc" }, { username: "asc" }],
    }),
    prisma.interaction.findMany({
      where: targetId ? { targetId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { target: true },
    }),
  ]);
  return { targets, interactions };
}

export default async function InteractionsPage({
  searchParams,
}: {
  searchParams: { targetId?: string };
}) {
  const { targets, interactions } = await getData(searchParams.targetId);
  const selectedTarget = searchParams.targetId
    ? targets.find((t) => t.id === searchParams.targetId)
    : null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">インタラクション</h1>
          {selectedTarget && (
            <p className="text-x-gray text-sm mt-1">
              @{selectedTarget.username} でフィルター中
            </p>
          )}
        </div>
        <span className="text-x-gray text-sm">{interactions.length} 件</span>
      </div>

      <AddInteractionForm targets={targets} defaultTargetId={searchParams.targetId} />

      <InteractionList interactions={interactions} />
    </div>
  );
}
