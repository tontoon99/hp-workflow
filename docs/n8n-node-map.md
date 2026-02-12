# n8n Node Map

## ingest-workflow

1. `Webhook Intake CSV` (POST `/webhook/hp-intake-csv`)
2. `Code: Parse CSV Payload`（CSV正規化、company-record準拠へ整形）
3. `HTTP Request: Upsert Company Record`
4. `HTTP Request: Create Checkout Session`（比較ページから遷移する決済導線）
5. `HTTP Request: Create Free Comparison Page`（決済前ラフ3案）
6. `HTTP Request: Send Preview URL`
7. `HTTP Request: Update Status Awaiting Payment`

決済前の終端:
- 無料比較ページ送付まで
- 有料分析キュー投入なし

## analysis-worker-workflow

1. `Webhook Paid Analysis Start`（Stripeワークフローからのみ受ける）
2. `Code: Normalize Paid Payload`（`x-internal-workflow-token` 検証）
3. `IF: If Internal Token Valid?`（不正トークンは `Ignore Unauthorized Analysis Trigger` で終端）
4. `IF: If Paid Trigger Valid?`（`paid_trigger=true` 必須）
5. `HTTP Request: Check Analysis Idempotency` -> `IF: If Analysis Event New?`
6. `HTTP Request: Update Status Analysis Running`
7. `HTTP Request: Resolve Website`
8. `IF: If Website Confidence Pass?`（`>=0.85`）
9. `Code: Issue R1 Approval Challenge` -> `Wait R1 Approval` -> `Parse/IF`（トークン/期限/ロール/承認者ID検証）
10. `HTTP Request: Log R1 Approval Decision`（監査ログ）
11. `HTTP Request: Crawl Site`
12. `HTTP Request: PSI Mobile`（`url/strategy=mobile/category` 実装）
13. `HTTP Request: PSI Desktop`（`url/strategy=desktop/category` 実装）
14. `HTTP Request: Lighthouse Audit`
15. `Code: Build Content Inventory`（`r2_reextract_attempt` を保持）
16. `HTTP Request: Check Content Lock`
17. `IF: If Content Lock OK?`（違反時 `Stop Publication` + `Mark Content Lock Violation`）
18. `Code: Issue R2 Approval Challenge` -> `Wait R2 Approval` -> `Parse/IF`（トークン/期限/ロール/承認者ID検証）
19. `HTTP Request: Log R2 Approval Decision`（監査ログ）
20. `IF: If R2 Retry Remaining?`（上限3） -> `Log R2 Reextract Requested` -> `Re-extract`
21. `HTTP Request: Save Content Lock`
22. `HTTP Request: Trigger Final Build Workflow`（内部トークンヘッダー付与）

安全制御:
- 決済トリガー不正/内部トークン不正時は `manual_review_required`
- webhook重複は idempotency claim で無害化
- 低信頼HPは R1へ
- content lock違反は公開停止
- R2差し戻しは3回で打ち切り、`manual_review_required`
- `INTERNAL_WORKFLOW_TOKEN` 未設定は fail-fast で停止（誤設定時の黙殺防止）

## build-worker-workflow

1. `Webhook Final Build Start`
2. `Code: Normalize Final Build Payload`（`content_lock_ready` + 内部トークン検証）
3. `IF: If Internal Token Valid?`（不正トークンは `Ignore Unauthorized Build Trigger` で終端）
4. `IF: If Build Trigger Valid?`（`content_lock_ready=true` 必須）
5. `HTTP Request: Load Content Inventory`
6. `Code: Initialize Build Attempt`
7. `HTTP Request: Update Status Build Running`
8. `HTTP Request: Build Final Variants`
9. `HTTP Request: Quality Gate`
10. `IF: If Quality Passed?`
11. `IF: If Retry Remaining?` -> `Code: Increment Build Attempt` -> `HTTP Request: Log Build Retry` -> `HTTP Request: Rebuild Variants`
12. `Code: Issue R3 Approval Challenge` -> `Wait R3 Approval` -> `Parse/IF`（トークン/期限/ロール/承認者ID検証）
13. `HTTP Request: Log R3 Approval Decision`（監査ログ）
14. `HTTP Request: Create Proposal Bundle`
15. `Code: Issue R4 Approval Challenge` -> `Wait R4 Approval` -> `Parse/IF`（トークン/期限/ロール/承認者ID検証）
16. `HTTP Request: Log R4 Approval Decision`（監査ログ）
17. `HTTP Request: Check Payment State Before Delivery` -> `IF: If Payment State Paid?`
18. `HTTP Request: Send Proposal Delivery`
19. `HTTP Request: Mark Sent`

安全制御:
- 品質NGは再生成へ戻し、上限超過で `quality_failed`
- R3/R4未承認は送信しない
- 承認URLの再開要求は approval token / role / approver_id / deadline で検証
- 送信直前に payment state を再確認し、`paid` 以外は送信停止
- `INTERNAL_WORKFLOW_TOKEN` 未設定は fail-fast で停止（誤設定時の黙殺防止）

## stripe-webhook-workflow

1. `Stripe Webhook`（POST `/webhook/hp-stripe-events`）
2. `Code: Verify Stripe Signature`（raw body + `Stripe-Signature` + timestamp tolerance）
3. `Code: Normalize Stripe Event`
4. `HTTP Request: Resolve Company Context`（event/charge/refund/payment_intent から company_id 補完）
5. `HTTP Request: Check Event Idempotency` -> `IF: If Event New?`
6. `IF: If Checkout Completed & Paid?`
7. `IF: If Company Context Present?`
8. `HTTP Request: Mark Paid Status`
9. `HTTP Request: Trigger Detailed Analysis Workflow`（`/webhook/hp-paid-analysis` + 内部トークンヘッダー）
10. `IF: If Payment Failed Event?` -> `IF: If Company Context Present (Payment Failed)?` -> `Mark Payment Hold`
11. `IF: If Refund Event?` -> `IF: If Company Context Present (Refund)?` -> `Stop Published Proposal` -> `Mark Refund Hold`

有料開始条件:
- `checkout.session.completed` かつ `payment_status=paid` のみ

安全制御:
- `STRIPE_EXPECT_LIVEMODE` 指定時は livemode mismatch を拒否
- idempotency claim 応答の矛盾（new/duplicate同時）を fail-closed
