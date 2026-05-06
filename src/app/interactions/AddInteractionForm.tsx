"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Target = { id: string; username: string; displayName: string | null };

const interactionTypes = [
  { value: "REPLY", label: "💬 リプライ" },
  { value: "LIKE", label: "❤️ いいね" },
  { value: "RETWEET", label: "🔁 リポスト" },
  { value: "QUOTE", label: "📝 引用" },
  { value: "DM", label: "✉️ DM" },
  { value: "FOLLOW", label: "➕ フォロー" },
  { value: "MENTION", label: "📢 メンション" },
  { value: "OTHER", label: "• その他" },
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
    isReplied: false,
    isLiked: false,
    isRetweeted: false,
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
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      setForm((f) => ({
        ...f,
        type: "REPLY",
        content: "",
        postUrl: "",
        isReplied: false,
        isLiked: false,
        isRetweeted: false,
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
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-x-gray text-xs mb-1 block">内容</label>
        <textarea
          className="input resize-none"
          rows={3}
          placeholder="投稿内容やメモ"
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

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-x-gray text-sm">
          <input
            type="checkbox"
            checked={form.isReplied}
            onChange={(e) => setForm({ ...form, isReplied: e.target.checked })}
            className="w-4 h-4"
          />
          返信済み
        </label>
        <label className="flex items-center gap-2 text-x-gray text-sm">
          <input
            type="checkbox"
            checked={form.isLiked}
            onChange={(e) => setForm({ ...form, isLiked: e.target.checked })}
            className="w-4 h-4"
          />
          いいね済み
        </label>
        <label className="flex items-center gap-2 text-x-gray text-sm">
          <input
            type="checkbox"
            checked={form.isRetweeted}
            onChange={(e) => setForm({ ...form, isRetweeted: e.target.checked })}
            className="w-4 h-4"
          />
          リポスト済み
        </label>
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
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
