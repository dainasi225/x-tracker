/**
 * 引用チャンススコア v0.2
 *
 * X For You アルゴリズム（xai-org/x-algorithm）の発想を取り込み、
 * 単一のスコアではなく、行動別（引用 / リプライ / リポスト / ターゲット追加）の
 * 予測スコアを出してから合算する形に変更している。
 *
 * 各アクションのスコアは「やる価値」を 0〜100 で表す。
 * - quoteScore:    自分の意見を乗せて引用する価値
 * - replyScore:    リプライで会話に入る価値
 * - repostScore:   素のリポスト（拡散）として通用する価値
 * - targetAddScore:ターゲットに追加して継続観察する価値
 * - noiseScore:    相互拡散・スパム的なノイズ度合い（高いほど避ける）
 */
export type QuoteOpportunityAction = "QUOTE" | "REPLY" | "REPOST" | "WATCH";

export type QuoteOpportunityMetrics = {
  likeCount: number;
  replyCount: number;
  repostCount: number;
  quoteCount: number;
};

export type PersonalHistoryStats = {
  successfulFollowerAvg: number | null;
  bestActionType: "REPLY" | "QUOTE" | "REPOST" | null;
  bestNicheTags: string[];
  positiveRate: number;
  totalSuccessfulInteractions: number;
};

export type QuoteOpportunityInput = {
  text: string;
  authorName?: string | null;
  authorBio?: string | null;
  authorFollowerCount: number | null;
  authorFollowingCount: number | null;
  createdAt: Date;
  metrics: QuoteOpportunityMetrics;
  myFollowerCount: number;
  nicheKeywords: string[];
  personalHistory?: PersonalHistoryStats;
};

