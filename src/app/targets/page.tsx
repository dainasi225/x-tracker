import { prisma } from "@/lib/db";
import TargetList from "./TargetList";
import AddTargetForm from "./AddTargetForm";

async function getTargets() {
  return prisma.target.findMany({
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { interactions: true } },
    },
  });
}

export default async function TargetsPage() {
  const targets = await getTargets();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">ターゲット管理</h1>
        <span className="text-x-gray text-sm">{targets.length} アカウント</span>
      </div>

      <AddTargetForm />

      <TargetList targets={targets} />
    </div>
  );
}
