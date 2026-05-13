import Link from "next/link";
import { prisma } from "@/lib/db";
import SyncFollowingFlagsButton from "./SyncFollowingFlagsButton";
import MaintenanceCandidatesList from "./MaintenanceCandidatesList";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default async function FollowMaintenancePage() {
  const targets = await prisma.target.findMany({
    where: {
      isFollowedByMe: true,
      isBlacklisted: false,
    },
    include: {
      _count: { select: { interactions: true } },
      interactions: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { type: true, createdAt: true, result: true },
      },
    },
  });

  const candidates = targets.map((t) => ({
    id: t.id,
    username: t.username,
    displayName: t.displayName,
    phase: t.phase,
    followerCount: t.xFollowerCount ?? t.followerCount ?? null,
    lastApproachedAtMs: t.lastApproachedAt?.getTime() ?? null,
    lastApproachedAtLabel: formatDate(t.lastApproachedAt),
    nextApproachAtLabel: formatDate(t.nextApproachAt),
    interactionsCount: t._count.interactions,
    recentTypes: t.interactions
      .map((i) => i.type)
      .filter(Boolean)
      .join(" / "),
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-white">フォローメンテナンス</h1>
        <span className="text-x-gray text-sm">{candidates.length} アカウント</span>
      </div>

      <div className="card space-y-4">
        <div>
          <h2 className="font-bold text-white mb-2">この画面の目的</h2>
          <p className="text-x-gray text-sm leading-relaxed">
            すでに<strong className="text-white">フォロー関係がある相手</strong>
            向けに、接触が空いていないかを並べて確認するビューです。実際のリプライ・引用は X
            上で手動で行ってください（本アプリは規約順守のため自動投稿しません）。
          </p>
          <p className="text-x-gray text-xs mt-2 leading-relaxed">
            リストはターゲット登録のうち「こちらがフォロー中」のみ。相互フォローでない相手も含みます。
          </p>
        </div>

        <div className="border-t border-x-border pt-4 space-y-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <span className="text-lg" aria-hidden>
              💡
            </span>
            Tips（アクションの優先度イメージ）
          </h3>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3 rounded-lg bg-gray-900/60 border border-x-border px-3 py-2.5">
              <span className="text-yellow-400 font-bold shrink-0">1</span>
              <div className="text-x-gray leading-relaxed">
                <strong className="text-white">引用（引用リポスト）</strong>
                がいちばん効きやすいことが多いです。相手のフォロワーにも届き、
                <strong className="text-white">自分にも相手にもプラス</strong>
                になりやすいアプローチです。
              </div>
            </li>
            <li className="flex gap-3 rounded-lg bg-gray-900/60 border border-x-border px-3 py-2.5">
              <span className="text-sky-400 font-bold shrink-0">2</span>
              <div className="text-x-gray leading-relaxed">
                <strong className="text-white">相手が返信しやすいリプライ</strong>
                （会話が続く一言）も、アルゴリズム上かなり有利になりやすいです。スレッドが伸びると、双方の露出にもつながります。
              </div>
            </li>
            <li className="flex gap-3 rounded-lg bg-gray-900/40 border border-x-border px-3 py-2.5">
              <span className="text-x-gray font-bold shrink-0">3</span>
              <div className="text-x-gray leading-relaxed">
                <strong className="text-white">いいね</strong>
                は<strong className="text-white">社交辞令</strong>
                に近く、ここでのランキングでは
                <strong className="text-white">いちばん低い位置</strong>
                です。気持ちのサインにはなる一方、伸ばしの主役にはしにくい、という整理です。
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div className="card space-y-4">
        <h2 className="font-bold text-white">フォロー中フラグの同期</h2>
        <p className="text-x-gray text-sm">
          直近のフォロー変更をターゲットに反映するには、X API から一覧を取り込みます。
        </p>
        <SyncFollowingFlagsButton />
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/quote-opportunities"
            className="text-x-blue hover:underline text-sm shrink-0"
          >
            引用チャンスへ →
          </Link>
        </div>
        <p className="text-x-gray text-xs">
          引用は「引用チャンス」でトピック検索し、著者がこのリストにいる場合は特に相性がよいことが多いです。
        </p>
        <MaintenanceCandidatesList candidates={candidates} />
      </div>
    </div>
  );
}
