import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";

vi.mock("@carbon/utils", () => ({
  getPurchaseOrderStatus: vi.fn(),
  supportedModelTypes: []
}));

vi.mock("~/utils/query", () => ({
  setGenericQueryFilters: vi.fn((query) => query)
}));

vi.mock("~/utils/supabase", () => ({
  sanitize: vi.fn((value) => value)
}));

import { migrationRunStatusValidator } from "./shared.models";
import {
  createMigrationRun,
  getMigrationRun,
  getMigrationRuns,
  updateMigrationRunStatus
} from "./shared.service";

function createQuery() {
  const query: any = {
    calls: [] as Array<[string, ...unknown[]]>,
    insert: vi.fn((value) => {
      query.calls.push(["insert", value]);
      return query;
    }),
    update: vi.fn((value) => {
      query.calls.push(["update", value]);
      return query;
    }),
    select: vi.fn((value?: string) => {
      query.calls.push(["select", value]);
      return query;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      query.calls.push(["eq", column, value]);
      return query;
    }),
    order: vi.fn((column: string, value: unknown) => {
      query.calls.push(["order", column, value]);
      return query;
    }),
    single: vi.fn(() => {
      query.calls.push(["single"]);
      return Promise.resolve({ data: { id: "run-1" }, error: null });
    })
  };
  query.then = (resolve: any) =>
    resolve({ data: [{ id: "run-1" }], error: null, count: 1 });
  return query;
}

function createClient(query = createQuery()) {
  return {
    query,
    client: {
      from: vi.fn((table: string) => {
        query.calls.push(["from", table]);
        return query;
      })
    }
  };
}

describe("migration run persistence", () => {
  it("accepts only known migration run statuses", () => {
    assert.equal(
      migrationRunStatusValidator.parse("queued-dry-run"),
      "queued-dry-run"
    );
    assert.equal(migrationRunStatusValidator.parse("applied"), "applied");
    assert.throws(() => migrationRunStatusValidator.parse("done"));
  });

  it("creates a migration run and preserves the JSON request", async () => {
    const { client, query } = createClient();
    const request = {
      scenario: "golden-v1",
      profile: "carbon-canonical",
      filePathPrefix: "private/migrations/run-1"
    };

    await createMigrationRun(client as any, {
      request,
      companyId: "company-1",
      userId: "user-1"
    });

    assert.deepEqual(query.calls.slice(0, 4), [
      ["from", "migrationRun"],
      [
        "insert",
        [
          {
            request,
            status: "queued-dry-run",
            companyId: "company-1",
            createdBy: "user-1"
          }
        ]
      ],
      ["select", "*"],
      ["single"]
    ]);
  });

  it("lists migration runs without full snapshot payloads", async () => {
    const { client, query } = createClient();

    await getMigrationRuns(client as any, "company-1");

    assert.deepEqual(query.calls.slice(0, 3), [
      ["from", "migrationRun"],
      [
        "select",
        "id, status, error, createdAt, updatedAt, scenario:request->>scenario, profileName:request->profile->>name, profileId:request->profile->>id"
      ],
      ["eq", "companyId", "company-1"]
    ]);
    assert.deepEqual(query.order.mock.calls, [
      ["createdAt", { ascending: false }]
    ]);
  });

  it("updates status without mutating stored plan snapshot", async () => {
    const { client, query } = createClient();

    await updateMigrationRunStatus(client as any, {
      id: "run-1",
      companyId: "company-1",
      status: "failed",
      error: "Dry run failed",
      userId: "user-1"
    });

    assert.equal(query.update.mock.calls[0]?.[0].status, "failed");
    assert.equal(query.update.mock.calls[0]?.[0].error, "Dry run failed");
    assert.equal(query.update.mock.calls[0]?.[0].updatedBy, "user-1");
    assert.equal(typeof query.update.mock.calls[0]?.[0].updatedAt, "string");
    assert.equal("planSnapshot" in query.update.mock.calls[0]![0], false);
    assert.deepEqual(query.eq.mock.calls, [
      ["id", "run-1"],
      ["companyId", "company-1"]
    ]);
  });

  it("lists and reads migration runs scoped by company", async () => {
    const list = createClient();
    await getMigrationRuns(list.client as any, "company-1");
    assert.deepEqual(list.query.eq.mock.calls, [["companyId", "company-1"]]);
    assert.deepEqual(list.query.order.mock.calls, [
      ["createdAt", { ascending: false }]
    ]);

    const detail = createClient();
    await getMigrationRun(detail.client as any, "run-1", "company-1");
    assert.deepEqual(detail.query.eq.mock.calls, [
      ["id", "run-1"],
      ["companyId", "company-1"]
    ]);
  });
});
