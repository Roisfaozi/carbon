import { requirePermissions } from "@carbon/auth/auth.server";
import { describe, expect, it, vi } from "vitest";
import { loader } from "./migration-runs.$migrationRunId";

const { getMigrationRun } = vi.hoisted(() => ({
  getMigrationRun: vi.fn()
}));

vi.mock("@carbon/auth/auth.server", () => ({
  requirePermissions: vi.fn()
}));

vi.mock("~/modules/shared", () => ({
  getMigrationRun
}));

describe("migration-runs detail loader", () => {
  it("returns persisted snapshots for one run", async () => {
    vi.mocked(requirePermissions).mockResolvedValue({
      client: { from: vi.fn() },
      companyId: "company-1"
    } as any);
    vi.mocked(getMigrationRun).mockResolvedValue({
      data: {
        id: "run-1",
        planSnapshot: { status: "pass" },
        dryRunSummary: { totalRows: 1 },
        applySummary: null
      },
      error: null
    } as any);

    const result = await loader({
      request: new Request("http://localhost/x/settings/migration-runs/run-1"),
      params: { migrationRunId: "run-1" }
    } as any);

    expect(getMigrationRun).toHaveBeenCalledWith(
      expect.anything(),
      "run-1",
      "company-1"
    );
    expect(result).toEqual({
      run: {
        id: "run-1",
        planSnapshot: { status: "pass" },
        dryRunSummary: { totalRows: 1 },
        applySummary: null
      }
    });
  });
});
