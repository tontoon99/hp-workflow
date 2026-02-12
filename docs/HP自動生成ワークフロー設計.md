# HP自動生成ワークフロー設計

## 目的
交流会で得た名刺情報から、企業ごとに「刺さる3案」を短時間で提示する。
ただし、以下4点は非交渉で守る。

1. HP特定の誤爆を防ぐ
2. 情報量固定を守る
3. 品質スコアを担保する
4. 送信時の法務・印象リスクを下げる

## 全体フロー
1. 名刺CSV取込（Wantedly People）
2. HP特定（確信度付き）
3. 現状PSI/Lighthouse取得
4. 固定コンテンツJSON生成
5. Variant A/B/C生成
6. 品質ゲートで自動修正
7. 比較ページ作成とURL発行
8. 送信制御（拒否導線つき）

## Track設計

- `Track A`: HPあり（確信度高）をフルフロー処理
- `Track B`: HP候補あり（確信度低）は保留キュー
- `Track C`: HPなしは1ページ版と不足情報提示

## 非同期設計
重い解析を待たずに全体を進めるため、n8nを4本に分離する。

1. `ingest-workflow`: CSV受信とレコード作成
2. `stripe-webhook-workflow`: 決済Webhook受信と有料開始判定
3. `analysis-worker-workflow`: HP特定・クロール・PSI/Lighthouse
4. `build-worker-workflow`: テンプレ流し込み・品質ゲート・URL発行

## レビューゲート（必須）
各フェーズで機械判定だけにせず、人のレビューを挟む。

1. `R1: HP特定レビュー`
- 対象: Phase 1完了後
- 担当: オペレーター
- 観点: 同名企業誤爆、住所/電話整合、法人種別
- 結果: `approved` or `manual_fix`

2. `R2: Content Lockレビュー`
- 対象: Phase 3完了後
- 担当: ディレクター
- 観点: 本文の欠落、勝手な主張追加、法務上のNG文言
- 結果: `approved` or `re-extract`

3. `R3: 提案品質レビュー`
- 対象: Phase 5完了後
- 担当: 制作責任者
- 観点: Lighthouse閾値、可読性、CTA導線
- 結果: `approved` or `rebuild`

4. `R4: 送信レビュー`
- 対象: Phase 7送信前
- 担当: 営業責任者
- 観点: 宛先、文面、停止導線、送信対象条件
- 結果: `approved` or `hold`

## 課金フロー（推奨）
分析コストを回収するため、課金をワークフローに入れる。

1. `無料`: 名刺取込 + HP特定 + ラフ比較ページ（3案）
2. `有料`: 支払い後に詳細分析 + 最終3案URL + 比較ページ更新
3. Stripe決済成功をトリガーに、詳細分析と最終ビルドへ投入

課金イベント:
- `checkout.session.completed` -> detailed analysis enqueue
- `payment_failed` -> ステータスを `hold` に遷移
- `refund.created` -> 提案公開を停止

## 成果物
1社あたり下記を保存する。

- `company-record.json`: 企業単位の状態
- `content-inventory.json`: 情報量固定の正本
- `quality-report.json`: 品質監査結果
- `proposal-bundle.json`: 3案比較と公開URL

## 完了条件
以下を満たした会社のみ提案送信対象とする。

1. HP特定確信度 `>= 0.85`
2. `content lock` 検査で差分ゼロ
3. Lighthouseゲート（最低ライン）合格
4. 停止導線つき送信テンプレート適用
