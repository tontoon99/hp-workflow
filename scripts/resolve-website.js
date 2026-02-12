#!/usr/bin/env node

const fs = require("fs");

const scoreCandidate = (candidate, cardDomain) => {
  if (!candidate || !candidate.url) {
    return 0;
  }
  let score = 0.2;
  if (cardDomain && candidate.url.includes(cardDomain)) {
    score += 0.5;
  }
  if (candidate.source === "business_card_url") {
    score += 0.3;
  }
  return Math.min(score, 1);
};

const main = () => {
  try {
    const input = fs.readFileSync(0, "utf8");
    const payload = input ? JSON.parse(input) : {};
    const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
    const cardDomain = payload.card_domain || "";
    const scored = candidates
      .map((candidate) => ({ ...candidate, confidence: scoreCandidate(candidate, cardDomain) }))
      .sort((left, right) => right.confidence - left.confidence);
    const best = scored[0] || null;
    process.stdout.write(`${JSON.stringify({ best, scored }, null, 2)}\n`);
  } catch (error) {
    fs.writeSync(process.stderr.fd, `resolve-website failed: ${error.message}\n`);
    process.exit(1);
  }
};

main();
