"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
type Target = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  priority: string;
  phase: string;
  tags: string;
  isFollowing: boolean;
  isBlacklisted?: boolean;
  blacklistReason?: string | null;
  notes: string | null;
  lastApproachedAt: Date | null;
  nextApproachAt: Date | null;
  createdAt: Date;
  _count: { interactions: number };
};

const priorityBadge: Record<string, string> = {
  HIGH: "badge-high",
  MEDIUM: "badge-medium",
  LOW: "badge-low",
};

const priorityLabel: Record<string, string> = {
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};

const phaseLabel: Record<string, string> = {
  PROSPECT: "未接触",
  CONTACTED: "接触済み",
  ENGAGED: "反応あり",
  PARTNER: "関係構築済み",
};

const phaseStyle: Record<string, string> = {
  PROSPECT: "bg-gray-800 text-gray-400",
  CONTACTED: "bg-yellow-900 text-yellow-300",
  ENGAGED: "bg-green-900 text-green-300",
  PARTNER: "bg-blue-900 text-blue-300",
};

const tagLabelJa: Record<string, string> = {
  AUTO_DISCOVERED: "自動追加",
  AUTO_SYNCED: "自動同期",
  SMALL_ACCOUNT: "小規模",
  MID_ACCOUNT: "中規模",
  LARGE_ACCOUNT: "大規模",
  FF_FRIENDLY: "相互向き",
  FF_HIGH: "FF高",
  SIZE_MATCH: "規模一致",
  SIZE_GAP_LARGE: "規模差大",
  FF_STYLE_MATCH: "運用近似",
  CLUSTER_MISMATCH_CHECK: "クラスタ違い要チェック",
  ALGO_NOISE_CHECK: "アルゴ汚染リスク要チェック",
};

function toTagLabel(tag: string): string {
  const key = tag.trim();
  if (!key) return "";
  if (key === "AUTO_DISCOVERED") return "";
  return tagLabelJa[key] ?? key;
}

function formatDate(date: Date | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
}

function isDue(date: Date | null) {
  if (!date) return false;
  return new Date(date) <= new Date();
}

export default function TargetList({ targets }: { targets: Target[] }) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function handleDelete(id: string, username: string) {
    if (!confirm(`@${username} を削除しますか？`)) return;
    await fetch(`/api/targets/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleSyncUser(username: string) {
    setBusyKey(`sync:${username}`);
    try {
      const res = await fetch(`/api/x/user/${username}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`X同期に失敗しました: ${data?.error ?? "不明なエラー"}`);
        return;
      }
      alert(`X同期が完了しました（followers: ${data?.followerCount ?? "-"}）`);
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleImportHistory(username: string) {
    setBusyKey(`history:${username}`);
    try {
      const res = await fetch(`/api/x/history/${username}?limit=50`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`履歴取り込みに失敗しました: ${data?.error ?? "不明なエラー"}`);
        return;
      }
      alert(
        `履歴取り込み完了: imported=${data?.imported ?? 0}, skipped=${data?.skipped ?? 0}, fetched=${data?.totalFetched ?? 0}`
      );
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleBlacklist(id: string, username: string) {
    const reason = prompt(`@${username} をブラックリストに追加する理由（任意）`) ?? "";
    if (!confirm(`@${username} をターゲットから除外しますか？`)) return;
    setBusyKey(`blacklist:${id}`);
    try {
      await fetch(`/api/targets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isBlacklisted: true,
          blacklistReason: reason.trim() || null,
          phase: "PARTNER",
        }),
      });
      router.refresh();
    } finally {
      setBusyKey(null);
    }
  }

  if (targets.length === 0) {
    return (
      <div className="text-center py-12 text-x-gray">
        <p className="text-lg">ターゲットがいません</p>
        <p className="text-sm mt-1">上のボタンから追加してください</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {targets.map((target) => (
        <li
          key={target.id}
          className={`card hover:border-x-blue transition-colors ${
            isDue(target.nextApproachAt) ? "border-yellow-500" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`https://x.com/${target.username}`}
                  target="_blank"
                  className="text-x-blue font-semibold hover:underline"
                >
                  @{target.username}
                </Link>
                {target.displayName && (
                  <span className="text-white text-sm">{target.displayName}</span>
                )}
                <span className={priorityBadge[target.priority]}>
                  {priorityLabel[target.priority]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${phaseStyle[target.phase]}`}>
                  {phaseLabel[target.phase]}
                </span>
                {target.isFollowing && (
                  <span className="bg-green-900 text-green-300 text-xs px-2 py-0.5 rounded-full">
                    フォロー中
                  </span>
                )}
              </div>

              {target.bio && (
                <p className="text-x-gray text-sm mt-1 truncate">{target.bio}</p>
              )}

              <div className="flex gap-4 mt-2 text-xs text-x-gray">
                {target.lastApproachedAt && (
                  <span>最終: {formatDate(target.lastApproachedAt)}</span>
                )}
                {target.nextApproachAt && (
                  <span className={isDue(target.nextApproachAt) ? "text-yellow-400 font-semibold" : ""}>
                    次回: {formatDate(target.nextApproachAt)}
                    {isDue(target.nextApproachAt) ? " ⚡" : ""}
                  </span>
                )}
              </div>

              {target.tags && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {target.tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => ({ raw: tag, label: toTagLabel(tag) }))
                    .filter((x) => Boolean(x.label))
                    .map((x) => (
                      <span key={x.raw} className="bg-gray-800 text-x-gray text-xs px-2 py-0.5 rounded">
                        {x.label}
                      </span>
                    ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-x-gray text-sm">💬 {target._count.interactions}</span>
              <button
                onClick={() => handleSyncUser(target.username)}
                disabled={busyKey != null}
                className="text-x-gray hover:text-x-blue text-sm transition-colors disabled:opacity-50"
              >
                {busyKey === `sync:${target.username}` ? "同期中..." : "X同期"}
              </button>
              <button
                onClick={() => handleImportHistory(target.username)}
                disabled={busyKey != null}
                className="text-x-gray hover:text-x-blue text-sm transition-colors disabled:opacity-50"
              >
                {busyKey === `history:${target.username}` ? "取込中..." : "履歴取込"}
              </button>
              <Link
                href={`/interactions?targetId=${target.id}`}
                className="text-x-gray hover:text-x-blue text-sm transition-colors"
              >
                履歴
              </Link>
              <button
                onClick={() => handleDelete(target.id, target.username)}
                className="text-x-gray hover:text-red-400 text-sm transition-colors"
              >
                削除
              </button>
              <button
                onClick={() => handleBlacklist(target.id, target.username)}
                disabled={busyKey != null}
                className="text-x-gray hover:text-red-400 text-sm transition-colors disabled:opacity-50"
              >
                {busyKey === `blacklist:${target.id}` ? "除外中..." : "除外"}
              </button>
            </div>
          </div>

          {target.notes && (
            <p className="text-x-gray text-xs mt-2 border-t border-x-border pt-2">
              {target.notes}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
