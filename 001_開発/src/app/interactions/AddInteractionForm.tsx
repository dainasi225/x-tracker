"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Target = { id: string; username: string; displayName: string | null };

const interactionTypes = [
  { value: "REPLY", label: "💬 リプライ" },
  { value: "LIKE", label: "❤️ いいね" },
  { value: "REPOST", label: "🔁 リポスト" },
  { value: "QUOTE", label: "📝 引用" },
  { value: "DM", label: "✉️ DM" },
  { value: "FOLLOW", label: "➕ フォロー" },
  { value: "MENTION", label: "📢 メンション" },
  { value: "OTHER", label: "• その他" },
];

const results = [
  { value: "NO_RESPONSE", label: "反応なし" },
  { value: "LIKED", label: "❤️ いいねされた" },
  { value: "REPLIED", label: "💬 返信された" },
  { value: "FOLLOWED", label: "➕ フォローされた" },
  { value: "UNFOLLOWED", label: "➖ フォロー外れた" },
];

const sentiments = [
  { value: "", label: "未設定" },
  { value: "POSITIVE", label: "😊 ポジティブ" },
  { value: "NEUTRAL", label: "😐 ニュートラル" },
  { value: "NEGATIVE", label: "😠 ネガティブ" },
];

export default function AddInteractionForm({
  targets,
  defaultTargetId,
}: {
  targets: Target[];
  defaultTargetId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    targetId: defaultTargetId ?? "",
    type: "REPLY",
    content: "",
    postUrl: "",
    result: "NO_RESPONSE",
    sentiment: "",
    topic: "",
    notes: "",
  });
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.targetId) return alert("ターゲットを選択してください");
    setLoading(true);
    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sentiment: form.sentiment || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setForm((f) => ({
        ...f,
        type: "REPLY",
        content: "",
        postUrl: "",
        result: "NO_RESPONSE",
        sentiment: "",
        topic: "",
        notes: "",
      }));
      setOpen(false);
      router.refresh();
    } catch {
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary mb-6">
        ＋ インタラクションを記録
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-6 space-y-3">
      <h2 className="font-bold text-white">インタラクションを記録</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-x-gray text-xs mb-1 block">ターゲット *</label>
          <select
            className="input"
            value={form.targetId}
            onChange={(e) => setForm({ ...form, targetId: e.target.value })}
            required
          >
            <option value="">選択してください</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                @{t.username} {t.displayName ? `(${t.displayName})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-x-gray text-xs mb-1 block">種類 *</label>
          <select
            className="input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {interactionTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-x-gray text-xs mb-1 block">内容</label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="投稿内容やコメント"
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
        />
      </div>

      <div>
        <label className="text-x-gray text-xs mb-1 block">投稿URL</label>
        <input
          className="input"
          type="url"
          placeholder="https://x.com/..."
          value={form.postUrl}
          onChange={(e) => setForm({ ...form, postUrl: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-x-gray text-xs mb-1 block">結果</label>
          <select
            className="input"
            value={form.result}
            onChange={(e) => setForm({ ...form, result: e.target.value })}
          >
            {results.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-x-gray text-xs mb-1 block">反応の質</label>
          <select
            className="input"
            value={form.sentiment}
            onChange={(e) => setForm({ ...form, sentiment: e.target.value })}
          >
            {sentiments.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-x-gray text-xs mb-1 block">話題タグ</label>
          <input
            className="input"
            placeholder="AI, マーケ, etc."
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="text-x-gray text-xs mb-1 block">メモ</label>
        <input
          className="input"
          placeholder="追加メモ"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "記録中..." : "記録"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          キャンセル
        </button>
      </div>
    </form>
  );
}
