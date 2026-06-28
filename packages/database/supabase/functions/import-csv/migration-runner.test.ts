import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildDryRunReport,
  executeMigrationPlan,
  type MigrationImportExecutionResult,
} from "./migration-runner.ts";
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
      fileName: "customer.csv",
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

test("executeMigrationPlan refuses to run when dry-run validation fails", async () => {
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
  let executorCalls = 0;

  const execution = await executeMigrationPlan(report, async () => {
    executorCalls += 1;
    return { inserted: 1, updated: 0, skipped: 0, errors: [] };
  });

  assert.equal(executorCalls, 0);
  assert.equal(execution.status, "fail");
  assert.deepEqual(execution.errors, [
    { table: "customer", row: 0, reason: "Missing required field: name" },
  ]);
});

test("executeMigrationPlan runs import requests sequentially in profile order", async () => {
  const report = buildDryRunReport({
    scenario: "golden-happy-v1",
    profile: carbonCanonicalProfile,
    files: Object.fromEntries(
      carbonCanonicalProfile.tables.map((table) => [table.fileName, csvFile(table.fileName)])
    ),
  });
  const calls: string[] = [];
  const result: MigrationImportExecutionResult = {
    inserted: 1,
    updated: 2,
    skipped: 3,
    errors: [],
  };

  const execution = await executeMigrationPlan(report, async (request) => {
    calls.push(request.table);
    return result;
  });

  assert.deepEqual(
    calls,
    carbonCanonicalProfile.tables.map((table) => table.table)
  );
  assert.equal(execution.status, "pass");
  assert.deepEqual(execution.summary, {
    inserted: carbonCanonicalProfile.tables.length,
    updated: carbonCanonicalProfile.tables.length * 2,
    skipped: carbonCanonicalProfile.tables.length * 3,
  });
});

test("executeMigrationPlan stops after first table result with row errors", async () => {
  const report = buildDryRunReport({
    scenario: "three-table-fail-fast",
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
        {
          table: "supplier",
          fileName: "supplier.csv",
          columnMappings: { id: "id", name: "name" },
          requiredFields: ["id", "name"],
        },
        {
          table: "process",
          fileName: "process.csv",
          columnMappings: { id: "id", name: "name", processType: "processType" },
          requiredFields: ["id", "name", "processType"],
        },
      ],
    },
    files: {
      "customer.csv": "id,name\nCUST-1,Acme\n",
      "supplier.csv": "id,name\nSUP-1,Supplier\n",
      "process.csv": "id,name,processType\nPROC-1,Process,Inside\n",
    },
  });
  const calls: string[] = [];

  const execution = await executeMigrationPlan(report, async (request) => {
    calls.push(request.table);
    if (request.table === "supplier") {
      return {
        inserted: 0,
        updated: 0,
        skipped: 1,
        errors: [{ row: 0, reason: "Supplier import failed" }],
      };
    }
    return { inserted: 1, updated: 0, skipped: 0, errors: [] };
  });

  assert.deepEqual(calls, ["customer", "supplier"]);
  assert.equal(execution.status, "fail");
  assert.deepEqual(
    execution.executedTables.map((table) => table.table),
    ["customer", "supplier"]
  );
  assert.deepEqual(execution.errors, [
    { table: "supplier", row: 0, reason: "Supplier import failed" },
  ]);
});

test("executeMigrationPlan captures thrown executor errors and stops", async () => {
  const report = buildDryRunReport({
    scenario: "executor-throws",
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
        {
          table: "supplier",
          fileName: "supplier.csv",
          columnMappings: { id: "id", name: "name" },
          requiredFields: ["id", "name"],
        },
      ],
    },
    files: {
      "customer.csv": "id,name\nCUST-1,Acme\n",
      "supplier.csv": "id,name\nSUP-1,Supplier\n",
    },
  });
  const calls: string[] = [];

  const execution = await executeMigrationPlan(report, async (request) => {
    calls.push(request.table);
    throw new Error("Edge function unavailable");
  });

  assert.deepEqual(calls, ["customer"]);
  assert.equal(execution.status, "fail");
  assert.deepEqual(execution.errors, [
    { table: "customer", reason: "Edge function unavailable" },
  ]);
});

test("executeMigrationPlan can replay golden fixture requests with deterministic fake counts", async () => {
  const report = buildDryRunReport({
    scenario: "golden-happy-v1",
    profile: carbonCanonicalProfile,
    files: Object.fromEntries(
      carbonCanonicalProfile.tables.map((table) => [table.fileName, csvFile(table.fileName)])
    ),
    filePathPrefix: "migration/golden",
  });
  const rowCountByTable = new Map(report.tables.map((table) => [table.table, table.rowCount]));

  const execution = await executeMigrationPlan(report, async (request) => ({
    inserted: rowCountByTable.get(request.table) ?? 0,
    updated: 0,
    skipped: 0,
    errors: [],
  }));

  assert.equal(execution.status, "pass");
  assert.equal(execution.summary.inserted, report.totalRows);
  assert.equal(execution.summary.updated, 0);
  assert.equal(execution.summary.skipped, 0);
  assert.deepEqual(
    execution.executedTables.map((table) => table.filePath),
    carbonCanonicalProfile.tables.map((table) => `migration/golden/${table.fileName}`)
  );
});
