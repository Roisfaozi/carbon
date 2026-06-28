import assert from "node:assert/strict";
import test from "node:test";
import type {
  MigrationDryRunReport,
  MigrationExecutionReport
} from "../../../../../database/supabase/functions/import-csv/migration-runner.ts";
import { runMigrationRun } from "./migration-run.core.ts";

const profile: any = {
  id: "test-profile",
  name: "Test Profile",
  tables: [
    {
      table: "customer",
      fileName: "customers.csv",
      columnMappings: { id: "id", name: "name" },
      requiredFields: ["name"],
      uniqueFields: ["id"]
    }
  ]
};

const request = {
  scenario: "golden-v1",
  profile,
  files: {
    "customers.csv": "id,name\nC-001,Acme"
  },
  filePathPrefix: "private/migrations/run-1"
};

test("runMigrationRun persists review-ready dry-run state with plan snapshot", async () => {
  const updates: unknown[] = [];

  await runMigrationRun(
    {
      migrationRunId: "run-1",
      companyId: "company-1",
      userId: "user-1",
      action: "dry-run"
    },
    {
      loadRun: async () =>
        ({ id: "run-1", request, planSnapshot: null }) as any,
      updateRun: async (update) => {
        updates.push(update);
      },
      executeApply: async () => {
        throw new Error("apply should not run");
      }
    }
  );

  assert.equal((updates[0] as any).status, "running-dry-run");
  assert.equal((updates[1] as any).status, "review-ready");
  assert.equal((updates[1] as any).planSnapshot.status, "pass");
  assert.equal((updates[1] as any).dryRunSummary.totalRows, 1);
});

test("runMigrationRun fails gracefully for invalid persisted request shape", async () => {
  const updates: unknown[] = [];

  await runMigrationRun(
    {
      migrationRunId: "run-1",
      companyId: "company-1",
      userId: "user-1",
      action: "dry-run"
    },
    {
      loadRun: async () =>
        ({
          id: "run-1",
          request: {
            scenario: "golden-v1",
            profile: { id: "profile-1", name: "Broken Profile" },
            files: { "customers.csv": "id,name\nC-001,Acme" }
          },
          planSnapshot: null
        }) as any,
      updateRun: async (update) => {
        updates.push(update);
      },
      executeApply: async () => {
        throw new Error("apply should not run");
      }
    }
  );

  assert.equal((updates[0] as any).status, "running-dry-run");
  assert.equal((updates[1] as any).status, "failed");
  assert.match((updates[1] as any).error, /Invalid migration run request/);
});

test("runMigrationRun persists failed dry-run validation state", async () => {
  const updates: unknown[] = [];

  await runMigrationRun(
    {
      migrationRunId: "run-1",
      companyId: "company-1",
      userId: "user-1",
      action: "dry-run"
    },
    {
      loadRun: async () =>
        ({
          id: "run-1",
          request: {
            ...request,
            files: { "customers.csv": "id,name\nC-001," }
          },
          planSnapshot: null
        }) as any,
      updateRun: async (update) => {
        updates.push(update);
      },
      executeApply: async () => {
        throw new Error("apply should not run");
      }
    }
  );

  assert.equal((updates[1] as any).status, "failed");
  assert.match((updates[1] as any).error, /Missing required field: name/);
});

test("runMigrationRun applies stored plan snapshot and persists execution summary", async () => {
  const updates: unknown[] = [];
  const planSnapshot: MigrationDryRunReport = {
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
  const execution: MigrationExecutionReport = {
    scenario: "golden-v1",
    status: "pass",
    dryRun: planSnapshot,
    executedTables: [],
    summary: { inserted: 1, updated: 0, skipped: 0 },
    errors: []
  };

  await runMigrationRun(
    {
      migrationRunId: "run-1",
      companyId: "company-1",
      userId: "user-1",
      action: "apply"
    },
    {
      loadRun: async () => ({ id: "run-1", request, planSnapshot }) as any,
      updateRun: async (update) => {
        updates.push(update);
      },
      executeApply: async (report, persistedRequest) => {
        assert.equal(report, planSnapshot);
        assert.equal(persistedRequest, request);
        return execution;
      }
    }
  );

  assert.equal((updates[0] as any).status, "running-apply");
  assert.deepEqual((updates[1] as any).applySummary.summary, {
    inserted: 1,
    updated: 0,
    skipped: 0
  });
  assert.equal((updates[1] as any).status, "applied");
});

test("runMigrationRun fails apply gracefully when persisted csv file is missing", async () => {
  const updates: unknown[] = [];
  const planSnapshot: MigrationDryRunReport = {
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

  await runMigrationRun(
    {
      migrationRunId: "run-1",
      companyId: "company-1",
      userId: "user-1",
      action: "apply"
    },
    {
      loadRun: async () =>
        ({
          id: "run-1",
          request: { ...request, files: {} },
          planSnapshot
        }) as any,
      updateRun: async (update) => {
        updates.push(update);
      },
      executeApply: async () => {
        throw new Error("should not execute apply without csv content");
      }
    }
  );

  assert.equal((updates[0] as any).status, "running-apply");
  assert.equal((updates[1] as any).status, "failed");
  assert.match((updates[1] as any).error, /Missing persisted CSV/);
});
