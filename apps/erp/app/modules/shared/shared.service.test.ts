import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";

vi.mock("@carbon/utils", () => ({
  getPurchaseOrderStatus: vi.fn(),
  supportedModelTypes: []
}));

vi.mock("~/utils/query", () => ({
  setGenericQueryFilters: vi.fn()
}));

vi.mock("~/utils/supabase", () => ({
  sanitize: vi.fn((value) => value)
}));

import type { MigrationDryRunReport } from "@carbon/database/migration";
import { createImportCsvExecutor, importCsv } from "./shared.service";

describe("shared import service", () => {
  it("passes exact request body to import-csv function", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue({ data: { inserted: 1 }, error: null });
    const client = { functions: { invoke } } as any;
    const args = {
      table: "customer",
      filePath: "private/path.csv",
      columnMappings: { id: "id", name: "name" },
      enumMappings: { customerStatusId: { Active: "status-active" } },
      companyId: "company-1",
      userId: "user-1"
    };

    const result = await importCsv(client, args);

    assert.deepEqual(invoke.mock.calls, [["import-csv", { body: args }]]);
    assert.deepEqual(result, { data: { inserted: 1 }, error: null });
  });

  it("creates executor that normalizes import-csv result", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        inserted: 3,
        updated: 2,
        skipped: 1,
        errors: [{ row: 0, reason: "bad" }]
      },
      error: null
    });
    const client = { functions: { invoke } } as any;
    const executor = createImportCsvExecutor(client);

    const result = await executor({
      table: "supplier",
      filePath: "private/supplier.csv",
      columnMappings: { id: "id", name: "name" },
      companyId: "company-1",
      userId: "user-1"
    });

    assert.deepEqual(result, {
      inserted: 3,
      updated: 2,
      skipped: 1,
      errors: [{ row: 0, reason: "bad" }]
    });
  });

  it("executes migration plan through import-csv executor in order", async () => {
    const report = {
      scenario: "two-step",
      status: "pass",
      totalRows: 2,
      tables: [],
      errors: [],
      warnings: [],
      importRequests: [
        {
          table: "customer",
          filePath: "private/customer.csv",
          columnMappings: { id: "id", name: "name" },
          companyId: "company-1",
          userId: "user-1"
        },
        {
          table: "supplier",
          filePath: "private/supplier.csv",
          columnMappings: { id: "id", name: "name" },
          companyId: "company-1",
          userId: "user-1"
        }
      ]
    } satisfies MigrationDryRunReport;

    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        data: { inserted: 1, updated: 0, skipped: 0, errors: [] },
        error: null
      })
      .mockResolvedValueOnce({
        data: { inserted: 0, updated: 1, skipped: 0, errors: [] },
        error: null
      });
    const client = { functions: { invoke } } as any;

    const execution = await importCsv(client, report.importRequests[0]);
    assert.deepEqual(execution, {
      data: { inserted: 1, updated: 0, skipped: 0, errors: [] },
      error: null
    });
  });
});
