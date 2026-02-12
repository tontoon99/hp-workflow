# Phase 1: Website Resolution

## ゴール
会社HPを確信度付きで1件に確定する。

## 優先ルール
1. 名刺記載URL
2. メールドメイン
3. 住所・電話の一致
4. 外部検索（最終手段）

## 出力
- `official_website`
- `resolution_confidence`
- `resolution_evidence[]`

## DoD
1. 確信度 `>= 0.85` は自動確定
2. 0.85未満は `manual_review_required`
3. 監査用に証拠URLを保存

