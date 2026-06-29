import assert from "node:assert/strict";
import test from "node:test";
import type { MigrationDryRunReport } from "../../../../../database/supabase/functions/import-csv/migration-runner.ts";
import { executePersistedApply } from "./migration-run.core.ts";

test("executePersistedApply sends persisted csvText to import-csv", async () => {
  const invokeCalls: unknown[] = [];
  const report: MigrationDryRunReport = {
    scenario: "golden-v1",
    status: "pass",
    totalRows: 1,
    tables: [],
    errors: [],
    warnings: [],
    importRequests: [
      {
        table: "customer",
        fileName: "customers.csv",
        filePath: "private/migrations/run-1/customers.csv",
        columnMappings: { id: "id", name: "name" },
        companyId: "company-1",
        userId: "user-1"
      }
    ]
  };
  const persistedRequest = {
    scenario: "golden-v1",
    profile: {
      id: "test-profile",
      name: "Test Profile",
      tables: []
    },
    files: {
      "customers.csv": "id,name\nC-001,Acme"
    },
    filePathPrefix: "private/migrations/run-1"
  };

  const execution = await executePersistedApply(
    {
      functions: {
        invoke: async (...args: unknown[]) => {
          invokeCalls.push(args);
          return {
            data: { inserted: 1, updated: 0, skipped: 0, errors: [] },
            error: null
          };
        }
      }
    } as any,
    report,
    persistedRequest
  );

  assert.deepEqual(invokeCalls, [
    [
      "import-csv",
      {
        body: {
          ...report.importRequests[0],
          csvText: persistedRequest.files["customers.csv"]
        }
      }
    ]
  ]);
  assert.equal(execution.status, "pass");
  assert.deepEqual(execution.summary, { inserted: 1, updated: 0, skipped: 0 });
});
