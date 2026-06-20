import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { expectedScenarioSchema } from "./fixture-schema.ts";

const here = dirname(fileURLToPath(import.meta.url));
const edgeCasesRoot = resolve(here, "fixtures/edge-cases");

const requiredScenarios = [
  "supplier/blank-id-dedup",
  "workCenter/missing-location",
  "material/missing-substance",
] as const;

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("required edge-case fixture scenarios exist", () => {
  for (const scenario of requiredScenarios) {
    const dir = resolve(edgeCasesRoot, scenario);
    assert.equal(existsSync(dir), true, `${scenario} dir missing`);
    assert.equal(existsSync(resolve(dir, "request.json")), true, `${scenario}/request.json missing`);
    assert.equal(existsSync(resolve(dir, "expected.json")), true, `${scenario}/expected.json missing`);
  }
});

test("remaining edge-case scenarios represent supported import paths", () => {
  const supplier = expectedScenarioSchema.parse(
    readJson(resolve(edgeCasesRoot, "supplier/blank-id-dedup/expected.json"))
  );
  const workCenter = expectedScenarioSchema.parse(
    readJson(resolve(edgeCasesRoot, "workCenter/missing-location/expected.json"))
  );
  const material = expectedScenarioSchema.parse(
    readJson(resolve(edgeCasesRoot, "material/missing-substance/expected.json"))
  );

  assert.equal(supplier.status, "pass");
  assert.equal(workCenter.status, "pass");
  assert.equal(material.status, "pass");
});
