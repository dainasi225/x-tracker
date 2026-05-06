"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Priority } from "@prisma/client";

type Target = {
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  priority: Priority;
  tags: string;
  isFollowing: boolean;
  notes: string | null;
  createdAt: Date;
  _count: { interactions: number };
};

const priorityBadge: Record<Priority, string> = {
  HIGH: "badge-high",
  MEDIUM: "badge-medium",
  LOW: "badge-low",
};

const priorityLabel: Record<Priority, string> = {
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};

export default function TargetList({ targets }: { targets: Target[] }) {
  const router = useRouter();

  async function handleDelete(id: string, username: string) {
    if (!confirm(`@${username} を削除しますか？`)) return;
    await fetch(`/api/targets/${id}`, { method: "DELETE" });
    router.refresh();
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
        <li key={target.id} className="card hover:border-x-blue transition-colors">
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
                {target.isFollowing && (
                  <span className="bg-green-900 text-green-300 text-xs px-2 py-0.5 rounded-full">
                    フォロー中
                  </span>
                )}
              </div>

              {target.bio && (
                <p className="text-x-gray text-sm mt-1 truncate">{target.bio}</p>
              )}

              {target.tags && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {target.tags.split(",").filter(Boolean).map((tag) => (
                    <span
                      key={tag.trim()}
                      className="bg-gray-800 text-x-gray text-xs px-2 py-0.5 rounded"
                    >
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-x-gray text-sm">
                💬 {target._count.interactions}
              </span>
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
