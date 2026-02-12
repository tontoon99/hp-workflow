#!/usr/bin/env node

const fs = require("fs");

const createPsiRequest = (url, strategy) => ({
  endpoint: "https://www.googleapis.com/pagespeedonline/v5/runPagespeed",
  query: {
    url,
    strategy,
    category: [
      "performance",
      "accessibility",
      "best-practices",
      "seo"
    ]
  }
});

const main = () => {
  try {
    const raw = fs.readFileSync(0, "utf8");
    const payload = raw ? JSON.parse(raw) : {};
    const url = payload.url || "";
    if (!url) {
      throw new Error("url is required");
    }
    const result = {
      mobile: createPsiRequest(url, "mobile"),
      desktop: createPsiRequest(url, "desktop")
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    fs.writeSync(process.stderr.fd, `psi-analyze failed: ${error.message}\n`);
    process.exit(1);
  }
};

main();
