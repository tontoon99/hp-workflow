#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "docs/HP自動生成ワークフロー設計.md",
  "docs/architecture.md",
  "docs/workflow-state-machine.md",
  "n8n/ingest-workflow.json",
  "n8n/stripe-webhook-workflow.json",
  "n8n/analysis-worker-workflow.json",
  "n8n/build-worker-workflow.json",
  "schemas/content-inventory.schema.json"
];

const readJson = (repoRoot, filePath) => {
  const fullPath = path.join(repoRoot, filePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
};

const findNode = (workflow, name) => workflow.nodes.find((node) => node.name === name);

const findConnectionTargets = (workflow, sourceName, outputIndex = 0) => {
  const source = workflow.connections[sourceName];
  if (!source || !Array.isArray(source.main) || !Array.isArray(source.main[outputIndex])) {
    return [];
  }
  return source.main[outputIndex].map((item) => item.node);
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertWorkflowShape = (workflow, workflowName) => {
  assert(typeof workflow.name === "string" && workflow.name.length > 0, `${workflowName}: name is required`);
  assert(Array.isArray(workflow.nodes) && workflow.nodes.length > 0, `${workflowName}: nodes are required`);
  assert(
    workflow.connections && typeof workflow.connections === "object",
    `${workflowName}: connections are required`
  );
};

const assertNoPaidPathInIngest = (workflow) => {
  const urls = workflow.nodes
    .filter((node) => node.type === "n8n-nodes-base.httpRequest")
    .map((node) => node.parameters?.url || "");
  const hasPaidQueue = urls.some(
    (url) =>
      /analysis/i.test(url) &&
      !/create-free-comparison|send-preview|checkout-session/i.test(url)
  );
  assert(!hasPaidQueue, "ingest workflow must not include paid analysis path");
};

const assertStripeGate = (workflow) => {
  const verifyNode = findNode(workflow, "Verify Stripe Signature");
  assert(verifyNode, "stripe workflow missing Verify Stripe Signature");
  const verifyCode = verifyNode.parameters?.jsCode || "";
  assert(
    verifyCode.includes("stripe-signature") && verifyCode.includes("STRIPE_WEBHOOK_SECRET"),
    "stripe workflow must verify Stripe signature with endpoint secret"
  );
  assert(
    verifyCode.includes("rawBody") && verifyCode.includes("tolerance"),
    "stripe workflow must verify raw body and timestamp tolerance"
  );
  assert(
    verifyCode.includes("STRIPE_EXPECT_LIVEMODE") && verifyCode.includes("livemode mismatch"),
    "stripe workflow must support livemode expectation guard"
  );

  const eventNewGate = findNode(workflow, "If Event New?");
  const contextResolver = findNode(workflow, "Resolve Company Context");
  const idempotencyNode = findNode(workflow, "Check Event Idempotency");
  assert(eventNewGate, "stripe workflow missing If Event New?");
  assert(contextResolver, "stripe workflow missing Resolve Company Context");
  assert(idempotencyNode, "stripe workflow missing Check Event Idempotency");
  const duplicateTargets = findConnectionTargets(workflow, "If Event New?", 1);
  assert(
    duplicateTargets.includes("Ignore Duplicate Event"),
    "stripe workflow duplicate branch must end at Ignore Duplicate Event"
  );

  const gate = findNode(workflow, "If Checkout Completed & Paid?");
  const trigger = findNode(workflow, "Trigger Detailed Analysis Workflow");
  const failedContextGate = findNode(workflow, "If Company Context Present (Payment Failed)?");
  const refundContextGate = findNode(workflow, "If Company Context Present (Refund)?");
  assert(gate, "stripe workflow missing If Checkout Completed & Paid?");
  assert(trigger, "stripe workflow missing Trigger Detailed Analysis Workflow");
  assert(failedContextGate, "stripe workflow missing If Company Context Present (Payment Failed)?");
  assert(refundContextGate, "stripe workflow missing If Company Context Present (Refund)?");

  const trueTargets = findConnectionTargets(workflow, "If Checkout Completed & Paid?", 0);
  const falseTargets = findConnectionTargets(workflow, "If Checkout Completed & Paid?", 1);
  assert(trueTargets.includes("If Company Context Present?"), "stripe workflow true branch must validate company context");
  assert(
    !falseTargets.includes("Trigger Detailed Analysis Workflow"),
    "stripe workflow false branch must not trigger paid analysis"
  );

  const normalizeNode = findNode(workflow, "Normalize Stripe Event");
  const normalizeCode = normalizeNode?.parameters?.jsCode || "";
  assert(
    normalizeCode.includes("checkout.session.completed") && normalizeCode.includes("paymentStatus === 'paid'"),
    "stripe workflow must explicitly gate by checkout.session.completed"
  );
  assert(
    !normalizeCode.includes("checkoutStatus === 'complete'"),
    "stripe workflow paid trigger must not use checkout status only"
  );
  assert(
    normalizeCode.includes("payment_intent_id") &&
      normalizeCode.includes("charge_id") &&
      normalizeCode.includes("refund_id"),
    "stripe workflow must normalize payment_intent_id/charge_id/refund_id for context recovery"
  );

  const idempotencyInputs = idempotencyNode.parameters?.jsonBody || "";
  assert(
    idempotencyInputs.includes("Resolve Company Context"),
    "stripe workflow idempotency claim must use resolved company context"
  );
  const mergeCode = findNode(workflow, "Merge Event Context")?.parameters?.jsCode || "";
  assert(
    mergeCode.includes("contradictory") && mergeCode.includes("event_id mismatch"),
    "stripe workflow merge must fail closed on contradictory idempotency or event mismatch"
  );

  const triggerHeaders = trigger.parameters?.headerParameters?.parameters || [];
  const headerNames = new Set(triggerHeaders.map((header) => header.name));
  assert(
    headerNames.has("x-internal-workflow-token"),
    "stripe workflow must forward internal workflow token header"
  );

  const paymentFailedTargets = findConnectionTargets(workflow, "If Payment Failed Event?", 0);
  assert(
    paymentFailedTargets.includes("If Company Context Present (Payment Failed)?"),
    "stripe workflow payment_failed path must validate company context"
  );
  const refundTargets = findConnectionTargets(workflow, "If Refund Event?", 0);
  assert(
    refundTargets.includes("If Company Context Present (Refund)?"),
    "stripe workflow refund path must validate company context"
  );
};

const assertAnalysisWorkflow = (workflow) => {
  const normalizeNode = findNode(workflow, "Normalize Paid Payload");
  const normalizeCode = normalizeNode?.parameters?.jsCode || "";
  assert(
    normalizeCode.includes("INTERNAL_WORKFLOW_TOKEN is required"),
    "analysis workflow must fail fast when INTERNAL_WORKFLOW_TOKEN is missing"
  );
  assert(
    normalizeCode.includes("timingSafeEqual"),
    "analysis workflow internal token comparison must use timingSafeEqual"
  );

  const requiredWaitNodes = ["Wait R1 Approval", "Wait R2 Approval"];
  requiredWaitNodes.forEach((name) => {
    const node = findNode(workflow, name);
    assert(node, `analysis workflow missing ${name}`);
    assert(node.type === "n8n-nodes-base.wait", `analysis workflow ${name} must be Wait node`);
  });

  const paidGate = findNode(workflow, "If Paid Trigger Valid?");
  const paidGateExpr = paidGate?.parameters?.conditions?.boolean?.[0]?.value1 || "";
  const tokenGate = findNode(workflow, "If Internal Token Valid?");
  const unauthorizedNode = findNode(workflow, "Ignore Unauthorized Analysis Trigger");
  assert(tokenGate, "analysis workflow missing If Internal Token Valid?");
  assert(unauthorizedNode, "analysis workflow missing Ignore Unauthorized Analysis Trigger");
  const tokenGateExpr = tokenGate?.parameters?.conditions?.boolean?.[0]?.value1 || "";
  assert(
    tokenGateExpr.includes("internal_token_valid"),
    "analysis workflow must require internal trigger token"
  );
  assert(
    !paidGateExpr.includes("internal_token_valid"),
    "analysis paid trigger gate must only validate paid_trigger after token gate"
  );

  const idempotencyNode = findNode(workflow, "Check Analysis Idempotency");
  const eventNewGate = findNode(workflow, "If Analysis Event New?");
  assert(idempotencyNode, "analysis workflow missing Check Analysis Idempotency");
  assert(eventNewGate, "analysis workflow missing If Analysis Event New?");

  const psiMobile = findNode(workflow, "PSI Mobile");
  const psiDesktop = findNode(workflow, "PSI Desktop");
  [psiMobile, psiDesktop].forEach((node, idx) => {
    assert(node, `analysis workflow missing PSI node ${idx + 1}`);
    const params = node.parameters?.queryParameters?.parameters || [];
    const names = new Set(params.map((param) => param.name));
    assert(names.has("url"), `${node.name} must include url query`);
    assert(names.has("strategy"), `${node.name} must include strategy query`);
    assert(names.has("category"), `${node.name} must include category query`);
  });

  const lockGate = findNode(workflow, "If Content Lock OK?");
  assert(lockGate, "analysis workflow missing content lock gate");
  const falseTargets = findConnectionTargets(workflow, "If Content Lock OK?", 1);
  assert(
    falseTargets.includes("Stop Publication (Content Lock Violation)"),
    "analysis workflow must stop publication on content lock violation"
  );
  const violationTargets = findConnectionTargets(workflow, "Stop Publication (Content Lock Violation)", 0);
  assert(
    violationTargets.includes("Mark Content Lock Violation"),
    "analysis workflow must update state after content lock violation"
  );

  const challengeNodes = ["Issue R1 Approval Challenge", "Issue R2 Approval Challenge"];
  challengeNodes.forEach((name) => {
    const node = findNode(workflow, name);
    const code = node?.parameters?.jsCode || "";
    assert(node, `analysis workflow missing ${name}`);
    assert(
      code.includes("approval_token") || code.includes("randomBytes"),
      `${name} must issue signed approval token`
    );
  });

  const parseNodes = ["Parse R1 Decision", "Parse R2 Decision"];
  parseNodes.forEach((name) => {
    const node = findNode(workflow, name);
    const code = node?.parameters?.jsCode || "";
    assert(node, `analysis workflow missing ${name}`);
    assert(
      code.includes("approval_token") &&
        code.includes("approver_role") &&
        code.includes("approver_id") &&
        code.includes("within_deadline"),
      `${name} must validate token, role, approver_id, and deadline`
    );
  });
  const logNodes = ["Log R1 Approval Decision", "Log R2 Approval Decision"];
  logNodes.forEach((name) => {
    const node = findNode(workflow, name);
    assert(node, `analysis workflow missing ${name}`);
  });
  const r1LogTargets = findConnectionTargets(workflow, "Parse R1 Decision", 0);
  assert(r1LogTargets.includes("Log R1 Approval Decision"), "Parse R1 Decision must flow into approval audit log");
  const r2LogTargets = findConnectionTargets(workflow, "Parse R2 Decision", 0);
  assert(r2LogTargets.includes("Log R2 Approval Decision"), "Parse R2 Decision must flow into approval audit log");

  const contentInventoryNode = findNode(workflow, "Build Content Inventory");
  const inventoryCode = contentInventoryNode?.parameters?.jsCode || "";
  assert(
    inventoryCode.includes("r2_reextract_attempt"),
    "analysis workflow must preserve r2_reextract_attempt through re-extract loop"
  );

  const r2Retry = findNode(workflow, "If R2 Retry Remaining?");
  assert(r2Retry, "analysis workflow missing If R2 Retry Remaining?");
  const r2RetryTargets = findConnectionTargets(workflow, "If R2 Retry Remaining?", 1);
  assert(
    r2RetryTargets.includes("Mark R2 Retry Exhausted"),
    "analysis workflow R2 retry exhausted must stop with manual review"
  );
};

const assertBuildWorkflow = (workflow) => {
  const normalizeNode = findNode(workflow, "Normalize Final Build Payload");
  const normalizeCode = normalizeNode?.parameters?.jsCode || "";
  assert(
    normalizeCode.includes("INTERNAL_WORKFLOW_TOKEN is required"),
    "build workflow must fail fast when INTERNAL_WORKFLOW_TOKEN is missing"
  );
  assert(
    normalizeCode.includes("timingSafeEqual"),
    "build workflow internal token comparison must use timingSafeEqual"
  );

  const triggerGate = findNode(workflow, "If Build Trigger Valid?");
  const tokenGate = findNode(workflow, "If Internal Token Valid?");
  const unauthorizedNode = findNode(workflow, "Ignore Unauthorized Build Trigger");
  assert(tokenGate, "build workflow missing If Internal Token Valid?");
  assert(unauthorizedNode, "build workflow missing Ignore Unauthorized Build Trigger");
  const tokenGateExpr = tokenGate.parameters?.conditions?.boolean?.[0]?.value1 || "";
  assert(triggerGate, "build workflow missing If Build Trigger Valid?");
  const triggerExpr = triggerGate.parameters?.conditions?.boolean?.[0]?.value1 || "";
  assert(
    tokenGateExpr.includes("internal_token_valid"),
    "build workflow must require internal token"
  );
  assert(
    triggerExpr.includes("content_lock_ready") && !triggerExpr.includes("internal_token_valid"),
    "build workflow trigger gate must validate content_lock_ready after token gate"
  );

  const requiredWaitNodes = ["Wait R3 Approval", "Wait R4 Approval"];
  requiredWaitNodes.forEach((name) => {
    const node = findNode(workflow, name);
    assert(node, `build workflow missing ${name}`);
    assert(node.type === "n8n-nodes-base.wait", `build workflow ${name} must be Wait node`);
  });

  const qualityGateNode = findNode(workflow, "If Quality Passed?");
  assert(qualityGateNode, "build workflow missing If Quality Passed?");
  const qualityFalseTargets = findConnectionTargets(workflow, "If Quality Passed?", 1);
  assert(
    qualityFalseTargets.includes("If Retry Remaining?"),
    "build workflow quality NG must go to retry gate"
  );

  const publishTargetsFromQuality = qualityFalseTargets.concat(
    findConnectionTargets(workflow, "If Quality Passed?", 0)
  );
  assert(
    !publishTargetsFromQuality.includes("Send Proposal Delivery"),
    "build workflow must not send delivery directly from quality gate"
  );

  const challengeNodes = ["Issue R3 Approval Challenge", "Issue R4 Approval Challenge"];
  challengeNodes.forEach((name) => {
    const node = findNode(workflow, name);
    const code = node?.parameters?.jsCode || "";
    assert(node, `build workflow missing ${name}`);
    assert(
      code.includes("approval_token") || code.includes("randomBytes"),
      `${name} must issue signed approval token`
    );
  });

  const parseNodes = ["Parse R3 Decision", "Parse R4 Decision"];
  parseNodes.forEach((name) => {
    const node = findNode(workflow, name);
    const code = node?.parameters?.jsCode || "";
    assert(node, `build workflow missing ${name}`);
    assert(
      code.includes("approval_token") &&
        code.includes("approver_role") &&
        code.includes("approver_id") &&
        code.includes("within_deadline"),
      `${name} must validate token, role, approver_id, and deadline`
    );
  });
  const logNodes = ["Log R3 Approval Decision", "Log R4 Approval Decision"];
  logNodes.forEach((name) => {
    const node = findNode(workflow, name);
    assert(node, `build workflow missing ${name}`);
  });

  const deliveryGuard = findNode(workflow, "Check Payment State Before Delivery");
  const paidGuard = findNode(workflow, "If Payment State Paid?");
  const holdPaymentNode = findNode(workflow, "Hold Delivery Payment Not Paid");
  assert(deliveryGuard, "build workflow missing Check Payment State Before Delivery");
  assert(paidGuard, "build workflow missing If Payment State Paid?");
  assert(holdPaymentNode, "build workflow missing Hold Delivery Payment Not Paid");
  const r4ApprovedTargets = findConnectionTargets(workflow, "If R4 Approved?", 0);
  assert(
    r4ApprovedTargets.includes("Check Payment State Before Delivery"),
    "build workflow must verify payment state before delivery"
  );
  const paidGuardFalseTargets = findConnectionTargets(workflow, "If Payment State Paid?", 1);
  assert(
    paidGuardFalseTargets.includes("Hold Delivery Payment Not Paid"),
    "build workflow must hold delivery if payment is not paid"
  );

  const retryTargets = findConnectionTargets(workflow, "Increment Build Attempt", 0);
  assert(retryTargets.includes("Log Build Retry"), "build workflow must log retry before rebuild");
};

const main = () => {
  try {
    const repoRoot = path.join(__dirname, "..");
    const missing = requiredFiles.filter((filePath) => {
      const fullPath = path.join(repoRoot, filePath);
      return !fs.existsSync(fullPath);
    });
    if (missing.length > 0) {
      throw new Error(`missing required files: ${missing.join(", ")}`);
    }

    const ingestWorkflow = readJson(repoRoot, "n8n/ingest-workflow.json");
    const stripeWorkflow = readJson(repoRoot, "n8n/stripe-webhook-workflow.json");
    const analysisWorkflow = readJson(repoRoot, "n8n/analysis-worker-workflow.json");
    const buildWorkflow = readJson(repoRoot, "n8n/build-worker-workflow.json");

    assertWorkflowShape(ingestWorkflow, "ingest-workflow");
    assertWorkflowShape(stripeWorkflow, "stripe-webhook-workflow");
    assertWorkflowShape(analysisWorkflow, "analysis-worker-workflow");
    assertWorkflowShape(buildWorkflow, "build-worker-workflow");

    assertNoPaidPathInIngest(ingestWorkflow);
    assertStripeGate(stripeWorkflow);
    assertAnalysisWorkflow(analysisWorkflow);
    assertBuildWorkflow(buildWorkflow);

    process.stdout.write("workflow structure check passed\n");
  } catch (error) {
    fs.writeSync(process.stderr.fd, `test-workflow failed: ${error.message}\n`);
    process.exit(1);
  }
};

main();
