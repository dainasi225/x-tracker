export type RuleEvidence = {
  element: string;
  points: string;
  evidence2026: string;
  details: string[];
};

/**
 * 2026年の運用知見をもとにした、フォローバック予測スコアの根拠データ。
 * 「仕様の元ライブラリ」として、計算ロジックと説明文の両方で使う。
 */
export const SCORE_RULE_EVIDENCE_2026: RuleEvidence[] = [
  {
    element: "返信（直近7日）",
    points: "+40",
    evidence2026:
      "RepliesはLikesの約15倍の重み。会話が生まれるとフォローバック率が大きく上がる。",
    details: [
      "RepliesはLikesの13.5〜27倍の重みで評価されるレンジが多い。",
      "会話成立（返信往復）では75〜150倍級の強いシグナルになる。",
      "返信された相手のフォローバック率はLikes中心より3〜8倍高い傾向。",
      "最新性重視のため、特に直近7日が強い。",
    ],
  },
  {
    element: "いいね（直近7日）",
    points: "+18",
    evidence2026: "Likesは件数は多いが単体シグナルは弱く、補助指標として扱う。",
    details: [
      "Likesは基準値1xまたは0.5x相当の弱いシグナルとして扱われる。",
      "単発Likesだけでは拡散にもフォローバックにも寄与しにくい。",
      "Likes偏重は見せかけエンゲージメントとして低評価されやすい。",
    ],
  },
  {
    element: "高質反応（positive）",
    points: "+7〜+14",
    evidence2026: "引用RTや詳細コメントは強い興味を示す反応として評価する。",
    details: [
      "Quote TweetはLikes比で約25x、Repostは約20xの強い信号。",
      "詳細コメントや返信＋いいねの組み合わせは深い関与として扱う。",
      "ポジティブ度が高い反応はフォローバック率を10〜20%押し上げる傾向。",
    ],
  },
  {
    element: "フォロワー < 3,000",
    points: "+16",
    evidence2026: "小規模アカウントほど相互率・フォローバック率が高い傾向。",
    details: [
      "Nano/Micro（特に3,000以下）はエンゲージメント率が高い。",
      "小規模層への本気返信が大規模層より明確に成果を出した実験がある。",
      "同規模層は相互フォローが成立しやすい。",
    ],
  },
  {
    element: "フォロワー > 50,000",
    points: "-18〜-25",
    evidence2026: "大規模アカウントはフォローバックのハードルが高い。",
    details: [
      "50k超でエンゲージメント率が0.5〜2%帯に落ちるケースが多い。",
      "フォロー返し率は2〜5%程度に低下しやすい。",
      "80k超でさらにペナルティを強める傾向がある。",
    ],
  },
  {
    element: "累積接触 >= 5回",
    points: "+13",
    evidence2026: "複数回接触で関係性の深まりを示す。",
    details: [
      "複数回接触は関係性の深さとして認識される。",
      "単発より累積接触が多い対象の方がフォローバック率が上がる。",
      "会話の継続性が主要な鍵になる。",
    ],
  },
  {
    element: "14日以上接触なし",
    points: "-最大25",
    evidence2026: "時間経過でエンゲージメントは減衰し、最新性重視の影響を受ける。",
    details: [
      "時間減衰が急で、古い接点は価値が落ちやすい。",
      "14日超で関心が急冷しやすく、再活性化コストが上がる。",
      "2026年は特に最新性重視の傾向が強い。",
    ],
  },
  {
    element: "FF比率（Follower / Following）",
    points: "+8",
    evidence2026:
      "FF比率はフォロー返し傾向の proxy として機能し、相互化しやすさの実務指標になる。",
    details: [
      "相手のFF比率が低め（例: 1.5未満）だとフォロー返し傾向が比較的高い。",
      "絶対フォロワー数だけでなく、行動スタイルを反映できる。",
      "相対規模ルールと併用すると誤判定を減らせる。",
    ],
  },
  {
    element: "ペルソナ類似度（SimClusters近似）",
    points: "+最大18",
    evidence2026:
      "同一ニッチ内の相互作用は継続率・フォローバック率が高く、推薦にも乗りやすい。",
    details: [
      "プロフィールや投稿テーマの近さは、興味クラスタ一致の近似として有効。",
      "初期は手動0〜1入力でも十分に実務効果がある。",
      "将来は埋め込みやキーワード一致率で自動算出に拡張しやすい。",
    ],
  },
];

export const SCORE_2026 = {
  base: 50,
  replyWithin7dSingle: 40,
  replyWithin7dConversation: 58,
  replyWithin14dSingle: 22,
  replyWithin14dConversation: 32,
  replyWithin7d: 42,
  replyWithin14d: 24,
  likeWithin7d: 16,
  likeWithin14d: 10,
  positiveMid: 7,
  positiveHigh: 14,
  followerLt3000: 16,
  followerLt5000: 14,
  followerLt10000: 8,
  followerGt50000Low: -18,
  followerGt80000High: -25,
  ratioGoldenZone: 12,
  ratioTooLargePenalty: -15,
  ratioTooSmallBonus: 6,
  ratioGoldenMin: 0.3,
  ratioGoldenMax: 3,
  ratioTooLargeMin: 10,
  ratioTooSmallMax: 0.1,
  ffRatioFollowBackLikelyMax: 1.5,
  ffRatioFollowBackLikelyBonus: 8,
  personaSimilarityMaxBonus: 18,
  personaSimilarityStrongThreshold: 0.7,
  interactionGte5: 13,
  interactionGte3: 7,
  inactivityPenaltyMax: 25,
} as const;

export type ScoreBand = {
  min: number;
  label: string;
  description: string;
};

export const SCORE_BANDS_2026: ScoreBand[] = [
  {
    min: 75,
    label: "かなり有望",
    description: "小規模 + 最近返信ありのパターンが多い",
  },
  {
    min: 60,
    label: "おすすめ",
    description: "優先して関わる価値が高い",
  },
  {
    min: 40,
    label: "関わると効果ありそう",
    description: "育成対象として有効",
  },
  {
    min: 0,
    label: "今は様子見",
    description: "接触間隔か反応設計の見直しが必要",
  },
];

