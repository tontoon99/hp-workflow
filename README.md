# HP Workflow v2

名刺情報から企業HPを特定し、情報量を固定したまま3案の改善提案URLを出すための設計・実装リポジトリです。

## コンセプト
`名刺1枚 -> 3 URL` を最短で実現しつつ、以下を必須にします。

- HP特定の誤爆防止
- 情報量固定（content lock）
- Lighthouse/PSIの品質ゲート
- 送信時のコンプラ・印象事故の回避

## フェーズ構成
Phase 0からPhase 7まで分離し、分析が重い間も他工程を並行で進めます。

1. Intake（名刺CSV取込・重複排除）
2. Website Resolution（HP特定）
3. Baseline Analysis（PSI/Lighthouse現状取得）
4. Content Lock（固定コンテンツJSON化）
5. Variant Generation（A/B/C生成）
6. Quality Gate（自動修正リビルド）
7. Proposal Delivery（比較ページ・URL発行）
8. Outreach（送信制御・停止導線）

詳細は `docs/HP自動生成ワークフロー設計.md` を参照してください。

## ディレクトリ構成

```txt
hp-workflow/
├── README.md
├── docs/
│   ├── HP自動生成ワークフロー設計.md
│   ├── architecture.md
│   ├── 運用フロー_名刺撮影から課金まで.md
│   ├── 実装前レビュー_2026-02-11.md
│   ├── plan-review.md
│   ├── workflow-state-machine.md
│   ├── n8n-node-map.md
│   ├── claude-project-setup.md
│   └── phases/
├── schemas/
│   ├── company-record.schema.json
│   ├── content-inventory.schema.json
│   ├── design-token.schema.json
│   ├── quality-report.schema.json
│   └── proposal-bundle.schema.json
├── n8n/
│   ├── ingest-workflow.json
│   ├── stripe-webhook-workflow.json
│   ├── analysis-worker-workflow.json
│   └── build-worker-workflow.json
├── scripts/
│   ├── normalize.js
│   ├── resolve-website.js
│   ├── crawl.js
│   ├── psi-analyze.js
│   ├── quality-gate.js
│   ├── lighthouse-run.sh
│   ├── validate-schemas.js
│   └── test-workflow.js
├── templates/
│   ├── variant-a/
│   ├── variant-b/
│   └── variant-c/
├── tests/
│   └── schema.test.js
└── .claude/
    ├── commands/
    └── skills/
```

## Quick Start

```bash
npm install
npm run validate:schemas
npm test
```

## 開発の進め方

1. `docs/phases/` のPhaseごとに実装を切る。
2. 各Phaseの入出力を `schemas/` で固定する。
3. n8nは `n8n/` の4ワークフローをベースに分離運用する。
4. Claudeプロジェクト設定は `docs/claude-project-setup.md` に従う。

## ライセンス
MIT
