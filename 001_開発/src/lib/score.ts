/**
 * フォローバック予測スコア v0.2（2026年 X 実データ反映版）
 *
 * ベースライン 45 からスタートし、各要素の加減点で 0〜100 に正規化。
 * 予想フォローバック確率の目安としてスコアを % 表示に使用可能。
 *
 * 実データ根拠（2025-2026 X アルゴリズム調査）：
 *   - Replies は Likes の 15 倍前後の重み（会話生成 = 最強シグナル）
 *   - Likes は「弱い興味信号」。単発では効果薄
 *   - フォロワー 3,000 人未満の相互率は 5,000 人超の約 8 倍（実験値）
 *   - エンゲージメントは 14 日を超えると急速に冷める
 *
 * 各カテゴリの上限：
 *   エンゲージメント強度   最大 +74（返信+42、いいね+18、高質反応+14）
 *   相互フォローしやすさ   +16 〜 -25
 *   累積接触ボーナス       最大 +13
 *   時間減衰ペナルティ     最大 -25
 */

import { SCORE_2026, SCORE_BANDS_2026 } from "./score-rules-2026";

export interface EngagementRecord {
  followerCount: number | null;
  followingCount: number | null; // FF比率計算用
  myFollowerCount: number | null; // 自分のフォロワー数（相対比較用）
  personaSimilarity: number; // 0〜1（手動入力または簡易計算）
  lastLikeAt: Date | null;
  lastReplyAt: Date | null;
  hasAuthorReplyBack: boolean; // 自分の返信後に相手から返信があったか
  conversationDepth: number; // 会話の深さ（返信関連イベント数を簡易利用）
  lastPositiveReactionAt: Date | null; // 引用RT・詳細コメント等の高質反応
  totalInteractions: number;
  positiveScore: number; // 累積ポジティブ度（0〜10 でクランプして利用）
  lastContactAt: Date | null;
}

export type ScoreFactor = {
  name: string;
  delta: number;
  reason: string;
};

export interface UserPersona {
  followerCount: number;
  followingCount?: number;
  nicheKeywords: string[];
  avgEngagementRate: number;
  ffRatio: number;
  preferredTargetSize?: "small" | "medium" | "large";
  successRateBySize?: {
    small: number;
    medium: number;
    large: number;
  };
}

export interface TargetingStrategy {
  headline: string;
  recommendedSegments: {
    name: string;
    scoreBonus: number;
    reason: string;
    exampleAction: string;
    expectedFollowBackLift: string;
  }[];
  dailyActionPlan: string[];
  warning?: string;
}

/**
 * ニッチキーワードの簡易類似度（Jaccard 係数）。
 * 将来の埋め込みベース実装までの暫定ロジックとして利用可能。
 */
export function calculatePersonaSimilarityByKeywords(
  myKeywords: string[],
  opponentKeywords: string[]
): number {
  const normalize = (keywords: string[]) =>
    keywords
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

  const me = new Set(normalize(myKeywords));
  const opponent = new Set(normalize(opponentKeywords));

  if (me.size === 0 || opponent.size === 0) return 0;

  const meArray = Array.from(me);
  const opponentArray = Array.from(opponent);
  const intersection = meArray.filter((k) => opponent.has(k)).length;
  const union = new Set([...meArray, ...opponentArray]).size;
  return union === 0 ? 0 : intersection / union;
}

