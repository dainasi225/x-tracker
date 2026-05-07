import { prisma } from "@/lib/db";
import RefreshActivityButton from "./RefreshActivityButton";

const DAILY_LIMITS = {
  replyCount: 100,
  dmCount: 50,
  followCount: 400,
  likeCount: 1000,
  quoteCount: 50,
};

const fieldLabels: Record<string, string> = {
  replyCount: "💬 リプライ",
  dmCount: "✉️ DM",
  followCount: "➕ フォロー",
  likeCount: "❤️ いいね",
  quoteCount: "📝 引用",
};

async function getActivity() {
  return prisma.dailyActivity.findMany({
    orderBy: { date: "desc" },
    take: 14,
  });
}

export default async function ActivityPage() {
  const activities = await getActivity();
  const today = new Date().toISOString().slice(0, 10);
  const todayRaw = activities.find((a) => a.date === today);
  const todayData: Record<string, number> = {
    replyCount: todayRaw?.replyCount ?? 0,
    dmCount: todayRaw?.dmCount ?? 0,
    followCount: todayRaw?.followCount ?? 0,
    likeCount: todayRaw?.likeCount ?? 0,
    quoteCount: todayRaw?.quoteCount ?? 0,
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">行動量ログ</h1>
          <p className="text-x-gray text-sm">
            X規約の上限を意識して行動量を管理します
          </p>
        </div>
        <RefreshActivityButton />
      </div>

      {/* 今日の上限ゲージ */}
      <div className="card mb-6">
        <h2 className="font-bold text-white mb-4">今日の上限ゲージ</h2>
        <div className="space-y-4">
          {Object.entries(DAILY_LIMITS).map(([key, limit]) => {
            const current = todayData[key] ?? 0;
            const ratio = current / limit;
            const barColor =
              ratio >= 1 ? "bg-red-500" : ratio >= 0.8 ? "bg-yellow-400" : "bg-x-blue";
            const textColor =
              ratio >= 1 ? "text-red-400" : ratio >= 0.8 ? "text-yellow-400" : "text-white";
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-x-gray">{fieldLabels[key]}</span>
                  <span className={`text-sm font-bold ${textColor}`}>
                    {current} / {limit}
                    {ratio >= 0.8 && ratio < 1 && (
                      <span className="ml-2 text-yellow-400 text-xs">⚠️ 上限間近</span>
                    )}
                    {ratio >= 1 && (
                      <span className="ml-2 text-red-400 text-xs">🚫 上限到達</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-x-border rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${barColor}`}
                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 規約ガイドライン */}
      <div className="card mb-6 border-yellow-800">
        <h2 className="font-bold text-yellow-400 mb-3">X 規約ガイドライン（参考上限）</h2>
        <ul className="space-y-1 text-sm text-x-gray">
          <li>• <span className="text-white">リプライ</span>：1日100件程度（スパム判定回避）</li>
          <li>• <span className="text-white">DM</span>：1日50件程度（非フォロワーへの送信は特に注意）</li>
          <li>• <span className="text-white">フォロー</span>：1日400件まで（5000人超は比率制限あり）</li>
          <li>• <span className="text-white">いいね</span>：1日1000件程度（連続操作は避ける）</li>
          <li>• <span className="text-white">同一アカウントへの連続リプライ</span>：避ける（ハラスメント判定）</li>
          <li className="pt-2 text-xs">※ Xの公式上限は非公開です。上記は運用上の目安です。</li>
        </ul>
      </div>

      {/* 過去14日の記録 */}
      <div className="card">
        <h2 className="font-bold text-white mb-4">過去14日の記録</h2>
        {activities.length === 0 ? (
          <p className="text-x-gray text-sm">まだ記録がありません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-x-gray border-b border-x-border">
                  <th className="text-left pb-2 pr-4">日付</th>
                  {Object.keys(DAILY_LIMITS).map((key) => (
                    <th key={key} className="text-right pb-2 px-2">
                      {fieldLabels[key].split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.date} className="border-b border-x-border last:border-0">
                    <td className={`py-2 pr-4 ${a.date === today ? "text-x-blue font-bold" : "text-x-gray"}`}>
                      {a.date === today ? "今日" : a.date.slice(5)}
                    </td>
                    {Object.entries(DAILY_LIMITS).map(([key, limit]) => {
                      const val = (a as unknown as Record<string, number>)[key] ?? 0;
                      const over = val >= limit * 0.8;
                      return (
                        <td key={key} className={`py-2 px-2 text-right ${over ? "text-yellow-400" : "text-white"}`}>
                          {val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
