"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Candidate = {
  id: string;
  username: string;
  displayName: string | null;
  phase: string;
  followerCount: number | null;
  lastApproachedAtMs: number | null;
  lastApproachedAtLabel: string;
  nextApproachAtLabel: string;
  interactionsCount: number;
  recentTypes: string;
};

const phaseLabel: Record<string, string> = {
  PROSPECT: "アプローチ候補",
  CONTACTED: "接触済み",
  ENGAGED: "反応あり",
  PARTNER: "関係構築済み",
};

type SortMode = "lastApproachOldest" | "followersDesc";

export default function MaintenanceCandidatesList({
  candidates,
}: {
  candidates: Candidate[];
}) {
  const [sortMode, setSortMode] = useState<SortMode>("lastApproachOldest");

  const sorted = useMemo(() => {
    return [...candidates].sort((a, b) => {
      if (sortMode === "followersDesc") {
        const af = a.followerCount ?? 0;
        const bf = b.followerCount ?? 0;
        if (af !== bf) return bf - af;
      }

      const at =
        a.lastApproachedAtMs == null
          ? Number.NEGATIVE_INFINITY
          : a.lastApproachedAtMs;
      const bt =
        b.lastApproachedAtMs == null
          ? Number.NEGATIVE_INFINITY
          : b.lastApproachedAtMs;
      if (at !== bt) return at - bt;

      const af = a.followerCount ?? 0;
      const bf = b.followerCount ?? 0;
      return bf - af;
    });
  }, [candidates, sortMode]);

  const handleCopyUserId = async (username: string) => {
    try {
      await navigator.clipboard.writeText(`@${username}`);
    } catch {
      // noop
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-white">メンテナンス候補</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="candidate-sort" className="text-x-gray text-xs">
            並び順
          </label>
          <select
            id="candidate-sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="bg-gray-900 border border-x-border rounded px-2 py-1 text-xs text-white"
          >
            <option value="lastApproachOldest">最終接触が古い順</option>
            <option value="followersDesc">フォロワーが多い順</option>
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-x-gray text-sm">
          該当するターゲットがありません。「こちらがフォロー中」を手入力するか、上の同期・またはフォロー棚卸し・最近のやりとり自動更新を実行してください。
        </p>
      ) : (
        <ul className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
          {sorted.map((t) => (
            <li
              key={t.id}
              className="border border-x-border rounded-lg px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`https://x.com/${t.username}`}
                    target="_blank"
                    className="text-x-blue hover:underline font-semibold text-sm"
                  >
                    @{t.username}
                  </Link>
                  {t.displayName && (
                    <span className="text-white text-sm truncate">
                      {t.displayName}
                    </span>
                  )}
                  <span className="text-x-gray text-xs px-2 py-0.5 rounded-full bg-gray-800">
                    {phaseLabel[t.phase] ?? t.phase}
                  </span>
                </div>
                <div className="text-x-gray text-xs mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span>
                    フォロワー:{" "}
                    {t.followerCount != null ? (
                      <span className="text-white">
                        {t.followerCount.toLocaleString()}
                      </span>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span>最終接触: {t.lastApproachedAtLabel}</span>
                  <span>次回案内: {t.nextApproachAtLabel}</span>
                  <span>履歴件数: {t.interactionsCount}</span>
                </div>
                {t.recentTypes && (
                  <p className="text-x-gray text-xs mt-1">
                    直近の種類: <span className="text-white">{t.recentTypes}</span>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => void handleCopyUserId(t.username)}
                  className="text-x-gray hover:text-x-blue text-xs px-2 py-1 border border-x-border rounded"
                >
                  IDコピー
                </button>
                <Link
                  href={`/interactions?targetId=${t.id}`}
                  className="text-x-gray hover:text-x-blue text-xs px-2 py-1 border border-x-border rounded"
                >
                  インタラクション記録
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
