import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildDryRunReport } from "./migration-runner.ts";
import { carbonCanonicalProfile } from "./migration-source-profiles.ts";
import { expectedScenarioSchema } from "./fixture-schema.ts";

function jsonFile(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function edgeCsv(path: string) {
  return readFileSync(resolve(here, "fixtures/edge-cases", path, "input.csv"), "utf8");
}

const here = dirname(fileURLToPath(import.meta.url));
const goldenRoot = resolve(here, "fixtures/golden/v1");

function csvFile(fileName: string) {
  return readFileSync(resolve(goldenRoot, fileName), "utf8");
}

test("buildDryRunReport counts rows for every canonical golden file", () => {
  const report = buildDryRunReport({
    scenario: "golden-happy-v1",
    profile: carbonCanonicalProfile,
    files: Object.fromEntries(
      carbonCanonicalProfile.tables.map((table) => [table.fileName, csvFile(table.fileName)])
    ),
  });

  assert.equal(report.scenario, "golden-happy-v1");
  assert.equal(report.status, "pass");
  assert.equal(report.tables.length, carbonCanonicalProfile.tables.length);
  assert.equal(report.errors.length, 0);
  assert.ok(report.totalRows > 0);
});

test("buildDryRunReport fails when required mapped values are blank", () => {
  const report = buildDryRunReport({
    scenario: "missing-required-customer-name",
    profile: {
      id: "test-profile",
      name: "Test Profile",
      tables: [
        {
          table: "customer",
          fileName: "customer.csv",
          columnMappings: { id: "id", name: "name" },
          requiredFields: ["id", "name"],
        },
      ],
    },
    files: {
      "customer.csv": "id,name\nCUST-1,\n",
    },
  });

  assert.equal(report.status, "fail");
  assert.deepEqual(report.errors, [
    { table: "customer", row: 0, reason: "Missing required field: name" },
  ]);
});

test("buildDryRunReport fails duplicate ids within one source file", () => {
  const report = buildDryRunReport({
    scenario: "duplicate-customer-id",
    profile: {
      id: "test-profile",
      name: "Test Profile",
      tables: [
        {
          table: "customer",
          fileName: "customer.csv",
          columnMappings: { id: "id", name: "name" },
          requiredFields: ["id", "name"],
          uniqueFields: ["id"],
        },
      ],
    },
    files: {
      "customer.csv": "id,name\nCUST-1,Acme\nCUST-1,Acme Duplicate\n",
    },
  });

  assert.equal(report.status, "fail");
  assert.deepEqual(report.errors, [
    { table: "customer", row: 1, reason: "Duplicate value for id: CUST-1" },
  ]);
});

test("buildDryRunReport includes import requests in execution order", () => {
  const report = buildDryRunReport({
    scenario: "single-customer",
    profile: {
      id: "test-profile",
      name: "Test Profile",
      tables: [
        {
          table: "customer",
          fileName: "customer.csv",
          columnMappings: { id: "id", name: "name" },
          requiredFields: ["id", "name"],
          uniqueFields: ["id"],
        },
      ],
    },
    files: {
      "customer.csv": "id,name\nCUST-1,Acme\n",
    },
    companyId: "company-1",
    userId: "user-1",
    filePathPrefix: "migration/golden",
  });

  assert.deepEqual(report.importRequests, [
    {
      table: "customer",
      filePath: "migration/golden/customer.csv",
      columnMappings: { id: "id", name: "name" },
      enumMappings: undefined,
      companyId: "company-1",
      userId: "user-1",
    },
  ]);
});

test("buildDryRunReport can be compared to golden expected summary row counts", () => {
  const expected = expectedScenarioSchema.parse(
    jsonFile(resolve(goldenRoot, "expected/summary.json"))
  );
  const report = buildDryRunReport({
    scenario: "golden-happy-v1",
    profile: carbonCanonicalProfile,
    files: Object.fromEntries(
      carbonCanonicalProfile.tables.map((table) => [table.fileName, csvFile(table.fileName)])
    ),
  });

  assert.equal(report.status, "pass");
  assert.equal(
    report.totalRows,
    expected.summary.inserted + expected.summary.updated + expected.summary.skipped
  );
});

test("buildDryRunReport catches missing work center location", () => {
  const report = buildDryRunReport({
    scenario: "workCenter/missing-location",
    profile: {
      id: "edge-profile",
      name: "Edge Profile",
      tables: [
        {
          table: "workCenter",
          fileName: "input.csv",
          columnMappings: {
            id: "id",
            name: "name",
            description: "description",
            locationId: "locationId",
          },
          requiredFields: ["id", "name", "description", "locationId"],
          uniqueFields: ["id"],
        },
      ],
    },
    files: { "input.csv": edgeCsv("workCenter/missing-location") },
  });

  assert.equal(report.status, "fail");
  assert.deepEqual(report.errors, [
    { table: "workCenter", row: 0, reason: "Missing required field: locationId" },
  ]);
});

test("buildDryRunReport accepts supplier blank IDs without duplicate failures", () => {
  const report = buildDryRunReport({
    scenario: "supplier/blank-id-dedup",
    profile: {
      id: "edge-profile",
      name: "Edge Profile",
      tables: [
        {
          table: "supplier",
          fileName: "input.csv",
          columnMappings: { id: "id", name: "name" },
          requiredFields: ["name"],
          uniqueFields: ["id"],
        },
      ],
    },
    files: { "input.csv": edgeCsv("supplier/blank-id-dedup") },
  });

  assert.equal(report.status, "pass");
});
