import Link from "next/link";
import { prisma } from "@/lib/db";
import UserUrlCopyButton from "@/components/UserUrlCopyButton";
import ExcludeSuggestionButton from "./ExcludeSuggestionButton";
import {
  buildEngagementRecord,
  calculateDetailedScore,
  recommendedAction,
  scoreLabel,
} from "@/lib/score";

const typeLabels: Record<string, string> = {
  REPLY: "リプライ", LIKE: "いいね", REPOST: "リポスト", QUOTE: "引用",
  POST: "投稿", DM: "DM", FOLLOW: "フォロー", MENTION: "メンション", OTHER: "その他",
};

const typeEmoji: Record<string, string> = {
  REPLY: "💬", LIKE: "❤️", REPOST: "🔁", QUOTE: "📝",
  POST: "📝", DM: "✉️", FOLLOW: "➕", MENTION: "📢", OTHER: "•",
};

const phaseLabels: Record<string, string> = {
  PROSPECT: "アプローチ候補", CONTACTED: "接触済み", ENGAGED: "反応あり", PARTNER: "関係構築済み",
};

const phaseColors: Record<string, string> = {
  PROSPECT: "text-x-gray", CONTACTED: "text-yellow-400",
  ENGAGED: "text-green-400", PARTNER: "text-x-blue",
};

async function getQuoteCandidateCount() {
  const db = prisma as typeof prisma & {
    quoteCandidate?: { count: () => Promise<number> };
  };
  if (!db.quoteCandidate) return 0;
  try {
    return await db.quoteCandidate.count();
  } catch {
    return 0;
  }
}

async function getStats() {
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    targetCount, interactionCount, highPriorityCount,
    phaseBreakdown, interactionsByType, recentInteractions,
    targets, myPersona, quoteCandidateCount, recentTargetAddCount, recentInteractionResults,
  ] = await Promise.all([
    prisma.target.count({
      where: { phase: { not: "PARTNER" }, isFollowing: false, isBlacklisted: false },
    }),
    prisma.interaction.count(),
    prisma.target.count({
      where: {
        priority: "HIGH",
        phase: { not: "PARTNER" },
        isFollowing: false,
        isBlacklisted: false,
      },
    }),
    prisma.target.groupBy({ by: ["phase"], _count: { phase: true } }),
    prisma.interaction.groupBy({ by: ["type"], _count: { type: true } }),
    prisma.interaction.findMany({
      take: 5, orderBy: { createdAt: "desc" }, include: { target: true },
    }),
    prisma.target.findMany({
      where: {
        phase: { not: "PARTNER" },
        isFollowing: false,
        isBlacklisted: false,
      },
      include: {
        interactions: {
          where: { createdAt: { gte: since90d } },
          select: { result: true, sentiment: true, createdAt: true },
        },
      },
    }),
    prisma.userPersona.findUnique({ where: { id: "default" } }),
    getQuoteCandidateCount(),
    prisma.target.count({ where: { createdAt: { gte: since7d }, isBlacklisted: false } }),
    prisma.interaction.findMany({
      where: { createdAt: { gte: since90d } },
      select: { result: true },
    }),
  ]);

  // 今日のアプローチ済み判定
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const suggestions = targets
    .map((t) => {
      const eng = buildEngagementRecord(t, t.interactions);
      const { score, factors } = calculateDetailedScore(
        eng,
        myPersona
          ? {
              followerCount: myPersona.followerCount,
              nicheKeywords: myPersona.nicheKeywords
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
              avgEngagementRate: myPersona.avgEngagementRate,
              ffRatio: myPersona.ffRatio,
            }
          : undefined
      );
      return {
        id: t.id,
        username: t.username,
        displayName: t.displayName,
        phase: t.phase,
        score,
        topReason: factors.length > 0
          ? `${factors[0].name}（${factors[0].delta > 0 ? "+" : ""}${factors[0].delta}pt）`
          : "まだ接触が少ない：最初のアプローチを試みましょう",
        action: recommendedAction(t.phase),
        approachedToday: t.lastApproachedAt != null && new Date(t.lastApproachedAt) >= todayStart,
      };
    })
    .sort((a, b) => (a.approachedToday !== b.approachedToday ? (a.approachedToday ? 1 : -1) : b.score - a.score))
    .slice(0, 5);

  const positiveInteractionCount = recentInteractionResults.filter((ix) =>
    ["LIKED", "REPLIED", "FOLLOWED"].includes(ix.result)
  ).length;
  const reactionRate =
    recentInteractionResults.length > 0
      ? Math.round((positiveInteractionCount / recentInteractionResults.length) * 100)
      : 0;

  return {
    targetCount, interactionCount, highPriorityCount,
    phaseBreakdown, interactionsByType, recentInteractions,
    suggestions,
    quoteCandidateCount,
    recentTargetAddCount,
    reactionRate,
    reactionSampleCount: recentInteractionResults.length,
  };
}

