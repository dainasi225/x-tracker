"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SyncRecentInteractionsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function syncRecentInteractions() {
    setLoading(true);
    try {
      const res = await fetch("/api/x/sync-interactions-recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 40 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`一括同期に失敗しました: ${data?.error ?? "不明なエラー"}`);
        return;
      }

      alert(
        `一括同期完了\nimported=${data?.imported ?? 0}\nskipped=${data?.skipped ?? 0}\nmyTweets=${data?.fetched?.myTweets ?? 0}\nmentions=${data?.fetched?.mentions ?? 0}`
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={syncRecentInteractions}
      disabled={loading}
      className="btn-secondary mb-6"
      title="最近のやりとりを一括同期して自動生成"
    >
      {loading ? "同期中..." : "最近のやりとりを一括同期"}
    </button>
  );
}
