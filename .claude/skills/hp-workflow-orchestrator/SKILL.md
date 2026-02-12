---
name: hp-workflow-orchestrator
description: Use this skill when implementing or updating the business-card-to-3URL pipeline, including phase decisions, schema contracts, n8n orchestration, and quality gates.
---

# HP Workflow Orchestrator

## Scope
このスキルは、以下の作業で使う。

1. フェーズ単位の実装計画
2. スキーマ契約の追加/変更
3. n8n ingest/analysis/build分離の更新
4. content lockと品質ゲートの整合確認

## Required References

- `references/phase-checklists.md`
- `docs/phases/README.md`
- `docs/workflow-state-machine.md`

## Operating Rules

1. まず現在フェーズを1つだけ選ぶ
2. 変更対象の入出力スキーマを先に固定する
3. 実装後は `npm run validate:schemas` と `npm test` を実行する
4. quality gateがfailなら次工程へ進めない

