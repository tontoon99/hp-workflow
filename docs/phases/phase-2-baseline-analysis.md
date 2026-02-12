# Phase 2: Baseline Analysis

## ゴール
既存HPの現状品質を定量化する。

## 実行項目
1. PSI mobile
2. PSI desktop
3. Lighthouse監査
4. DOMスナップショット保存

## 出力
- baseline PSI/Lighthouse JSON
- 抽出済みページテキスト

## DoD
1. 監査結果が保存される
2. エラー時はリトライ後に `manual_review_required`
3. `analysis_ready` へ状態遷移

