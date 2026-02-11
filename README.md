# HP Workflow - 自動HP改善提案システム

交流会で取得した名刺情報から、企業HPを自動分析し、情報量を維持したまま2-3案の改善デザインを提案するワークフロー。

## 🎯 コンセプト

**「情報量は変えず、構成・デザインを変えて改善案を提案」**

- 既存HP → コンテンツ棚卸し → 2-3案の新デザイン生成
- HPなし企業 → 最小限の1ページHP生成 ＋ 不足情報の指摘

## 🏗 アーキテクチャ

```
[名刺] → Wantedly People → CSV
  ↓
[n8n Workflow]
  ├─ Track A: HP あり企業
  │   ├─ HP特定・検証
  │   ├─ PSI/Lighthouse解析
  │   ├─ コンテンツ棚卸し（JSON化）
  │   └─ Variant A/B/C 生成
  │
  └─ Track B: HP なし企業
      ├─ 名刺情報から基礎情報構築
      └─ ミニマルHP生成
```

## 📁 ディレクトリ構成

```
hp-workflow/
├── README.md              # このファイル
├── docs/
│   ├── architecture.md    # 詳細設計書
│   └── design-variants.md # A/B/Cバリアント設計
├── schemas/
│   └── content-inventory.schema.json # 固定コンテンツスキーマ
├── n8n/
│   └── hp-workflow.json   # n8nワークフロー定義
├── scripts/
│   ├── normalize.js       # 会社名正規化
│   ├── resolve-website.js # HP特定スコアリング
│   ├── crawl.js          # Playwright解析
│   ├── psi-analyze.js    # PageSpeed Insights
│   ├── quality-gate.js   # 品質ゲート
│   └── lighthouse-run.sh # Lighthouse実行
└── templates/
    ├── variant-a/        # コーポレート信頼型
    ├── variant-b/        # サービス訴求型
    └── variant-c/        # 採用・共感型
```

## 🚀 Quick Start

### 1. 環境準備

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# PSI_API_KEY, AZURE_ENDPOINT 等を設定
```

### 2. n8nワークフローインポート

n8n管理画面から `n8n/hp-workflow.json` をインポート

### 3. テスト実行

```bash
# サンプルCSVで動作確認
npm run test:workflow
```

## 🔧 技術スタック

- **オーケストレーション**: n8n
- **HP解析**: Playwright, Lighthouse, PageSpeed Insights API
- **LLM**: Claude (Anthropic) / Azure OpenAI
- **フロントエンド生成**: Astro + Tailwind CSS
- **品質検証**: 自動QAスクリプト群

## 📊 Variant設計

| Variant | ターゲット | 推奨業種 | 特徴 |
|---------|-----------|----------|------|
| A: コーポレート信頼型 | 大企業・官公庁 | 建設・製造・士業 | 保守的、階層明確、アクセシビリティ重視 |
| B: サービス訴求型 | 中小企業 | IT・コンサル・サービス業 | CTA複線化、価値訴求、モバイルファースト |
| C: 採用・共感型 | スタートアップ | 飲食・人材・クリエイティブ | ストーリー重視、ビジュアル訴求、温かみ |

## 🔒 セキュリティ配慮

- Execute Commandノード無効化（n8n v2.0推奨設定）
- Lighthouse実行は別コンテナ/サービス化
- 固定コンテンツJSONのハッシュ検証
- 個人情報は処理後即削除

## 📝 ライセンス

MIT

## 🤝 コントリビュート

Issues, PR歓迎です。