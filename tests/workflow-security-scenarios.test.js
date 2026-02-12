const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("node:vm");

const readWorkflow = (fileName) => {
  const fullPath = path.join(__dirname, "..", "n8n", fileName);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
};

const toNodeContext = (context) =>
  Object.fromEntries(Object.entries(context).map(([name, json]) => [name, { json }]));

const runCodeNode = ({ workflow, nodeName, input = {}, env = {}, nodeContext = {} }) => {
  const node = workflow.nodes.find((item) => item.name === nodeName);
  assert(node, `node not found: ${nodeName}`);
  const jsCode = node.parameters?.jsCode;
  assert.equal(typeof jsCode, "string", `${nodeName} has no jsCode`);

  const sandbox = {
    require,
    Buffer,
    Date,
    $json: input,
    $env: env,
    $node: toNodeContext(nodeContext)
  };

  return vm.runInNewContext(`(function(){${jsCode}\n})()`, sandbox, { timeout: 1000 });
};

test("Verify Stripe Signature accepts valid signature and rejects tampered signature", () => {
  const workflow = readWorkflow("stripe-webhook-workflow.json");
  const secret = "whsec_test_secret";
  const rawBody = JSON.stringify({
    id: "evt_123",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_123",
        payment_status: "paid",
        metadata: { company_id: "company-1" }
      }
    }
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const validSig = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  const success = runCodeNode({
    workflow,
    nodeName: "Verify Stripe Signature",
    input: {
      headers: { "stripe-signature": `t=${timestamp},v1=${validSig}` },
      rawBody,
      body: JSON.parse(rawBody)
    },
    env: {
      STRIPE_WEBHOOK_SECRET: secret,
      STRIPE_WEBHOOK_TOLERANCE_SECONDS: "300"
    }
  });
  assert.equal(success[0].json.stripe_signature_verified, true);

  assert.throws(() => {
    runCodeNode({
      workflow,
      nodeName: "Verify Stripe Signature",
      input: {
        headers: { "stripe-signature": `t=${timestamp},v1=${"0".repeat(64)}` },
        rawBody,
        body: JSON.parse(rawBody)
      },
      env: {
        STRIPE_WEBHOOK_SECRET: secret,
        STRIPE_WEBHOOK_TOLERANCE_SECONDS: "300"
      }
    });
  }, /signature verification failed|outside tolerance|Invalid/);
});

test("Verify Stripe Signature rejects livemode mismatch when expectation is set", () => {
  const workflow = readWorkflow("stripe-webhook-workflow.json");
  const secret = "whsec_test_secret";
  const rawBody = JSON.stringify({
    id: "evt_live_mismatch",
    livemode: false,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_123",
        payment_status: "paid",
        metadata: { company_id: "company-1" }
      }
    }
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const validSig = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");

  assert.throws(() => {
    runCodeNode({
      workflow,
      nodeName: "Verify Stripe Signature",
      input: {
        headers: { "stripe-signature": `t=${timestamp},v1=${validSig}` },
        rawBody,
        body: JSON.parse(rawBody)
      },
      env: {
        STRIPE_WEBHOOK_SECRET: secret,
        STRIPE_WEBHOOK_TOLERANCE_SECONDS: "300",
        STRIPE_EXPECT_LIVEMODE: "true"
      }
    });
  }, /livemode mismatch/);
});

test("Normalize Stripe Event does not treat checkout status only as paid", () => {
  const workflow = readWorkflow("stripe-webhook-workflow.json");
  const result = runCodeNode({
    workflow,
    nodeName: "Normalize Stripe Event",
    input: {
      verified_event: {
        id: "evt_unpaid_complete",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_unpaid",
            status: "complete",
            payment_status: "unpaid",
            metadata: { company_id: "company-2" }
          }
        }
      }
    }
  });
  assert.equal(result[0].json.paid_trigger, false);
});

