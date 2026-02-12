#!/usr/bin/env node

const fs = require("fs");

const main = () => {
  try {
    const raw = fs.readFileSync(0, "utf8");
    const payload = raw ? JSON.parse(raw) : {};
    const url = payload.url || "";
    if (!url) {
      throw new Error("url is required");
    }
    const result = {
      url,
      status: "stubbed",
      pages: [
        "/",
        "/company",
        "/service",
        "/contact"
      ]
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    fs.writeSync(process.stderr.fd, `crawl failed: ${error.message}\n`);
    process.exit(1);
  }
};

main();
