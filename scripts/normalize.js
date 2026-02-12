#!/usr/bin/env node

const fs = require("fs");

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
};

const normalizeText = (value) => value.trim().replace(/\s+/g, " ");

const main = async () => {
  try {
    const raw = await readStdin();
    if (!raw) {
      process.stdout.write("{\"records\":[]}\n");
      return;
    }
    const payload = JSON.parse(raw);
    const records = Array.isArray(payload.records) ? payload.records : [];
    const normalized = records.map((record) => ({
      ...record,
      company_name: normalizeText(record.company_name || ""),
      email: (record.email || "").trim().toLowerCase()
    }));
    process.stdout.write(`${JSON.stringify({ records: normalized }, null, 2)}\n`);
  } catch (error) {
    fs.writeSync(process.stderr.fd, `normalize failed: ${error.message}\n`);
    process.exit(1);
  }
};

main();
