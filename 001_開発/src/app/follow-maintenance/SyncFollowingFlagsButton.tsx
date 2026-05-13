"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SyncFollowingFlagsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/x/sync-following-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 10 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(json?.error ?? "同期に失敗しました"));
        return;
      }
      setMessage(
        `X上のフォロー ${json.followingCount ?? 0} 件のうち、ターゲット ${json.targetsMarkedFollowedByMe ?? 0} 件を「こちらがフォロー中」に一致させました（新規フラグ ${json.newlyMarked ?? 0} 件）。`
      );
      router.refresh();
    } catch {
      setError("同期中に通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-primary"
        onClick={sync}
        disabled={loading}
      >
        {loading ? "同期中..." : "Xからフォロー中フラグを同期"}
      </button>
      <p className="text-x-gray text-xs">
        ターゲット登録済みユーザー名と、X API で取得した「自分がフォロー中」の一覧を突き合わせます（最大 1,000 件・10 ページ）。自動フォローは行いません。
      </p>
      {message && <p className="text-green-400 text-sm">{message}</p>}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
