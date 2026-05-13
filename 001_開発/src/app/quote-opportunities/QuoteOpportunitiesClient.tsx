"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Opportunity = {
  tweetId: string;
  tweetUrl: string | null;
  conversationId: string;
  text: string;
  createdAt: string;
  authorPosition?: number;
  author: {
    username: string;
    name: string | null;
    bio: string | null;
    followerCount: number | null;
    followingCount: number | null;
  } | null;
  metrics: {
    likeCount: number;
    replyCount: number;
    repostCount: number;
    quoteCount: number;
  };
  score: {
    score: number;
    label: string;
    action: "QUOTE" | "REPLY" | "REPOST" | "WATCH";
    actionLabel: string;
    actionScores: {
      quote: number;
      reply: number;
      repost: number;
      targetAdd: number;
    };
    axes: {
      topic: number;
      conversation: number;
      influence: number;
      freshness: number;
      noise: number;
    };
    reasons: string[];
    personalBoost: number;
  };
};

type PersonalHistory = {
  successfulFollowerAvg: number | null;
  bestActionType: "REPLY" | "QUOTE" | "REPOST" | null;
  bestNicheTags: string[];
  positiveRate: number;
  totalSuccessfulInteractions: number;
};

type ApiResult = {
  query: string;
  keywords: string[];
  scanned: number;
  deduplicated: number;
  savedCount: number;
  saveError: string | null;
  personalHistory: PersonalHistory;
  opportunities: Opportunity[];
};

const KEYWORDS_STORAGE_KEY = "x-tracker.quote-opportunities.keywords";
const RECENT_KEYWORDS_STORAGE_KEY = "x-tracker.quote-opportunities.recent-keywords";
const MAX_RECENT_KEYWORDS = 100;

function normalizeKeywordInput(value: string): string {
  return value
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .join(", ");
}

