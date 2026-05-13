"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AutoDiscoverButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function runAutoDiscover() {
    setLoading(true);
    try {
      const res = await fetch("/api/x/discover-recent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 40 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`自動更新に失敗しました: ${data?.error ?? "不明なエラー"}`);
        return;
      }

      alert(
        `自動更新完了\nscanned=${data?.scanned ?? 0}\ncreated=${data?.created ?? 0}\nupdated=${data?.updated ?? 0}\nfollowersExcluded=${data?.followersExcluded ?? 0}\nfollowedByMeMarked=${data?.followedByMeMarked ?? 0}\nskipped=${data?.skippedExisting ?? 0}`
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={runAutoDiscover}
      disabled={loading}
      className="btn-secondary mb-6"
      type="button"
      title="最近のやりとり相手を自動更新（新規追加 + 既存更新 + フォロワー除外）"
    >
      {loading ? "自動更新中..." : "最近のやりとり相手を自動更新"}
    </button>
  );
}
