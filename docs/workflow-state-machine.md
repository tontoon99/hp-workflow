# Workflow State Machine

## 会社レコードの状態

1. `new`
2. `resolved_pending`
3. `resolved_confirmed`
4. `analysis_running`
5. `analysis_ready`
6. `content_locked`
7. `build_running`
8. `quality_failed`
9. `quality_passed`
10. `proposal_ready`
11. `sent`
12. `manual_review_required`

## 主な遷移

- `new -> resolved_pending`:
  名刺CSVを取り込み、候補URLを抽出
- `resolved_pending -> resolved_confirmed`:
  確信度閾値を満たした
- `resolved_pending -> manual_review_required`:
  閾値未達、または競合候補が複数
- `resolved_confirmed -> analysis_running`:
  analysis queue投入
- `analysis_running -> analysis_ready`:
  PSI/Lighthouse収集完了
- `analysis_ready -> content_locked`:
  固定コンテンツJSON生成とhash固定
- `content_locked -> build_running`:
  variant A/B/Cビルド開始
- `build_running -> quality_failed`:
  QAゲート不合格
- `quality_failed -> build_running`:
  自動修正後の再ビルド
- `build_running -> quality_passed`:
  QAゲート合格
- `quality_passed -> proposal_ready`:
  比較ページ生成完了
- `proposal_ready -> sent`:
  送信キューで配信完了