function readRecentKeywords(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEYWORDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function saveRecentKeyword(value: string): string[] {
  const normalized = normalizeKeywordInput(value);
  if (!normalized) return readRecentKeywords();

  const next = [normalized, ...readRecentKeywords().filter((item) => item !== normalized)].slice(0, MAX_RECENT_KEYWORDS);
  localStorage.setItem(RECENT_KEYWORDS_STORAGE_KEY, JSON.stringify(next));
  localStorage.setItem(KEYWORDS_STORAGE_KEY, normalized);
  return next;
}

function deleteRecentKeyword(value: string): string[] {
  const next = readRecentKeywords().filter((item) => item !== value);
  localStorage.setItem(RECENT_KEYWORDS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function formatCount(value: number | null): string {
  if (value == null) return "-";
  return value.toLocaleString("ja-JP");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreStyle(score: number): string {
  if (score >= 80) return "bg-green-900 text-green-300";
  if (score >= 65) return "bg-teal-900 text-teal-300";
  if (score >= 45) return "bg-yellow-900 text-yellow-300";
  return "bg-gray-800 text-gray-400";
}

function actionTagStyle(action: Opportunity["score"]["action"]): string {
  switch (action) {
    case "QUOTE":
      return "bg-purple-900 text-purple-200";
    case "REPLY":
      return "bg-blue-900 text-blue-200";
    case "REPOST":
      return "bg-amber-900 text-amber-200";
    case "WATCH":
      return "bg-gray-800 text-gray-400";
  }
}

function actionTypeLabel(type: PersonalHistory["bestActionType"]): string {
  if (type === "REPLY") return "リプライ";
  if (type === "QUOTE") return "引用";
  if (type === "REPOST") return "リポスト";
  return "未学習";
}

function ActionBar({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={highlight ? "text-white font-semibold" : "text-x-gray"}>{label}</span>
        <span className={highlight ? "text-white font-semibold" : "text-x-gray"}>{value}</span>
      </div>
      <div className="w-full bg-x-border rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full ${highlight ? "bg-x-blue" : "bg-gray-600"}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

export default function QuoteOpportunitiesClient({ defaultKeywords }: { defaultKeywords: string }) {
  const [query, setQuery] = useState("");
  const [keywords, setKeywords] = useState(defaultKeywords);
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);
  const [limit, setLimit] = useState("15");
  const [loading, setLoading] = useState(false);
  const [busyUsername, setBusyUsername] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);

  useEffect(() => {
    const savedKeywords = localStorage.getItem(KEYWORDS_STORAGE_KEY);
    if (savedKeywords) {
      setKeywords(savedKeywords);
    } else if (defaultKeywords) {
      setKeywords(defaultKeywords);
    }
    setRecentKeywords(readRecentKeywords());
  }, [defaultKeywords]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const normalizedKeywords = normalizeKeywordInput(keywords);
    if (normalizedKeywords) {
      setKeywords(normalizedKeywords);
      setRecentKeywords(saveRecentKeyword(normalizedKeywords));
    }
    setLoading(true);
    try {
      const res = await fetch("/api/x/quote-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, keywords: normalizedKeywords, limit: Number(limit) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`引用チャンス検索に失敗しました: ${data?.error ?? "不明なエラー"}`);
        return;
      }
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTarget(opportunity: Opportunity) {
    if (!opportunity.author) return;
    const username = opportunity.author.username;
    setBusyUsername(username);
    try {
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          displayName: opportunity.author.name,
          bio: opportunity.author.bio,
          priority: opportunity.score.actionScores.targetAdd >= 65 ? "HIGH" : "MEDIUM",
          phase: "PROSPECT",
          tags: "QUOTE_OPPORTUNITY",
          notes: `引用チャンス ${opportunity.score.score}点 / ${opportunity.score.actionLabel}: ${opportunity.score.reasons.join(" / ")}`,
        }),
      });
      if (res.status === 409) {
        alert(`@${username} はすでにターゲット登録済みです`);
        return;
      }
      if (!res.ok) {
        alert("ターゲット追加に失敗しました");
        return;
      }
      alert(`@${username} をターゲットに追加しました`);
    } finally {
      setBusyUsername(null);
    }
  }

  async function handleCopyUserUrl(opportunity: Opportunity) {
    if (!opportunity.author) return;
    const url = `https://x.com/${opportunity.author.username}`;
    try {
      await navigator.clipboard.writeText(url);
      alert(`@${opportunity.author.username} のURLをコピーしました`);
    } catch {
      prompt("このURLをコピーしてください", url);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="card space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3">
            <label className="text-teal-300 text-xs mb-1 block font-semibold">ニッチキーワード</label>
            <input
              className="input border-teal-900 bg-teal-950/20 focus:border-teal-400"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="AI, 開発, SaaS"
            />
            {recentKeywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-x-gray text-xs py-1">
                  最近使ったキーワード（最大{MAX_RECENT_KEYWORDS}件）:
                </span>
                {recentKeywords.map((item) => (
                  <span key={item} className="inline-flex items-center rounded-full bg-gray-800 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setKeywords(item)}
                      className="hover:bg-gray-700 text-x-gray hover:text-white text-xs pl-2 pr-1 py-1 transition-colors"
                      title={`${item} を入力欄に入れる`}
                    >
                      {item}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecentKeywords(deleteRecentKeyword(item))}
                      className="hover:bg-red-900 text-x-gray hover:text-red-200 text-xs px-2 py-1 transition-colors"
                      title={`${item} を履歴から削除`}
                      aria-label={`${item} を履歴から削除`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-x-gray text-xs mb-1 block">取得数</label>
            <select className="input" value={limit} onChange={(e) => setLimit(e.target.value)}>
              <option value="10">10</option>
              <option value="15">15</option>
              <option value="20">20</option>
              <option value="30">30</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-x-gray text-xs mb-1 block">検索クエリ（任意）</label>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例: AI min_replies:20 -is:retweet lang:ja"
          />
          <p className="text-x-gray text-xs mt-1">
            空欄ならニッチキーワードから自動で検索します。細かく絞りたい時だけ使ってください。
          </p>
        </div>

        <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
          {loading ? "検索中..." : "引用チャンスを探す"}
        </button>
      </form>

      {result && (
        <>
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-white text-sm">あなたの過去成果</h2>
              <span className="text-x-gray text-xs">直近90日 / 結果が出た接触のみ</span>
            </div>
            {result.personalHistory.totalSuccessfulInteractions === 0 ? (
              <p className="text-x-gray text-xs">
                まだ成果（返信あり/フォローされ）の記録が少ないため、補正は適用されていません。
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-x-gray">成功件数</p>
                  <p className="text-white font-semibold">
                    {result.personalHistory.totalSuccessfulInteractions} 件
                  </p>
                </div>
                <div>
                  <p className="text-x-gray">成果が出た平均フォロワー</p>
                  <p className="text-white font-semibold">
                    {formatCount(result.personalHistory.successfulFollowerAvg)}
                  </p>
                </div>
                <div>
                  <p className="text-x-gray">あなたの得意アクション</p>
                  <p className="text-white font-semibold">
                    {actionTypeLabel(result.personalHistory.bestActionType)}
                  </p>
                </div>
                <div>
                  <p className="text-x-gray">ポジティブ率</p>
                  <p className="text-white font-semibold">
                    {Math.round(result.personalHistory.positiveRate * 100)}%
                  </p>
                </div>
                {result.personalHistory.bestNicheTags.length > 0 && (
                  <div className="col-span-4">
                    <p className="text-x-gray">よく成果が出るタグ</p>
                    <p className="text-white font-semibold">
                      {result.personalHistory.bestNicheTags.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">候補一覧</h2>
                <p className="text-x-gray text-xs">
                  query: {result.query} / scanned: {result.scanned} / 会話重複除外:{" "}
                  {result.deduplicated} / 保存: {result.savedCount}
                </p>
                {result.saveError && (
                  <p className="text-yellow-400 text-xs mt-1">
                    候補表示は成功しましたが、保存に失敗しました。開発サーバー再起動で解消する場合があります。
                  </p>
                )}
              </div>
              <span className="text-x-gray text-sm">{result.opportunities.length} 件</span>
            </div>

            {result.opportunities.length === 0 ? (
              <div className="card text-x-gray text-sm">
                候補が見つかりませんでした。キーワードを広げるか、min_replies条件を下げてください。
              </div>
            ) : (
              <ul className="space-y-3">
                {result.opportunities.map((opportunity) => {
                  const recommendedAction = opportunity.score.action;
                  return (
                    <li key={opportunity.tweetId} className="card">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${scoreStyle(opportunity.score.score)}`}>
                              総合 {opportunity.score.score} / {opportunity.score.label}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${actionTagStyle(recommendedAction)}`}>
                              {opportunity.score.actionLabel}
                            </span>
                            {opportunity.score.personalBoost > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-200">
                                過去成果ブースト +{opportunity.score.personalBoost}
                              </span>
                            )}
                            {opportunity.authorPosition !== undefined && opportunity.authorPosition > 0 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                                同一著者 {opportunity.authorPosition + 1}件目
                              </span>
                            )}
                            {opportunity.author && (
                              <Link
                                href={`https://x.com/${opportunity.author.username}`}
                                target="_blank"
                                className="text-x-blue font-semibold hover:underline"
                              >
                                @{opportunity.author.username}
                              </Link>
                            )}
                            {opportunity.author?.name && (
                              <span className="text-white text-sm">{opportunity.author.name}</span>
                            )}
                            <span className="text-x-gray text-xs">
                              {formatDate(opportunity.createdAt)}
                            </span>
                          </div>

                          <p className="text-white text-sm mt-3 whitespace-pre-wrap line-clamp-4">
                            {opportunity.text}
                          </p>

                          <div className="flex gap-3 mt-3 text-xs text-x-gray flex-wrap">
                            <span>返信 {opportunity.metrics.replyCount}</span>
                            <span>引用 {opportunity.metrics.quoteCount}</span>
                            <span>リポスト {opportunity.metrics.repostCount}</span>
                            <span>いいね {opportunity.metrics.likeCount}</span>
                            <span>フォロワー {formatCount(opportunity.author?.followerCount ?? null)}</span>
                          </div>

                          <div className="grid grid-cols-5 gap-2 mt-3 text-xs">
                            <span className="text-x-gray">トピック {opportunity.score.axes.topic}</span>
                            <span className="text-x-gray">会話 {opportunity.score.axes.conversation}</span>
                            <span className="text-x-gray">規模 {opportunity.score.axes.influence}</span>
                            <span className="text-x-gray">鮮度 {opportunity.score.axes.freshness}</span>
                            <span className={`${opportunity.score.axes.noise >= 60 ? "text-red-400" : "text-x-gray"}`}>
                              ノイズ {opportunity.score.axes.noise}
                            </span>
                          </div>

                          <p className="text-yellow-400 text-xs mt-3">
                            理由: {opportunity.score.reasons.join(" / ")}
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-2">
                            <ActionBar
                              label="引用向き"
                              value={opportunity.score.actionScores.quote}
                              highlight={recommendedAction === "QUOTE"}
                            />
                            <ActionBar
                              label="リプライ向き"
                              value={opportunity.score.actionScores.reply}
                              highlight={recommendedAction === "REPLY"}
                            />
                            <ActionBar
                              label="リポスト向き"
                              value={opportunity.score.actionScores.repost}
                              highlight={recommendedAction === "REPOST"}
                            />
                            <ActionBar
                              label="ターゲット追加向き"
                              value={opportunity.score.actionScores.targetAdd}
                            />
                          </div>

                          <div className="flex flex-col gap-2">
                            {opportunity.tweetUrl && (
                              <Link href={opportunity.tweetUrl} target="_blank" className="btn-secondary text-center text-sm">
                                投稿を開く
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCopyUserUrl(opportunity)}
                              disabled={!opportunity.author}
                              className="btn-secondary text-sm disabled:opacity-50"
                            >
                              ユーザーURLコピー
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddTarget(opportunity)}
                              disabled={!opportunity.author || busyUsername != null}
                              className="btn-secondary text-sm disabled:opacity-50"
                            >
                              {busyUsername === opportunity.author?.username
                                ? "追加中..."
                                : "ターゲット追加"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
