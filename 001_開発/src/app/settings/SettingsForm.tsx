"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PersonaForm = {
  xUsername: string;
  xApiCachedAt: string | null;
  followerCount: number;
  nicheKeywords: string;
  avgEngagementRate: number;
  ffRatio: number;
};

export default function SettingsForm({ initial }: { initial: PersonaForm }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [form, setForm] = useState<PersonaForm>(initial);

  function normalizeDecimal(value: number, digits: number): number {
    if (!Number.isFinite(value) || value < 0) return 0;
    return Number(value.toFixed(digits));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/my-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        throw new Error("保存に失敗");
      }
      alert("保存しました");
      router.refresh();
    } catch {
      alert("保存時にエラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  async function syncFromX() {
    setSyncing(true);
    try {
      const res = await fetch("/api/x/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.xUsername }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detailText =
          data?.detail?.detail ??
          data?.detail?.title ??
          data?.detail?.type ??
          "";
        throw new Error(
          `${data?.error ?? "同期に失敗"}${detailText ? `\n${detailText}` : ""}`
        );
      }

      setForm((prev) => ({
        ...prev,
        xUsername: data?.username ?? prev.xUsername,
        followerCount: Number(data?.followerCount ?? prev.followerCount),
        ffRatio: Number(data?.ffRatio ?? prev.ffRatio),
        xApiCachedAt: data?.xApiCachedAt ?? null,
      }));
      alert("Xから自分情報を読み込みました");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "同期時にエラーが発生しました";
      alert(message);
    } finally {
      setSyncing(false);
    }
  }

  function buildStrategySummary() {
    const tips: string[] = [];
    if (form.followerCount <= 0) {
      tips.push("まず自分のフォロワー数を入れて、規模バランス判定を有効化しましょう。");
    } else if (form.followerCount < 3000) {
      tips.push("同規模〜3倍以内（小〜中規模）を優先し、返信中心の接触を増やすと効率的です。");
    } else if (form.followerCount < 10000) {
      tips.push("自分の1/3〜3倍帯を主軸に、会話成立（返信往復）を重視するとスコアが伸びます。");
    } else {
      tips.push("大規模アカウント偏重を避け、同ニッチで会話密度が高い層を重点化すると安定します。");
    }

    if (form.ffRatio < 1.2) {
      tips.push("相手FF比率が1.5未満の候補を優先すると、相互化しやすくなります。");
    } else {
      tips.push("FF運用スタイル差が大きい候補は、先に複数回接触して温度を上げるのがおすすめです。");
    }

    if (!form.nicheKeywords.trim()) {
      tips.push("ニッチキーワードを3〜6個登録すると、類似度による優先順位が安定します。");
    } else {
      tips.push("登録キーワードと相手プロフィールの一致度を使って、類似度0.7以上を優先しましょう。");
    }

    return tips;
  }

  const strategyTips = buildStrategySummary();

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h2 className="text-white font-bold">自分の情報（スコア計算用）</h2>
      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <label className="text-x-gray text-xs mb-1 block">自分のXユーザー名（API同期用）</label>
          <input
            className="input"
            placeholder="@your_username"
            value={form.xUsername}
            onChange={(e) => setForm({ ...form, xUsername: e.target.value.replace("@", "") })}
          />
        </div>
        <button
          type="button"
          onClick={syncFromX}
          disabled={syncing}
          className="btn-secondary"
        >
          {syncing ? "同期中..." : "Xから読み込む"}
        </button>
      </div>
      {form.xApiCachedAt && (
        <p className="text-x-gray text-xs">
          最終同期: {new Date(form.xApiCachedAt).toLocaleString("ja-JP")}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-x-gray text-xs mb-1 block">自分のフォロワー数</label>
          <input
            type="number"
            min={0}
            className="input"
            value={form.followerCount}
            onChange={(e) => setForm({ ...form, followerCount: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-x-gray text-xs mb-1 block">自分のFF比率（Follower / Following）</label>
          <input
            type="number"
            min={0}
            step="any"
            className="input"
            value={form.ffRatio}
            onChange={(e) => setForm({ ...form, ffRatio: Number(e.target.value) || 0 })}
            onBlur={() =>
              setForm((prev) => ({ ...prev, ffRatio: normalizeDecimal(prev.ffRatio, 4) }))
            }
          />
        </div>
      </div>

      <div>
        <label className="text-x-gray text-xs mb-1 block">平均エンゲージ率（%）</label>
        <input
          type="number"
          min={0}
          step="any"
          className="input"
          value={form.avgEngagementRate}
          onChange={(e) => setForm({ ...form, avgEngagementRate: Number(e.target.value) || 0 })}
          onBlur={() =>
            setForm((prev) => ({
              ...prev,
              avgEngagementRate: normalizeDecimal(prev.avgEngagementRate, 2),
            }))
          }
        />
      </div>

      <div>
        <label className="text-x-gray text-xs mb-1 block">ニッチキーワード（カンマ区切り）</label>
        <input
          className="input"
          placeholder="副業, AI, アプリ開発"
          value={form.nicheKeywords}
          onChange={(e) => setForm({ ...form, nicheKeywords: e.target.value })}
        />
        <p className="text-x-gray text-xs mt-1">
          例: 副業, AI, マーケティング（将来の類似度自動計算にも利用）
        </p>
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "保存中..." : "保存"}
      </button>

      <div className="border-t border-x-border pt-4">
        <h3 className="text-white text-sm font-semibold mb-2">推奨ターゲティング戦略</h3>
        <ul className="space-y-1 text-sm text-x-gray">
          {strategyTips.map((tip) => (
            <li key={tip}>- {tip}</li>
          ))}
        </ul>
      </div>
    </form>
  );
}
