#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const schemaDir = path.join(__dirname, "..", "schemas");

const main = () => {
  try {
    const files = fs.readdirSync(schemaDir).filter((name) => name.endsWith(".json"));
    if (files.length === 0) {
      throw new Error("no schema files found");
    }
    files.forEach((fileName) => {
      const fullPath = path.join(schemaDir, fileName);
      const raw = fs.readFileSync(fullPath, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed.$id || !parsed.$schema) {
        throw new Error(`${fileName} missing $id or $schema`);
      }
    });
    process.stdout.write(`validated ${files.length} schema files\n`);
  } catch (error) {
    fs.writeSync(process.stderr.fd, `validate-schemas failed: ${error.message}\n`);
    process.exit(1);
  }
};

main();
