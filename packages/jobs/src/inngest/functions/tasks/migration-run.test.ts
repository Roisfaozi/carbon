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

test("executePersistedApply surfaces edge-function JSON message for non-2xx responses", async () => {
  const { executePersistedApply } = await import("./migration-run.core.ts");
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

  const response = new Response(
    JSON.stringify({
      success: false,
      message:
        'duplicate key value violates unique constraint "workCenter_name_companyId_key"'
    }),
    {
      status: 409,
      headers: { "Content-Type": "application/json" }
    }
  );

  const execution = await executePersistedApply(
    {
      functions: {
        invoke: async () => ({
          data: null,
          error: {
            message: "Edge Function returned a non-2xx status code",
            context: response
          }
        })
      }
    } as any,
    planSnapshot,
    request as any
  );

  assert.equal(execution.status, "fail");
  assert.match(
    execution.errors[0]?.reason ?? "",
    /duplicate key value violates unique constraint/
  );
});

function smokeRequest(args: {
  scenario: string;
  table: "supplier" | "process" | "workCenter";
  fileName: string;
  csvText: string;
  requiredFields: string[];
  columnMappings: Record<string, string>;
}) {
  return {
    scenario: args.scenario,
    profile: {
      id: "test-profile",
      name: "Test Profile",
      tables: [
        {
          table: args.table,
          fileName: args.fileName,
          columnMappings: args.columnMappings,
          requiredFields: args.requiredFields,
          uniqueFields: ["id"]
        }
      ]
    },
    files: {
      [args.fileName]: args.csvText
    },
    filePathPrefix: `private/migrations/${args.scenario}`
  };
}

async function expectReviewReadyForSmokeRequest(
  request: Record<string, unknown>
) {
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
}

test("runMigrationRun persists review-ready dry-run state for supplier smoke dataset", async () => {
  await expectReviewReadyForSmokeRequest(
    smokeRequest({
      scenario: "manual-smoke-supplier-v1",
      table: "supplier",
      fileName: "supplier.csv",
      csvText: "id,name\nSUPP-MANUAL-001,Supplier Manual Test\n",
      requiredFields: ["id", "name"],
      columnMappings: { id: "id", name: "name" }
    })
  );
});

test("runMigrationRun persists review-ready dry-run state for process smoke dataset", async () => {
  await expectReviewReadyForSmokeRequest(
    smokeRequest({
      scenario: "manual-smoke-process-v1",
      table: "process",
      fileName: "process.csv",
      csvText:
        "id,name,processType,defaultStandardFactor\nPROC-MANUAL-001,Manual Process,Inside,Hours/Piece\n",
      requiredFields: ["id", "name", "processType", "defaultStandardFactor"],
      columnMappings: {
        id: "id",
        name: "name",
        processType: "processType",
        defaultStandardFactor: "defaultStandardFactor"
      }
    })
  );
});

test("runMigrationRun persists review-ready dry-run state for workCenter smoke dataset", async () => {
  await expectReviewReadyForSmokeRequest(
    smokeRequest({
      scenario: "manual-smoke-workcenter-v1",
      table: "workCenter",
      fileName: "workCenter.csv",
      csvText:
        "id,name,description,locationId\nWC-MANUAL-001,Manual Work Center,Manual test work center,LOC-MANUAL-001\n",
      requiredFields: ["id", "name", "description", "locationId"],
      columnMappings: {
        id: "id",
        name: "name",
        description: "description",
        locationId: "locationId"
      }
    })
  );
});