export default async function Dashboard() {
  const stats = await getStats();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">ダッシュボード</h1>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-white">{stats.targetCount}</p>
          <p className="text-x-gray text-sm mt-1">ターゲット数</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-x-blue">{stats.interactionCount}</p>
          <p className="text-x-gray text-sm mt-1">インタラクション数</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-red-400">{stats.highPriorityCount}</p>
          <p className="text-x-gray text-sm mt-1">高優先度</p>
        </div>
      </div>

      {/* ★ 今日のアプローチ提案 TOP5 */}
      <div className="card mb-6 border-x-blue">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-white">今日のアプローチ提案 TOP5</h2>
          <span className="text-x-gray text-xs">スコアはフォローバック予測（0〜100）</span>
        </div>
        {stats.suggestions.length === 0 ? (
          <p className="text-x-gray text-sm">ターゲットを追加すると提案が表示されます</p>
        ) : (
          <ol className="space-y-3">
            {stats.suggestions.map((s, i) => {
              const sl = scoreLabel(s.score);
              return (
                <li
                  key={s.id}
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    s.approachedToday ? "opacity-50 bg-gray-900" : "bg-gray-900"
                  }`}
                >
                  <span className="text-x-gray font-bold text-lg w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`https://x.com/${s.username}`}
                        target="_blank"
                        className="text-x-blue font-semibold hover:underline text-sm"
                      >
                        @{s.username}
                      </Link>
                      {s.displayName && (
                        <span className="text-white text-sm">{s.displayName}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sl.bg} ${sl.color}`}>
                        {s.score}点 / {sl.sublabel}
                      </span>
                      {s.approachedToday && (
                        <span className="text-x-gray text-xs">✅ 今日アプローチ済み</span>
                      )}
                    </div>
                    <p className="text-yellow-400 text-xs mt-1">→ {s.action}</p>
                    <p className="text-x-gray text-xs mt-0.5">{s.topReason}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <UserUrlCopyButton username={s.username} />
                    <Link
                      href={`/interactions?targetId=${s.id}`}
                      className="text-x-gray hover:text-x-blue text-xs transition-colors"
                    >
                      記録 →
                    </Link>
                    <ExcludeSuggestionButton targetId={s.id} username={s.username} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* 戦略KPI */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-white">戦略KPI</h2>
          <span className="text-x-gray text-xs">行動量より、発見・追加・反応を重視</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-2xl font-bold text-x-blue">{stats.quoteCandidateCount}</p>
            <p className="text-x-gray text-sm mt-1">引用チャンス保存数</p>
            <p className="text-x-gray text-xs mt-2">検索で蓄積された候補の累計</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-2xl font-bold text-white">{stats.recentTargetAddCount}</p>
            <p className="text-x-gray text-sm mt-1">ターゲット追加数</p>
            <p className="text-x-gray text-xs mt-2">直近7日で追加したアカウント</p>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <p className="text-2xl font-bold text-green-400">{stats.reactionRate}%</p>
            <p className="text-x-gray text-sm mt-1">反応あり率</p>
            <p className="text-x-gray text-xs mt-2">
              直近90日 / {stats.reactionSampleCount}件中の有効反応
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* フェーズ別ターゲット */}
        <div className="card">
          <h2 className="font-bold text-white mb-3">フェーズ別ターゲット</h2>
          <ul className="space-y-2">
            {(["PROSPECT", "CONTACTED", "ENGAGED", "PARTNER"]).map((phase) => {
              const count = stats.phaseBreakdown.find((p) => p.phase === phase)?._count.phase ?? 0;
              return (
                <li key={phase} className="flex justify-between items-center">
                  <span className={`text-sm ${phaseColors[phase]}`}>{phaseLabels[phase]}</span>
                  <span className="text-white font-semibold">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 種類別インタラクション */}
        <div className="card">
          <h2 className="font-bold text-white mb-3">種類別インタラクション</h2>
          {stats.interactionsByType.length === 0 ? (
            <p className="text-x-gray text-sm">データがありません</p>
          ) : (
            <ul className="space-y-2">
              {stats.interactionsByType.map((item) => (
                <li key={item.type} className="flex justify-between items-center">
                  <span className="text-x-gray text-sm">{typeEmoji[item.type]} {typeLabels[item.type]}</span>
                  <span className="text-white font-semibold">{item._count.type}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 最近のインタラクション */}
        <div className="card">
          <h2 className="font-bold text-white mb-3">最近のインタラクション</h2>
          {stats.recentInteractions.length === 0 ? (
            <p className="text-x-gray text-sm">データがありません</p>
          ) : (
            <ul className="space-y-3">
              {stats.recentInteractions.map((ix) => (
                <li key={ix.id} className="border-b border-x-border pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span>{typeEmoji[ix.type]}</span>
                    <Link
                      href={`https://x.com/${ix.target.username}`}
                      target="_blank"
                      className="text-x-blue text-sm hover:underline"
                    >
                      @{ix.target.username}
                    </Link>
                    <UserUrlCopyButton
                      username={ix.target.username}
                      label="URL"
                      className="text-x-gray hover:text-x-blue text-xs transition-colors"
                    />
                    <span className="text-x-gray text-xs ml-auto">{typeLabels[ix.type]}</span>
                  </div>
                  {ix.content && <p className="text-x-gray text-xs mt-1 truncate">{ix.content}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
