"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshActivityButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function refreshActivity() {
    setLoading(true);
    try {
      const res = await fetch("/api/daily-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 14 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`活動量ログ更新に失敗しました: ${data?.error ?? "不明なエラー"}`);
        return;
      }

      alert(
        `活動量ログを更新しました\n対象日数=${data?.rebuiltDays ?? "-"}\n更新日数=${data?.touchedDates ?? 0}\n走査件数=${data?.interactionScanned ?? 0}`
      );
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={refreshActivity}
      disabled={loading}
      title="インタラクション履歴から活動量ログを再集計"
    >
      {loading ? "更新中..." : "活動量ログを更新"}
    </button>
  );
}
