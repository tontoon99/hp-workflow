# Architecture

## コンポーネント

1. `n8n`
- イベント駆動オーケストレーション
- リトライ、レート制御、状態遷移

2. `analysis service`（Node/Python）
- HP特定スコアリング
- クロール
- PSI/Lighthouse実行

3. `generation service`（Node）
- 固定コンテンツJSON + デザイントークンで3案生成
- テンプレート適用とビルド

4. `qa service`
- テキスト差分（hash）検査
- リンク検査、見出し構造検査
- Lighthouse再実行と自動修正ループ

5. `proposal service`
- 比較ページ生成
- プレビューURL発行
- 送信対象の制御

## データ契約

- `schemas/company-record.schema.json`
- `schemas/content-inventory.schema.json`
- `schemas/design-token.schema.json`
- `schemas/quality-report.schema.json`
- `schemas/proposal-bundle.schema.json`

## キュー分離

- `analysis_queue`: クロール・PSIなど重処理
- `build_queue`: HTML生成・品質ゲート
- `delivery_queue`: 提案まとめ生成・送信処理

## 失敗時の方針

1. リトライ回数上限を超えたら `manual_review_required` へ遷移
2. HP特定確信度が低い場合は自動送信対象から除外
3. content lock違反時は提案生成を停止