test("Merge Event Context requires explicit idempotency new/duplicate indicators", () => {
  const workflow = readWorkflow("stripe-webhook-workflow.json");

  assert.throws(() => {
    runCodeNode({
      workflow,
      nodeName: "Merge Event Context",
      input: {},
      nodeContext: {
        "Resolve Company Context": {
          company_id: "company-3",
          event_id: "evt_missing_indicator"
        },
        "Normalize Stripe Event": {
          event_id: "evt_missing_indicator"
        }
      }
    });
  }, /idempotency claim response must include/);

  const accepted = runCodeNode({
    workflow,
    nodeName: "Merge Event Context",
    input: { accepted: true },
    nodeContext: {
      "Resolve Company Context": {
        company_id: "company-3",
        event_id: "evt_ok"
      },
      "Normalize Stripe Event": {
        event_id: "evt_ok"
      }
    }
  });
  assert.equal(accepted[0].json.event_new, true);

  assert.throws(() => {
    runCodeNode({
      workflow,
      nodeName: "Merge Event Context",
      input: { accepted: true, duplicate: true },
      nodeContext: {
        "Resolve Company Context": {
          company_id: "company-3",
          event_id: "evt_conflict"
        },
        "Normalize Stripe Event": {
          event_id: "evt_conflict"
        }
      }
    });
  }, /contradictory/);
});

test("Parse R4 Decision requires approver_id", () => {
  const workflow = readWorkflow("build-worker-workflow.json");
  const deadline = new Date(Date.now() + 60_000).toISOString();

  const missingApprover = runCodeNode({
    workflow,
    nodeName: "Parse R4 Decision",
    input: {
      body: {
        decision: "approved",
        approval_token: "token-1",
        approver_role: "sales_lead"
      },
      r4_approval_token: "token-1",
      r4_required_role: "sales_lead",
      r4_deadline_at: deadline
    }
  });
  assert.equal(missingApprover[0].json.approval, "hold");
  assert.equal(missingApprover[0].json.approval_validation.actor_ok, false);

  const validApprover = runCodeNode({
    workflow,
    nodeName: "Parse R4 Decision",
    input: {
      body: {
        decision: "approved",
        approval_token: "token-1",
        approver_role: "sales_lead",
        approver_id: "user-42"
      },
      r4_approval_token: "token-1",
      r4_required_role: "sales_lead",
      r4_deadline_at: deadline
    }
  });
  assert.equal(validApprover[0].json.approval, "approved");
});

test("Unauthorized internal triggers are ignored without manual review side effects", () => {
  const analysisWorkflow = readWorkflow("analysis-worker-workflow.json");
  const buildWorkflow = readWorkflow("build-worker-workflow.json");

  const analysisIgnore = runCodeNode({
    workflow: analysisWorkflow,
    nodeName: "Ignore Unauthorized Analysis Trigger",
    input: {
      company_id: "company-x",
      internal_token_valid: false
    }
  });
  assert.equal(analysisIgnore[0].json.ignored, true);
  assert.equal(analysisIgnore[0].json.reason, "unauthorized_internal_trigger");

  const buildIgnore = runCodeNode({
    workflow: buildWorkflow,
    nodeName: "Ignore Unauthorized Build Trigger",
    input: {
      company_id: "company-y",
      internal_token_valid: false
    }
  });
  assert.equal(buildIgnore[0].json.ignored, true);
  assert.equal(buildIgnore[0].json.reason, "unauthorized_internal_trigger");
});

test("Normalize internal trigger payload fails fast when INTERNAL_WORKFLOW_TOKEN is missing", () => {
  const analysisWorkflow = readWorkflow("analysis-worker-workflow.json");
  const buildWorkflow = readWorkflow("build-worker-workflow.json");

  assert.throws(() => {
    runCodeNode({
      workflow: analysisWorkflow,
      nodeName: "Normalize Paid Payload",
      input: {
        body: { company_id: "company-z", paid_trigger: true },
        headers: { "x-internal-workflow-token": "token-a" }
      },
      env: {}
    });
  }, /INTERNAL_WORKFLOW_TOKEN is required/);

  assert.throws(() => {
    runCodeNode({
      workflow: buildWorkflow,
      nodeName: "Normalize Final Build Payload",
      input: {
        body: { company_id: "company-z", content_lock_ready: true },
        headers: { "x-internal-workflow-token": "token-a" }
      },
      env: {}
    });
  }, /INTERNAL_WORKFLOW_TOKEN is required/);
});
