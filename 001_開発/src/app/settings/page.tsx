import { prisma } from "@/lib/db";
import SettingsForm from "./SettingsForm";

async function getPersona() {
  const persona = await prisma.userPersona.findUnique({
    where: { id: "default" },
  });

  if (!persona) {
    return {
      xUsername: "",
      xApiCachedAt: null as string | null,
      followerCount: 0,
      nicheKeywords: "",
      avgEngagementRate: 0,
      ffRatio: 1,
    };
  }

  return {
    xUsername: persona.xUsername ?? "",
    xApiCachedAt: persona.xApiCachedAt ? persona.xApiCachedAt.toISOString() : null,
    followerCount: persona.followerCount,
    nicheKeywords: persona.nicheKeywords,
    avgEngagementRate: persona.avgEngagementRate,
    ffRatio: persona.ffRatio,
  };
}

export default async function SettingsPage() {
  const persona = await getPersona();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">設定</h1>
        <p className="text-x-gray text-sm mt-1">
          フォローバックスコアで使う、自分の基準情報を設定します。
        </p>
      </div>
      <SettingsForm initial={persona} />
    </div>
  );
}
