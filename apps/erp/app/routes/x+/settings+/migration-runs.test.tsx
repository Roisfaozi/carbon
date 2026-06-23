import { requirePermissions } from "@carbon/auth/auth.server";
import { describe, expect, it, vi } from "vitest";
import { loader } from "./migration-runs";

const { getMigrationRuns } = vi.hoisted(() => ({
  getMigrationRuns: vi.fn()
}));

vi.mock("@carbon/auth/auth.server", () => ({
  requirePermissions: vi.fn()
}));

vi.mock("~/modules/shared", () => ({
  getMigrationRuns
}));

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
