import { prisma } from "@/lib/db";
import QuoteOpportunitiesClient from "./QuoteOpportunitiesClient";

export default async function QuoteOpportunitiesPage() {
  const myPersona = await prisma.userPersona.findUnique({ where: { id: "default" } });

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">引用チャンス</h1>
          <p className="text-x-gray text-sm mt-1">
            自分のトピックに近く、会話が生まれやすい投稿を探します。実際の返信・引用はX上で手動実行してください。
          </p>
        </div>
        <div className="text-right text-xs text-x-gray">
          <p>評価軸: トピック一致 / 会話率 / 規模 / 鮮度</p>
          <p>投稿・フォロー等の自動操作は行いません</p>
        </div>
      </div>

      <QuoteOpportunitiesClient defaultKeywords={myPersona?.nicheKeywords ?? ""} />
    </div>
  );
}
