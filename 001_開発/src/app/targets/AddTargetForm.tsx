"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddTargetForm() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    bio: "",
    priority: "MEDIUM",
    phase: "PROSPECT",
    tags: "",
    notes: "",
    isFollowing: false,
    isFollowedByMe: false,
    nextApproachAt: "",
  });
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          nextApproachAt: form.nextApproachAt ? new Date(form.nextApproachAt).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setForm({
        username: "",
        displayName: "",
        bio: "",
        priority: "MEDIUM",
        phase: "PROSPECT",
        tags: "",
        notes: "",
        isFollowing: false,
        isFollowedByMe: false,
        nextApproachAt: "",
      });
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
        ＋ ターゲットを追加
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-6 space-y-3">
      <h2 className="font-bold text-white">新規ターゲット</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-x-gray text-xs mb-1 block">ユーザー名 *</label>
          <input
            className="input"
            placeholder="@username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value.replace("@", "") })}
            required
          />
        </div>
        <div>
          <label className="text-x-gray text-xs mb-1 block">表示名</label>
          <input
            className="input"
            placeholder="表示名"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="text-x-gray text-xs mb-1 block">Bio</label>
        <input
          className="input"
          placeholder="プロフィール概要"
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-x-gray text-xs mb-1 block">優先度</label>
          <select
            className="input"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option value="HIGH">高</option>
            <option value="MEDIUM">中</option>
            <option value="LOW">低</option>
          </select>
        </div>
        <div>
          <label className="text-x-gray text-xs mb-1 block">フェーズ</label>
          <select
            className="input"
            value={form.phase}
            onChange={(e) => setForm({ ...form, phase: e.target.value })}
          >
            <option value="PROSPECT">アプローチ候補</option>
            <option value="CONTACTED">接触済み</option>
            <option value="ENGAGED">反応あり</option>
            <option value="PARTNER">関係構築済み</option>
          </select>
        </div>
        <div>
          <label className="text-x-gray text-xs mb-1 block">次回アプローチ日</label>
          <input
            type="date"
            className="input"
            value={form.nextApproachAt}
            onChange={(e) => setForm({ ...form, nextApproachAt: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="text-x-gray text-xs mb-1 block">タグ</label>
        <input
          className="input"
          placeholder="タグ1, タグ2"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
        />
      </div>

      <div className="flex items-center gap-4">
        <label htmlFor="isFollowedByMe" className="flex items-center gap-2 text-x-gray text-sm">
          <input
            type="checkbox"
            id="isFollowedByMe"
            checked={form.isFollowedByMe}
            onChange={(e) => setForm({ ...form, isFollowedByMe: e.target.checked })}
            className="w-4 h-4"
          />
          こちらがフォロー中
        </label>
        <label htmlFor="isFollowing" className="flex items-center gap-2 text-x-gray text-sm">
          <input
            type="checkbox"
            id="isFollowing"
            checked={form.isFollowing}
            onChange={(e) => setForm({ ...form, isFollowing: e.target.checked })}
            className="w-4 h-4"
          />
          相手がフォロー中
        </label>
      </div>

      <div>
        <label className="text-x-gray text-xs mb-1 block">メモ</label>
        <textarea
          className="input resize-none"
          rows={2}
          placeholder="メモ"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "追加中..." : "追加"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
          キャンセル
        </button>
      </div>
    </form>
  );
}
