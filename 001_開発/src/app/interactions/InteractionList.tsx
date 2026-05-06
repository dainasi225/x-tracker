"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
type Interaction = {
  id: string;
  type: string;
  content: string | null;
  postUrl: string | null;
  result: string;
  sentiment: string | null;
  topic: string | null;
  notes: string | null;
  createdAt: Date;
  target: { id: string; username: string };
};

const typeLabels: Record<string, string> = {
  REPLY: "リプライ",
  LIKE: "いいね",
  REPOST: "リポスト",
  QUOTE: "引用",
  DM: "DM",
  FOLLOW: "フォロー",
  MENTION: "メンション",
  OTHER: "その他",
};

const typeEmoji: Record<string, string> = {
  REPLY: "💬",
  LIKE: "❤️",
  REPOST: "🔁",
  QUOTE: "📝",
  DM: "✉️",
  FOLLOW: "➕",
  MENTION: "📢",
  OTHER: "•",
};

const resultLabel: Record<string, string> = {
  NO_RESPONSE: "反応なし",
  LIKED: "❤️ いいねされた",
  REPLIED: "💬 返信された",
  FOLLOWED: "➕ フォローされた",
  UNFOLLOWED: "➖ フォロー外れた",
};

const resultStyle: Record<string, string> = {
  NO_RESPONSE: "text-x-gray",
  LIKED: "text-pink-400",
  REPLIED: "text-x-blue",
  FOLLOWED: "text-green-400",
  UNFOLLOWED: "text-red-400",
};

const sentimentEmoji: Record<string, string> = {
  POSITIVE: "😊",
  NEUTRAL: "😐",
  NEGATIVE: "😠",
};

export default function InteractionList({ interactions }: { interactions: Interaction[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("削除しますか？")) return;
    await fetch(`/api/interactions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (interactions.length === 0) {
    return (
      <div className="text-center py-12 text-x-gray">
        <p className="text-lg">インタラクションがありません</p>
        <p className="text-sm mt-1">上のボタンから記録してください</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {interactions.map((item) => (
        <li key={item.id} className="card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg">{typeEmoji[item.type]}</span>
                <Link
                  href={`/interactions?targetId=${item.target.id}`}
                  className="text-x-blue font-semibold hover:underline text-sm"
                >
                  @{item.target.username}
                </Link>
                <span className="text-x-gray text-xs">{typeLabels[item.type]}</span>
                {item.topic && (
                  <span className="bg-gray-800 text-x-gray text-xs px-2 py-0.5 rounded">
                    {item.topic}
                  </span>
                )}
                <span className="text-x-gray text-xs ml-auto">
                  {new Date(item.createdAt).toLocaleDateString("ja-JP", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {item.content && (
                <p className="text-white text-sm mt-1 whitespace-pre-wrap">{item.content}</p>
              )}

              <div className="flex gap-3 mt-2 items-center flex-wrap">
                <span className={`text-xs ${resultStyle[item.result]}`}>
                  {resultLabel[item.result]}
                </span>
                {item.sentiment && (
                  <span className="text-xs text-x-gray">
                    {sentimentEmoji[item.sentiment]}
                  </span>
                )}
                {item.postUrl && (
                  <a
                    href={item.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-x-blue text-xs hover:underline"
                  >
                    投稿を見る →
                  </a>
                )}
              </div>

              {item.notes && (
                <p className="text-x-gray text-xs mt-1">{item.notes}</p>
              )}
            </div>

            <button
              onClick={() => handleDelete(item.id)}
              className="text-x-gray hover:text-red-400 text-sm transition-colors shrink-0"
            >
              削除
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
