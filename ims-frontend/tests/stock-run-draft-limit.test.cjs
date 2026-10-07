/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TS draft helpers in Node. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");
const filename = require.resolve("../src/lib/stock-run-draft-limit.ts");
const compiled = new Module(filename, module); compiled.paths = module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { findUnfinishedStockRun, unfinishedStockRunMessage } = compiled.exports;
const run = (id, status, createdAt, owner = "other-user") => ({ id, status, createdAt, name: "Tuesday run", reference: "ST-RUN-20261007-001", createdBy: { id: owner } });
test("global draft limit chooses the oldest draft regardless of owner", () => {
  const first = run("old", "DRAFT", "2026-10-05T00:00:00Z");
  const runs = [run("new", "DRAFT", "2026-10-07T00:00:00Z", "current-user"), run("posted", "POSTED", "2026-10-01T00:00:00Z"), first];
  assert.equal(findUnfinishedStockRun(runs), first);
  assert.equal(runs[0].id, "new");
});
test("posted and cancelled runs do not block a new draft", () => {
  assert.equal(findUnfinishedStockRun([run("posted", "POSTED", "2026-10-01"), run("cancelled", "CANCELLED", "2026-10-02")]), null);
  assert.equal(findUnfinishedStockRun([]), null);
});
test("alert names the draft and explains how to unblock creation", () => {
  const message = unfinishedStockRunMessage(run("draft", "DRAFT", "2026-10-07"));
  assert.ok(message.includes("Tuesday run"));
  assert.ok(message.includes("ST-RUN-20261007-001"));
  assert.ok(message.includes("Post the draft"));
  assert.ok(message.includes("delete it"));
});
