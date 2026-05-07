"use client";

import { useState } from "react";
import Link from "next/link";

type UnmatchedUser = {
  username: string;
  tracked: boolean;
  targetId: string | null;
  displayName: string | null;
  phase: string | null;
  isBlacklisted: boolean;
};

type AuditResponse = {
  username: string;
  maxPages: number;
  followingCount: number;
  followerCount: number;
  unmatchedCount: number;
  trackedUnmatchedCount: number;
  unmatched: UnmatchedUser[];
};

const phaseLabel: Record<string, string> = {
  PROSPECT: "未接触",
  CONTACTED: "接触済み",
  ENGAGED: "反応あり",
  PARTNER: "関係構築済み",
};

export default function FollowAuditClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AuditResponse | null>(null);

  async function runAudit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/x/follow-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 10 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(json?.error ?? "棚卸しに失敗しました"));
        return;
      }
      setData(json as AuditResponse);
    } catch {
      setError("棚卸し中に通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-bold text-white mb-2">フォロー棚卸し</h2>
        <p className="text-x-gray text-sm mb-4">
          「自分はフォローしているが、相手は自分をフォローしていない」アカウントを一覧化します。
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={runAudit}
          disabled={loading}
        >
          {loading ? "棚卸し中..." : "Xから棚卸しを実行"}
        </button>
        <p className="text-x-gray text-xs mt-2">
          ※ APIコストを抑えるため、最大 1,000 件（100件 × 10ページ）まで取得します。
        </p>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      {data && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="card text-center">
              <p className="text-2xl font-bold text-white">{data.followingCount}</p>
              <p className="text-x-gray text-xs mt-1">自分がフォロー中</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-white">{data.followerCount}</p>
              <p className="text-x-gray text-xs mt-1">自分のフォロワー</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-yellow-400">{data.unmatchedCount}</p>
              <p className="text-x-gray text-xs mt-1">片思いフォロー</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-x-blue">{data.trackedUnmatchedCount}</p>
              <p className="text-x-gray text-xs mt-1">ターゲット登録済み</p>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-white">片思いフォロー一覧</h3>
              <span className="text-x-gray text-xs">@{data.username}</span>
            </div>

            {data.unmatched.length === 0 ? (
              <p className="text-green-400 text-sm">片思いフォローは見つかりませんでした。</p>
            ) : (
              <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {data.unmatched.map((item) => (
                  <li
                    key={item.username}
                    className="border border-x-border rounded-lg px-3 py-2 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`https://x.com/${item.username}`}
                          target="_blank"
                          className="text-x-blue hover:underline text-sm font-semibold"
                        >
                          @{item.username}
                        </Link>
                        {item.displayName && (
                          <span className="text-white text-sm truncate">{item.displayName}</span>
                        )}
                        {item.tracked && (
                          <span className="bg-gray-800 text-x-gray text-xs px-2 py-0.5 rounded-full">
                            登録済み
                          </span>
                        )}
                        {item.isBlacklisted && (
                          <span className="bg-red-900 text-red-300 text-xs px-2 py-0.5 rounded-full">
                            除外中
                          </span>
                        )}
                      </div>
                      {item.phase && (
                        <p className="text-x-gray text-xs mt-1">
                          フェーズ: {phaseLabel[item.phase] ?? item.phase}
                        </p>
                      )}
                    </div>

                    {item.targetId ? (
                      <Link
                        href={`/interactions?targetId=${item.targetId}`}
                        className="text-x-gray hover:text-x-blue text-xs shrink-0"
                      >
                        履歴を見る →
                      </Link>
                    ) : (
                      <span className="text-x-gray text-xs shrink-0">未登録</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