export function buildEngagementRecord(
  target: {
    followerCount: number | null;
    followingCount?: number | null;
    xFollowerCount: number | null;
    xFollowingCount?: number | null;
    lastApproachedAt: Date | null;
    myFollowerCount?: number | null;
    personaSimilarity?: number | null;
  },
  interactions: {
    result: string;
    sentiment: string | null;
    createdAt: Date;
  }[]
): EngagementRecord {
  const sorted = (filter: (ix: (typeof interactions)[0]) => boolean) =>
    interactions
      .filter(filter)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      ?.createdAt ?? null;

  const lastLikeAt = sorted((ix) => ix.result === "LIKED");
  const lastReplyAt = sorted((ix) => ix.result === "REPLIED");
  const replyEvents = interactions.filter((ix) => ix.result === "REPLIED");
  const conversationDepth = replyEvents.length;
  const hasAuthorReplyBack = conversationDepth >= 2;

  // 高質反応 = 返信＋ポジティブ or フォローされた
  const lastPositiveReactionAt = sorted(
    (ix) =>
      ix.result === "FOLLOWED" ||
      (ix.result === "REPLIED" && ix.sentiment === "POSITIVE")
  );

  const positiveScore = Math.min(
    10,
    interactions.filter((ix) => ix.sentiment === "POSITIVE").length
  );

  return {
    followerCount: target.xFollowerCount ?? target.followerCount,
    followingCount: target.xFollowingCount ?? target.followingCount ?? null,
    myFollowerCount: target.myFollowerCount ?? null,
    personaSimilarity: Math.max(0, Math.min(1, target.personaSimilarity ?? 0)),
    lastLikeAt: lastLikeAt ? new Date(lastLikeAt) : null,
    lastReplyAt: lastReplyAt ? new Date(lastReplyAt) : null,
    hasAuthorReplyBack,
    conversationDepth,
    lastPositiveReactionAt: lastPositiveReactionAt ? new Date(lastPositiveReactionAt) : null,
    totalInteractions: interactions.length,
    positiveScore,
    lastContactAt: target.lastApproachedAt ? new Date(target.lastApproachedAt) : null,
  };
}

function daysSince(date: Date | null): number {
  if (!date) return 999;
  return (Date.now() - new Date(date).getTime()) / (1000 * 3600 * 24);
}

