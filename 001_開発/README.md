# X-Tracker

X（旧Twitter）のアカウント関係管理・エンゲージメント最大化ツール。  
**手動操作のみ・規約完全準拠**で設計された個人用CRMです。

---

## 概要

「誰に・何をしたか・どう反応されたか」を記録し、効率的なエンゲージメント戦略を立てるためのツールです。  
自動投稿・自動フォロー等の機能は一切持ちません。記録・分析・判断をサポートし、実際のアクションは手動で行います。

---

## 主な機能

### 1. ターゲット管理（`/targets`）
- アカウントを登録し、優先度・フェーズ・次回アプローチ日を管理
- フェーズ：`未接触 → 接触済み → 反応あり → 関係構築済み`
- 次回アプローチ日が来たカードはハイライト表示（⚡）
- `最近のやりとり相手を自動更新` ボタンで、X APIから候補を自動反映（新規追加 + 既存更新）
- 自動登録時にフォロワー数・フォロー数・FF比率・自分との規模差を見て `priority/tags/notes` を自動調整
- 自動更新時に「自分のフォロワー」判定も行い、該当対象は `isFollowing=true / PARTNER` に更新して一覧から除外
- `FOLLOWED`（相手がフォロー）を記録した対象は自動で `PARTNER` に移行し、ターゲット一覧から除外
- `除外` 操作でアプリ内ブラックリストに追加し、提案・ターゲット一覧から除外（X上のブロック操作は行わない）

### 2. インタラクション記録（`/interactions`）
- リプライ・いいね・リポスト・引用・DM・フォロー・メンションを記録
- **結果**（反応なし / いいねされた / 返信された / フォローされた）を記録
- **反応の質**（ポジティブ / ニュートラル / ネガティブ）と**話題タグ**を記録
- 記録と同時に `Target.lastApproachedAt` を自動更新、`DailyActivity` を自動集計
- `最近のやりとりを一括同期` ボタンで、返信・メンション履歴から `Interaction` を自動生成

### 3. 行動量ログ（`/activity`）
- 1日の行動量を自動集計し、上限ゲージで可視化
- 上限80%到達で警告（⚠️）、100%到達で赤表示（🚫）
- 過去14日の履歴テーブル
- `活動量ログを更新` ボタンで、インタラクション履歴から過去14日を再集計（同期後のズレを補正）

### 4. ダッシュボード（`/`）
- ターゲット数・総インタラクション数・高優先度数
- フェーズ別内訳・種類別インタラクション・今日の行動量ゲージ

### 5. 自分の情報設定（`/settings`）
- フォローバックスコアの基準になる自分の情報を保存
- 保存項目：フォロワー数 / FF比率 / 平均エンゲージ率 / ニッチキーワード
- 提案スコア計算時に `myPersona` として利用
- `X API` 認証（Bearer Token）で自分情報を読み込み可能（`Xから読み込む`）

### 6. フォロー棚卸し（`/follow-audit`）
- `X API` から「自分がフォロー中」と「自分のフォロワー」を取得して差分を表示
- **自分はフォローしているが、相手はフォローしていない** アカウント（片思いフォロー）を一覧化
- 一覧上で X プロフィールを直接開ける
- 既にターゲット登録済みの相手は `履歴を見る` からインタラクション確認が可能

---

## データモデル

```
Target（アカウント）
  ├── priority:         HIGH | MEDIUM | LOW
  ├── phase:            PROSPECT | CONTACTED | ENGAGED | PARTNER
  ├── lastApproachedAt: 最後のアプローチ日時（インタラクション記録時に自動更新）
  ├── nextApproachAt:   次回推奨アプローチ日（手動設定）
  ├── Interaction（インタラクション履歴）
  │     ├── type:       REPLY | LIKE | REPOST | QUOTE | DM | FOLLOW | MENTION | OTHER
  │     ├── result:     NO_RESPONSE | LIKED | REPLIED | FOLLOWED | UNFOLLOWED
  │     ├── sentiment:  POSITIVE | NEUTRAL | NEGATIVE
  │     └── topic:      話題タグ（自由入力）
  └── Strategy（アプローチ戦略メモ）
        └── approach / result / nextAction

DailyActivity（日次行動量ログ）
  └── 日付ごとに replyCount / dmCount / followCount / likeCount / quoteCount を集計
```

---

## 行動量ガイドライン（X規約準拠の目安）

| アクション | 1日の目安上限 | 備考 |
|-----------|-------------|------|
| リプライ  | 100件       | 同一アカウントへの連続リプライは避ける |
| DM        | 50件        | 非フォロワーへの送信は特に注意 |
| フォロー  | 400件       | フォロワー5,000人超は比率制限あり |
| いいね    | 1,000件     | 連続操作は避ける |
| 引用      | 50件        | |

