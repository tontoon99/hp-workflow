#!/usr/bin/env node

const fs = require("fs");

const thresholds = {
  performance: 65,
  accessibility: 85,
  best_practices: 80,
  seo: 85
};

const isScorePass = (scores) =>
  Object.entries(thresholds).every(([key, min]) => (scores[key] || 0) >= min);

const main = () => {
  try {
    const raw = fs.readFileSync(0, "utf8");
    const payload = raw ? JSON.parse(raw) : {};
    const scores = payload.scores || {};
    const gates = payload.gates || {};
    const gatePass = Boolean(gates.content_lock_ok && gates.links_ok && gates.heading_structure_ok);
    const passed = isScorePass(scores) && gatePass;
    const result = {
      ...payload,
      passed,
      evaluated_at: new Date().toISOString()
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    fs.writeSync(process.stderr.fd, `quality-gate failed: ${error.message}\n`);
    process.exit(1);
  }
};

main();
