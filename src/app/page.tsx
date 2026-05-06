import { prisma } from "@/lib/db";
import { InteractionType } from "@prisma/client";

async function getStats() {
  const [targetCount, interactionCount, highPriorityCount, recentInteractions] =
    await Promise.all([
      prisma.target.count(),
      prisma.interaction.count(),
      prisma.target.count({ where: { priority: "HIGH" } }),
      prisma.interaction.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { target: true },
      }),
    ]);

  const interactionsByType = await prisma.interaction.groupBy({
    by: ["type"],
    _count: { type: true },
  });

  return {
    targetCount,
    interactionCount,
    highPriorityCount,
    recentInteractions,
    interactionsByType,
  };
}

const typeLabels: Record<InteractionType, string> = {
  REPLY: "リプライ",
  LIKE: "いいね",
  RETWEET: "リポスト",
  QUOTE: "引用",
  DM: "DM",
  FOLLOW: "フォロー",
  MENTION: "メンション",
  OTHER: "その他",
};

const typeEmoji: Record<InteractionType, string> = {
  REPLY: "💬",
  LIKE: "❤️",
  RETWEET: "🔁",
  QUOTE: "📝",
  DM: "✉️",
  FOLLOW: "➕",
  MENTION: "📢",
  OTHER: "•",
};

export default async function Dashboard() {
  const stats = await getStats();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">ダッシュボード</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center">
          <p className="text-3xl font-bold text-white">{stats.targetCount}</p>
          <p className="text-x-gray text-sm mt-1">ターゲット数</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-x-blue">
            {stats.interactionCount}
          </p>
          <p className="text-x-gray text-sm mt-1">インタラクション数</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-400">
            {stats.highPriorityCount}
          </p>
          <p className="text-x-gray text-sm mt-1">高優先度</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Interaction breakdown */}
        <div className="card">
          <h2 className="font-bold text-white mb-3">種類別インタラクション</h2>
          {stats.interactionsByType.length === 0 ? (
            <p className="text-x-gray text-sm">データがありません</p>
          ) : (
            <ul className="space-y-2">
              {stats.interactionsByType.map((item) => (
                <li
                  key={item.type}
                  className="flex justify-between items-center"
                >
                  <span className="text-x-gray">
                    {typeEmoji[item.type]} {typeLabels[item.type]}
                  </span>
                  <span className="text-white font-semibold">
                    {item._count.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent interactions */}
        <div className="card">
          <h2 className="font-bold text-white mb-3">最近のインタラクション</h2>
          {stats.recentInteractions.length === 0 ? (
            <p className="text-x-gray text-sm">データがありません</p>
          ) : (
            <ul className="space-y-3">
              {stats.recentInteractions.map((interaction) => (
                <li key={interaction.id} className="border-b border-x-border pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span>{typeEmoji[interaction.type]}</span>
                    <span className="text-x-blue text-sm">
                      @{interaction.target.username}
                    </span>
                    <span className="text-x-gray text-xs ml-auto">
                      {typeLabels[interaction.type]}
                    </span>
                  </div>
                  {interaction.content && (
                    <p className="text-x-gray text-xs mt-1 truncate">
                      {interaction.content}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