※ X の公式上限は非公開。上記は運用上の経験則です。

---

## 今後の拡張予定

| 機能 | 概要 |
|------|------|
| フォローバック予測スコア（v0.3） | インタラクション履歴 + FF比率 + ペルソナ類似度で算出 |
| デイリータスク提案 | 「今日おすすめトップ5」（フェーズ・最終接触日ベース） |
| X API 連携 | リアクション結果の自動取得（GET /2/tweets/{id}/liking_users 等） |
| LINE / Discord 通知 | 次回アプローチ日のリマインダー・上限警告通知 |
| 成功パターン学習 | 話題タグ×結果の相関分析・アプローチ改善提案 |

---

## スコア仕様書（2026年根拠データ）

- フォローバックスコアの根拠データと判定基準: `docs/followback-score-spec-2026.md`
- 実装ライブラリ: `src/lib/score-rules-2026.ts`, `src/lib/score.ts`
- v0.3 追加要素:
  - `FF比率（Follower / Following）` を相互化しやすさ判定に利用
  - `ペルソナ類似度（0〜1）` を SimClusters 近似として加点
  - `calculatePersonaSimilarityByKeywords()` による簡易キーワード一致率（Jaccard）計算
- v0.4 追加要素:
  - `generateTargetingStrategy()` を追加（DBの直近エンゲージメントだけで「今日の狙い先」を生成）
  - 自分の規模に対する推奨ターゲット帯（0.3x〜3.0x）を見出しで提示
  - 小規模 / 中規模 / 高質反応の3セグメント別に日次アクションを提案

---

## 技術スタック

| 技術 | バージョン |
|------|-----------|
| Next.js | 14.x (App Router) |
| React | 18.x |
| Prisma | 5.x |
| SQLite | ローカル |
| TypeScript | 5.x |
| Tailwind CSS | 3.x |

---

## セットアップ

```bash
# 1. 依存関係
npm install

# 2. 環境変数
cp .env.example .env   # Windows: Copy-Item .env.example .env

# 2.1 X API を使う場合
# X_API_BEARER_TOKEN と必要なら X_MY_USERNAME を設定

# 3. DBマイグレーション
npm run db:migrate

# 4. 起動
npm run dev
```

→ http://localhost:3000 でアクセス

## 起動手順（CLI最小）

前提: 一度だけ `npm install` と `npm run db:migrate` が完了していること。

1. Cursorで `001_開発` フォルダを開く  
2. Cursorのターミナルで `npm run dev` を実行（起動はこの1コマンドだけ）  
3. ブラウザで `http://localhost:3000` を開く  
4. 連携は画面操作で実行  
   - `ターゲット` 画面でアカウント追加  
   - 対象行の `X同期` を押す  
   - 続けて `履歴取込` を押す  
5. `ダッシュボード` と `インタラクション` で反映確認

停止するときは、ターミナルで `Ctrl + C`。

## CLIを打たずに起動（Windows）

`001_開発/start-dev.bat` をダブルクリックすると、以下を自動実行します。

1. `.env` の存在確認（なければ `.env.example` から作成）
2. `node_modules` がなければ `npm install`
3. `npx prisma migrate deploy`
4. `npm run dev`

そのままブラウザで `http://localhost:3000` を開けば利用できます。

## X API認証について

- 現在実装している機能（`/api/x/user/*`, `/api/x/history/*`, `/api/x/me`）は **Bearer Token だけで利用可能**
- これは「公開データの取得（read-only）」のみを扱っているため
- 将来、投稿・フォロー・いいね実行など「ユーザー操作」をAPIで行う場合は OAuth 2.0 User Context が必要

## よく使うコマンド

| コマンド | 内容 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド（prisma generate 含む） |
| `npm run db:migrate` | DBマイグレーション実行 |
| `npm run db:studio` | Prisma Studio 起動 |

---

## ディレクトリ構成

```
001_開発/
  ├── prisma/
  │   └── schema.prisma        # DBスキーマ
  ├── src/
  │   ├── app/
  │   │   ├── page.tsx         # ダッシュボード
  │   │   ├── targets/         # ターゲット管理
  │   │   ├── follow-audit/    # 片思いフォロー棚卸し
  │   │   ├── interactions/    # インタラクション記録
  │   │   ├── activity/        # 行動量ログ
  │   │   └── api/             # APIルート
  │   ├── components/
  │   │   └── Navigation.tsx   # サイドバーナビ
  │   └── lib/db.ts            # Prisma Client
  └── .env                     # 環境変数（.gitignore対象）
```

## フォルダ運用ルール

- 開発作業は `001_開発` 配下で行う
- デプロイ対象は `999_プロトタイプ` 配下に配置する
- 開発 → 動作確認 → プロトタイプへ反映 → デプロイ