export type QuoteOpportunityScore = {
  score: number;
  label: string;
  action: QuoteOpportunityAction;
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

const NOISE_PATTERNS = [
  /相互フォロー/i,
  /フォロバ100/i,
  /フォロバ/i,
  /\bf4f\b/i,
  /follow\s*back/i,
  /拡散希望/i,
  /プレゼント企画/i,
  /無料配布/i,
];

const QUESTION_PATTERNS = [
  /\?/,
  /？/,
  /どう思/i,
  /教えて/i,
  /おすすめ/i,
  /なぜ/i,
  /理由/i,
  /意見/i,
];

const OPINION_PATTERNS = [
  /と思う/i,
  /と感じ/i,
  /べき/i,
  /結論/i,
  /主張/i,
  /提案/i,
  /分析/i,
  /解説/i,
];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeQuoteKeywords(raw: string | string[]): string[] {
  const values = Array.isArray(raw) ? raw : raw.split(",");
  return values.map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function calculateTopicScore(input: QuoteOpportunityInput): number {
  const keywords = normalizeQuoteKeywords(input.nicheKeywords);
  if (keywords.length === 0) return 0;

  const haystack = `${input.text} ${input.authorName ?? ""} ${input.authorBio ?? ""}`.toLowerCase();
  const matched = keywords.filter((keyword) => haystack.includes(keyword)).length;
  return clampScore((matched / keywords.length) * 100);
}

function calculateConversationScore(input: QuoteOpportunityInput): number {
  const { likeCount, replyCount, repostCount, quoteCount } = input.metrics;
  const followers = Math.max(1, input.authorFollowerCount ?? 1);
  const weightedEngagement =
    replyCount * 1.5 + quoteCount * 1.3 + repostCount * 0.8 + likeCount * 0.2;
  const engagementRateScore = (weightedEngagement / followers) * 2500;
  const conversationMixBonus =
    replyCount + quoteCount >= 50 ? 25 : replyCount + quoteCount >= 20 ? 16 : replyCount + quoteCount >= 8 ? 8 : 0;

  return clampScore(engagementRateScore + conversationMixBonus);
}

function calculateInfluenceScore(input: QuoteOpportunityInput): number {
  const followers = input.authorFollowerCount ?? 0;
  if (followers <= 0) return 35;

  const myFollowers = input.myFollowerCount;
  if (myFollowers > 0) {
    const ratio = followers / myFollowers;
    if (ratio >= 0.3 && ratio <= 10) return 90;
    if (ratio > 10 && ratio <= 30) return 68;
    if (ratio > 30) return 42;
    return 58;
  }

  if (followers >= 1_000 && followers <= 50_000) return 85;
  if (followers > 50_000 && followers <= 200_000) return 65;
  if (followers > 200_000) return 42;
  return 58;
}

function calculateFreshnessScore(createdAt: Date): number {
  const hours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  if (hours <= 6) return 100;
  if (hours <= 24) return 82;
  if (hours <= 72) return 58;
  if (hours <= 24 * 7) return 35;
  return 15;
}

function calculateNoiseScore(input: QuoteOpportunityInput): number {
  const text = `${input.text} ${input.authorBio ?? ""}`.toLowerCase();
  const hasNoise = NOISE_PATTERNS.some((pattern) => pattern.test(text));
  const followers = input.authorFollowerCount ?? 0;
  const following = Math.max(1, input.authorFollowingCount ?? 1);
  const followSpamStyle = following >= 8000 && followers / following < 0.2;

  if (hasNoise && followSpamStyle) return 90;
  if (hasNoise || followSpamStyle) return 60;
  return 0;
}

function detectQuestionLike(text: string): boolean {
  return QUESTION_PATTERNS.some((pattern) => pattern.test(text));
}

function detectOpinionLike(text: string): boolean {
  return OPINION_PATTERNS.some((pattern) => pattern.test(text));
}

function calculatePersonalBoost(input: QuoteOpportunityInput, action: QuoteOpportunityAction): number {
  const history = input.personalHistory;
  if (!history || history.totalSuccessfulInteractions < 3) return 0;

  let boost = 0;

  if (history.successfulFollowerAvg && input.authorFollowerCount) {
    const ratio = input.authorFollowerCount / history.successfulFollowerAvg;
    if (ratio >= 0.4 && ratio <= 2.5) boost += 8;
  }

  if (history.bestActionType) {
    if (action === "QUOTE" && history.bestActionType === "QUOTE") boost += 6;
    if (action === "REPLY" && history.bestActionType === "REPLY") boost += 6;
    if (action === "REPOST" && history.bestActionType === "REPOST") boost += 4;
  }

  if (history.bestNicheTags.length > 0) {
    const haystack = `${input.text} ${input.authorBio ?? ""}`.toLowerCase();
    const hit = history.bestNicheTags.some((tag) => haystack.includes(tag.toLowerCase()));
    if (hit) boost += 6;
  }

  if (history.positiveRate >= 0.5) boost += 3;

  return Math.min(20, boost);
}

function calculateActionScores(input: QuoteOpportunityInput, axes: {
  topic: number;
  conversation: number;
  influence: number;
  freshness: number;
  noise: number;
}): { quote: number; reply: number; repost: number; targetAdd: number } {
  const isQuestion = detectQuestionLike(input.text);
  const hasOpinion = detectOpinionLike(input.text);
  const replyMass = input.metrics.replyCount;
  const quoteMass = input.metrics.quoteCount;
  const followers = input.authorFollowerCount ?? 0;

  const baseAxes = axes.topic * 0.32 + axes.conversation * 0.32 + axes.influence * 0.18 + axes.freshness * 0.10;

  // 引用：自分の意見を乗せて元投稿のオーディエンスにアピール
  let quote = baseAxes;
  if (hasOpinion) quote += 10;
  if (quoteMass >= 5) quote += 8;
  if (axes.topic >= 70) quote += 6;
  if (followers >= 1000 && followers <= 100_000) quote += 4;

  // リプライ：質問・議論型でこそ強い
  let reply = baseAxes;
  if (isQuestion) reply += 14;
  if (replyMass >= 8 && replyMass <= 200) reply += 10;
  if (replyMass > 500) reply -= 8;
  if (axes.influence >= 70) reply += 4;

  // リポスト：自分の意見を足せないが拡散価値のある投稿向き
  let repost = baseAxes * 0.85;
  if (hasOpinion) repost -= 6;
  if (axes.topic >= 70 && axes.conversation < 50) repost += 5;
  if (followers > 200_000) repost -= 4;

  // ターゲット追加：継続観察する価値
  let targetAdd = baseAxes * 0.9;
  if (axes.topic >= 70) targetAdd += 8;
  if (followers >= 500 && followers <= 30_000) targetAdd += 6;
  if (axes.conversation >= 60) targetAdd += 4;

  const noisePenalty = axes.noise * 0.6;
  quote = quote - noisePenalty + calculatePersonalBoost(input, "QUOTE");
  reply = reply - noisePenalty + calculatePersonalBoost(input, "REPLY");
  repost = repost - noisePenalty + calculatePersonalBoost(input, "REPOST");
  targetAdd = targetAdd - noisePenalty * 0.5;

  return {
    quote: clampScore(quote),
    reply: clampScore(reply),
    repost: clampScore(repost),
    targetAdd: clampScore(targetAdd),
  };
}

function chooseAction(actionScores: { quote: number; reply: number; repost: number }): QuoteOpportunityAction {
  const { quote, reply, repost } = actionScores;
  const max = Math.max(quote, reply, repost);
  if (max < 45) return "WATCH";
  if (max === reply) return "REPLY";
  if (max === quote) return "QUOTE";
  return "REPOST";
}

function actionLabel(action: QuoteOpportunityAction): string {
  switch (action) {
    case "QUOTE":
      return "引用推奨";
    case "REPLY":
      return "リプライ推奨";
    case "REPOST":
      return "リポスト向き";
    case "WATCH":
      return "様子見";
  }
}

function scoreLabel(score: number): string {
  if (score >= 80) return "かなり有望";
  if (score >= 65) return "有望";
  if (score >= 45) return "試す価値あり";
  return "今は様子見";
}

export function calculateQuoteOpportunityScore(input: QuoteOpportunityInput): QuoteOpportunityScore {
  const axes = {
    topic: calculateTopicScore(input),
    conversation: calculateConversationScore(input),
    influence: calculateInfluenceScore(input),
    freshness: calculateFreshnessScore(input.createdAt),
    noise: calculateNoiseScore(input),
  };

  const actionScores = calculateActionScores(input, axes);
  const action = chooseAction(actionScores);

  const totalScore = clampScore(
    Math.max(actionScores.quote, actionScores.reply, actionScores.repost, actionScores.targetAdd * 0.85)
  );

  const reasons: string[] = [];
  if (axes.topic >= 70) reasons.push(`トピック一致 ${axes.topic}%`);
  if (axes.conversation >= 70) reasons.push("返信・引用が伸びやすい投稿");
  if (axes.influence >= 80) reasons.push("相手の規模が狙いやすい");
  if (axes.freshness >= 80) reasons.push("投稿が新しく初動に入りやすい");
  if (detectQuestionLike(input.text)) reasons.push("質問・議論型の投稿");
  if (detectOpinionLike(input.text)) reasons.push("意見の余地がある投稿");
  if (axes.noise >= 60) reasons.push("相互拡散系・フォロー過多の可能性あり");
  if (reasons.length === 0) reasons.push("会話候補として最低限チェック");

  const personalBoost = calculatePersonalBoost(input, action);

  return {
    score: totalScore,
    label: scoreLabel(totalScore),
    action,
    actionLabel: actionLabel(action),
    actionScores,
    axes,
    reasons,
    personalBoost,
  };
}

/**
 * 著者多様性のための減衰乗数。
 * x-algorithm の AuthorDiversityScorer と同じ考え方で、
 * 同じ著者がリストに何度も出てくると 2 件目以降のスコアを徐々に下げる。
 */
export function authorDiversityMultiplier(
  position: number,
  decayFactor = 0.55,
  floor = 0.4,
): number {
  return (1 - floor) * Math.pow(decayFactor, position) + floor;
}
