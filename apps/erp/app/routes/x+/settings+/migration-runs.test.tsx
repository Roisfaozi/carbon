import { requirePermissions } from "@carbon/auth/auth.server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getMigrationRuns } = vi.hoisted(() => ({
  getMigrationRuns: vi.fn()
}));

vi.mock("@carbon/auth/auth.server", () => ({
  requirePermissions: vi.fn()
}));

vi.mock("@lingui/core/macro", () => ({
  msg: vi.fn((strings: TemplateStringsArray) => strings[0] ?? "")
}));

vi.mock("@carbon/react", () => ({
  Button: vi.fn(() => null),
  VStack: vi.fn(() => null)
}));

vi.mock("@lingui/core/macro", () => ({
  msg: vi.fn((strings: TemplateStringsArray) => strings[0])
}));

vi.mock("~/hooks", () => ({
  usePermissions: vi.fn(() => ({ can: vi.fn(() => true) }))
}));

vi.mock("~/modules/settings", () => ({
  MigrationRunsTable: vi.fn(() => null)
}));

vi.mock("~/modules/shared", () => ({
  getMigrationRuns
}));

vi.mock("~/utils/path", () => ({
  path: {
    to: {
      migrationRuns: "/x/settings/migration-runs",
      newMigrationRun: "/x/settings/migration-runs/new"
    }
  }
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("migration-runs list loader", () => {
  it("loads migration runs scoped by company", async () => {
    vi.mocked(requirePermissions).mockResolvedValue({
      client: { from: vi.fn() },
      companyId: "company-1"
    } as any);
    vi.mocked(getMigrationRuns).mockResolvedValue({
      data: [{ id: "run-1" }],
      count: 1,
      error: null
    } as any);

    const { loader } = await import("./migration-runs");
    const result = await loader({
      request: new Request("http://localhost/x/settings/migration-runs")
    } as any);

    expect(getMigrationRuns).toHaveBeenCalledWith(
      expect.anything(),
      "company-1"
    );
    expect(result).toEqual({
      data: [{ id: "run-1" }],
      count: 1
    });
  });
});