/** スコア計算本体。要因ごとの内訳 factors も返す */
export function calculateDetailedScore(
  eng: EngagementRecord,
  myPersona?: UserPersona
): {
  score: number;
  factors: ScoreFactor[];
} {
  const factors: ScoreFactor[] = [];
  let score = SCORE_2026.base;

  // ─── 1. エンゲージメント強度（最大 +72） ──────────────────────────
  // Replies を最重視（実データ: Likes の 15 倍前後の重み）

  const dReply = daysSince(eng.lastReplyAt);
  if (dReply <= 7) {
    const delta = eng.hasAuthorReplyBack
      ? SCORE_2026.replyWithin7dConversation
      : SCORE_2026.replyWithin7dSingle;
    factors.push({
      name: eng.hasAuthorReplyBack ? "直近7日以内に会話成立あり" : "直近7日以内に返信あり",
      delta,
      reason: eng.hasAuthorReplyBack
        ? `最終返信 ${Math.round(dReply)}日前 / 会話深度 ${eng.conversationDepth} ─ 会話成立シグナル`
        : `最終返信 ${Math.round(dReply)}日前 ─ 会話生成は最強フォローバックシグナル`,
    });
    score += delta;
  } else if (dReply <= 14) {
    const delta = eng.hasAuthorReplyBack
      ? SCORE_2026.replyWithin14dConversation
      : SCORE_2026.replyWithin14dSingle;
    factors.push({
      name: eng.hasAuthorReplyBack ? "直近14日以内に会話成立あり" : "直近14日以内に返信あり",
      delta,
      reason: `最終返信 ${Math.round(dReply)}日前 ─ まだ有効な接点`,
    });
    score += delta;
  }

  const dLike = daysSince(eng.lastLikeAt);
  if (dLike <= 7) {
    factors.push({
      name: "直近7日以内にいいねあり",
      delta: SCORE_2026.likeWithin7d,
      reason: `最終いいね ${Math.round(dLike)}日前 ─ 弱い興味シグナル（返信の約1/15の重み）`,
    });
    score += SCORE_2026.likeWithin7d;
  } else if (dLike <= 14) {
    factors.push({
      name: "直近14日以内にいいねあり",
      delta: SCORE_2026.likeWithin14d,
      reason: `最終いいね ${Math.round(dLike)}日前`,
    });
    score += SCORE_2026.likeWithin14d;
  }

  // 高質反応ボーナス（引用RT・詳細コメント・ポジティブな返信）
  if (eng.positiveScore >= 7) {
    factors.push({
      name: "高質なポジティブ反応が多い",
      delta: SCORE_2026.positiveHigh,
      reason: `累積ポジティブ反応 ${eng.positiveScore}件 ─ 引用RT・詳細コメント等`,
    });
    score += SCORE_2026.positiveHigh;
  } else if (eng.positiveScore >= 4) {
    factors.push({
      name: "ポジティブ反応あり",
      delta: SCORE_2026.positiveMid,
      reason: `累積ポジティブ反応 ${eng.positiveScore}件`,
    });
    score += SCORE_2026.positiveMid;
  }

  // ─── 2. 相互フォローしやすさ（フォロワー数） ────────────────────────
  // 2026年実験値：3,000人未満は5,000人超の約8倍の相互率

  const fc = eng.followerCount;
  if (fc != null) {
    if (fc < 3_000) {
      factors.push({
        name: "超相互しやすい層",
        delta: SCORE_2026.followerLt3000,
        reason: `フォロワー ${fc.toLocaleString()}人 ─ 相互率が高い小規模層（実験値で8倍差）`,
      });
      score += SCORE_2026.followerLt3000;
    } else if (fc < 5_000) {
      factors.push({
        name: "相互しやすい層（小規模）",
        delta: SCORE_2026.followerLt5000,
        reason: `フォロワー ${fc.toLocaleString()}人 ─ 小規模帯で相互率が高い`,
      });
      score += SCORE_2026.followerLt5000;
    } else if (fc < 10_000) {
      factors.push({
        name: "相互しやすい層",
        delta: SCORE_2026.followerLt10000,
        reason: `フォロワー ${fc.toLocaleString()}人 ─ 比較的相互率が高い`,
      });
      score += SCORE_2026.followerLt10000;
    } else if (fc > 80_000) {
      factors.push({
        name: "フォローバックが困難な大規模層",
        delta: SCORE_2026.followerGt80000High,
        reason: `フォロワー ${fc.toLocaleString()}人 ─ 相互率が急激に低下`,
      });
      score += SCORE_2026.followerGt80000High;
    } else if (fc > 50_000) {
      factors.push({
        name: "フォローバックが難しい層",
        delta: SCORE_2026.followerGt50000Low,
        reason: `フォロワー ${fc.toLocaleString()}人 ─ 相互率が低い`,
      });
      score += SCORE_2026.followerGt50000Low;
    }
  }

  // ─── 2.5 自分との規模差（相対フォロワー比） ─────────────────────────
  const myFollowerCount = myPersona?.followerCount ?? eng.myFollowerCount;
  if (fc != null && myFollowerCount != null && myFollowerCount > 0) {
    const ratio = fc / myFollowerCount;
    if (ratio >= SCORE_2026.ratioGoldenMin && ratio <= SCORE_2026.ratioGoldenMax) {
      factors.push({
        name: "同規模〜少し大きい相手（黄金ゾーン）",
        delta: SCORE_2026.ratioGoldenZone,
        reason: `相対比 ${ratio.toFixed(2)}x ─ 相互しやすい帯`,
      });
      score += SCORE_2026.ratioGoldenZone;
    } else if (ratio > SCORE_2026.ratioTooLargeMin) {
      factors.push({
        name: "相手規模が大きすぎる",
        delta: SCORE_2026.ratioTooLargePenalty,
        reason: `相対比 ${ratio.toFixed(2)}x ─ フォローバック難易度が高い`,
      });
      score += SCORE_2026.ratioTooLargePenalty;
    } else if (ratio < SCORE_2026.ratioTooSmallMax) {
      factors.push({
        name: "相手が超小規模",
        delta: SCORE_2026.ratioTooSmallBonus,
        reason: `相対比 ${ratio.toFixed(2)}x ─ 反応獲得しやすい`,
      });
      score += SCORE_2026.ratioTooSmallBonus;
    }
  }

  // ─── 2.6 FF比率（Follower / Following） ─────────────────────────────
  if (eng.followerCount != null && eng.followingCount != null && eng.followingCount > 0) {
    const opponentFFRatio = eng.followerCount / eng.followingCount;
    if (opponentFFRatio < SCORE_2026.ffRatioFollowBackLikelyMax) {
      factors.push({
        name: "FF比率が低め（フォロー返し傾向）",
        delta: SCORE_2026.ffRatioFollowBackLikelyBonus,
        reason: `相手FF比率 ${opponentFFRatio.toFixed(2)} ─ 相互化しやすい傾向`,
      });
      score += SCORE_2026.ffRatioFollowBackLikelyBonus;
    }

    // 自分のFF比率と近い場合は「運用スタイル近似」として小さく加点
    if (myPersona?.ffRatio != null && myPersona.ffRatio > 0) {
      const ffGap = Math.abs(opponentFFRatio - myPersona.ffRatio);
      if (ffGap <= 0.6) {
        factors.push({
          name: "FF運用スタイルが近い",
          delta: 3,
          reason: `自分 ${myPersona.ffRatio.toFixed(2)} / 相手 ${opponentFFRatio.toFixed(2)} ─ 相互行動の相性が高い`,
        });
        score += 3;
      }
    }
  }

  // ─── 3. 累積接触の深さ（最大 +13） ────────────────────────────────
  if (eng.totalInteractions >= 5) {
    factors.push({
      name: "接触回数が多い（本気度が伝わる）",
      delta: SCORE_2026.interactionGte5,
      reason: `総接触回数 ${eng.totalInteractions}回 ─ 複数回の関与でフォローバック確率が跳ね上がる`,
    });
    score += SCORE_2026.interactionGte5;
  } else if (eng.totalInteractions >= 3) {
    factors.push({
      name: "接触回数あり",
      delta: SCORE_2026.interactionGte3,
      reason: `総接触回数 ${eng.totalInteractions}回`,
    });
    score += SCORE_2026.interactionGte3;
  }

  // ─── 4. 時間減衰ペナルティ（最大 -25） ─────────────────────────────
  // 14日を超えると関心が急冷（X アルゴリズムも最新性を重視）

  const dContact = daysSince(eng.lastContactAt);
  if (dContact > 14) {
    const penalty = Math.min(SCORE_2026.inactivityPenaltyMax, Math.round(dContact * 1.3));
    factors.push({
      name: "最終接触から時間が経過",
      delta: -penalty,
      reason: `${Math.round(dContact)}日間未接触 ─ 14日超で関心が急速に冷める`,
    });
    score -= penalty;
  }

  // ─── 5. ペルソナ類似度（SimClusters近似） ──────────────────────────
  if (eng.personaSimilarity > 0) {
    const bonus = Math.round(eng.personaSimilarity * SCORE_2026.personaSimilarityMaxBonus);
    factors.push({
      name: "ペルソナ類似度",
      delta: bonus,
      reason:
        eng.personaSimilarity >= SCORE_2026.personaSimilarityStrongThreshold
          ? `類似度 ${(eng.personaSimilarity * 100).toFixed(0)}% ─ 同ニッチで継続関係が見込みやすい`
          : `類似度 ${(eng.personaSimilarity * 100).toFixed(0)}%`,
    });
    score += bonus;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return { score: finalScore, factors };
}

/** スコアだけ返すシンプルな関数 */
export function calculateFollowBackScore(eng: EngagementRecord, myPersona?: UserPersona): number {
  return calculateDetailedScore(eng, myPersona).score;
}

/**
 * DB上の直近エンゲージメントから、今日のターゲティング戦略を組み立てる。
 * 外部APIなしで「どの層に返信を寄せるべきか」を判断するための補助関数。
 */
export function generateTargetingStrategy(
  myPersona: UserPersona,
  recentEngagements: EngagementRecord[]
): TargetingStrategy {
  const totalEng = recentEngagements.length;
  const detailed = recentEngagements.map((eng) => ({
    eng,
    score: calculateDetailedScore(eng, myPersona).score,
  }));

  const smallUsers = detailed.filter((x) => (x.eng.followerCount ?? Number.MAX_SAFE_INTEGER) < 3_000);
  const mediumUsers = detailed.filter((x) => {
    const fc = x.eng.followerCount ?? Number.MAX_SAFE_INTEGER;
    return fc >= 3_000 && fc < 15_000;
  });

  const strongPositiveUsers = detailed.filter(
    (x) => x.eng.positiveScore >= 6 || x.eng.hasAuthorReplyBack || x.eng.conversationDepth >= 2
  );

  const highRate = (count: number) => {
    if (totalEng === 0) return 0;
    return Math.round((count / totalEng) * 100);
  };

  const smallSuccess = highRate(smallUsers.filter((x) => x.score >= 65).length);
  const mediumSuccess = highRate(mediumUsers.filter((x) => x.score >= 65).length);
  const positiveSuccess = highRate(strongPositiveUsers.filter((x) => x.score >= 65).length);

  // 自分の規模基準で、返信しやすい発見ゾーンを表示
  const idealMin = Math.floor(myPersona.followerCount * 0.3);
  const idealMax = Math.floor(myPersona.followerCount * 3.0);
  const primaryKeyword = myPersona.nicheKeywords[0] ?? "あなたのニッチ";

  return {
    headline: `あなたの現状（${myPersona.followerCount.toLocaleString()}人）では「${idealMin.toLocaleString()}〜${idealMax.toLocaleString()}人規模の${primaryKeyword}層」を最優先で返信しましょう`,
    recommendedSegments: [
      {
        name: "小規模相互層（<3,000人）",
        scoreBonus: 17,
        reason: "小規模層は相互化しやすく、同ニッチ会話が続きやすい傾向があります",
        exampleAction: "直近7日以内に返信した相手の中から、小規模層へ深掘り返信を追加",
        expectedFollowBackLift: `+${Math.max(10, smallSuccess)}%アップ見込み`,
      },
      {
        name: "中規模類似ニッチ（3k〜15k人）",
        scoreBonus: 12,
        reason: "自分の2〜10倍帯とニッチ一致の組み合わせは発見されやすいゾーンです",
        exampleAction: "同じキーワードを持つ中規模アカウントへ、毎日3〜5件の戦略返信",
        expectedFollowBackLift: `+${Math.max(8, mediumSuccess)}%アップ見込み`,
      },
      {
        name: "高質反応ユーザー",
        scoreBonus: 14,
        reason: "引用RT・深いコメント・返信往復がある相手は会話化しやすいです",
        exampleAction: "詳細コメントには必ず1回、具体論を足した返信を返す",
        expectedFollowBackLift: `+${Math.max(12, positiveSuccess)}%アップ見込み`,
      },
    ],
    dailyActionPlan: [
      `今日の返信目標：${Math.min(8, Math.max(3, Math.floor(myPersona.followerCount / 1000)))}件（${primaryKeyword}関連）`,
      "小規模層（<3k）の未フォロー高スコア候補を3人ピックアップ",
      "返信70%・オリジナル投稿30%の配分を守る",
      "自分のFF比率を健全に保つ（FollowingをFollowerの1.2倍以内）",
    ],
    warning:
      myPersona.ffRatio > 2.5
        ? "FF比率がやや高めです。新規フォローより既存エンゲージメント層への深掘りを優先してください"
        : totalEng < 10
          ? "学習データがまだ少ないため、直近30件以上の記録で精度が安定します"
          : undefined,
  };
}

/**
 * スコアから表示ラベルと色クラスを返す
 * 75+ かなり有望 / 60-74 おすすめ / 40-59 効果あり / 40未満 低
 */
export function scoreLabel(score: number): {
  label: string;
  sublabel: string;
  color: string;
  bg: string;
} {
  const band = SCORE_BANDS_2026.find((x) => score >= x.min) ?? SCORE_BANDS_2026[SCORE_BANDS_2026.length - 1];
  if (band.min >= 75) return { label: "高", sublabel: band.label, color: "text-green-400", bg: "bg-green-900" };
  if (band.min >= 60) return { label: "中高", sublabel: band.label, color: "text-teal-400", bg: "bg-teal-900" };
  if (band.min >= 40) return { label: "中", sublabel: band.label, color: "text-yellow-400", bg: "bg-yellow-900" };
  return { label: "低", sublabel: band.label, color: "text-x-gray", bg: "bg-gray-800" };
}

/** フェーズに応じた推奨アクションを返す */
export function recommendedAction(phase: string): string {
  switch (phase) {
    case "PROSPECT":  return "いいね or リプライで最初の接点をつくる";
    case "CONTACTED": return "返信・引用でエンゲージメントを深める";
    case "ENGAGED":   return "フォローを検討 or DMで個別コンタクト";
    case "PARTNER":   return "コラボ・紹介を打診する";
    default:          return "アプローチを検討する";
  }
}
