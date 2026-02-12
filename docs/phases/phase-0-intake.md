# Phase 0: Intake

## ゴール
名刺CSVを会社レコードに正規化し、重複排除した状態でキュー投入する。

## 入力
- Wantedly People CSV

## 出力
- `company-record`（初期状態）
- `analysis_queue` ジョブ

## DoD
1. 会社名と連絡先を正規化済み
2. 重複判定（会社名 + ドメイン + 電話）実施
3. 状態が `resolved_pending` に遷移

