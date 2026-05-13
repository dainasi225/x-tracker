"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExcludeSuggestionButton({
  targetId,
  username,
}: {
  targetId: string;
  username: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleExclude() {
    const reason = prompt(`@${username} を除外する理由（任意）`) ?? "";
    if (!confirm(`@${username} を提案リストから除外しますか？`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/targets/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isBlacklisted: true,
          blacklistReason: reason.trim() || null,
          phase: "PARTNER",
        }),
      });

      if (!res.ok) {
        alert("除外に失敗しました");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExclude}
      disabled={loading}
      className="text-x-gray hover:text-red-400 text-xs shrink-0 transition-colors disabled:opacity-50"
    >
      {loading ? "除外中..." : "除外"}
    </button>
  );
}
