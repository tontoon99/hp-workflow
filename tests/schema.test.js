const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const schemaNames = [
  "company-record.schema.json",
  "content-inventory.schema.json",
  "design-token.schema.json",
  "quality-report.schema.json",
  "proposal-bundle.schema.json"
];

const readSchema = (fileName) => {
  const fullPath = path.join(__dirname, "..", "schemas", fileName);
  const raw = fs.readFileSync(fullPath, "utf8");
  return JSON.parse(raw);
};

test("all schemas are valid JSON with required headers", () => {
  schemaNames.forEach((fileName) => {
    const schema = readSchema(fileName);
    assert.equal(typeof schema.$schema, "string");
    assert.equal(typeof schema.$id, "string");
    assert.equal(schema.type, "object");
  });
});

test("content inventory uses no_new_text policy", () => {
  const schema = readSchema("content-inventory.schema.json");
  assert.equal(schema.properties.content_lock.properties.policy.const, "no_new_text");
});
