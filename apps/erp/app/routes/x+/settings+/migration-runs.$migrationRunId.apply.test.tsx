import { describe, expect, it, vi } from "vitest";

const {
  assertIsPost,
  requirePermissions,
  trigger,
  getMigrationRun,
  updateMigrationRunStatus
} = vi.hoisted(() => ({
  assertIsPost: vi.fn(),
  requirePermissions: vi.fn(),
  trigger: vi.fn(),
  getMigrationRun: vi.fn(),
  updateMigrationRunStatus: vi.fn()
}));

vi.mock("@carbon/auth", () => ({
  assertIsPost,
  success: vi.fn((message?: string) => message),
  getAppUrl: vi.fn(() => "http://localhost:3000"),
  getMESUrl: vi.fn(() => "http://localhost:3001"),
  SUPABASE_URL: "http://localhost:54321"
}));

vi.mock("@carbon/auth/auth.server", () => ({
  requirePermissions
}));

vi.mock("@carbon/auth/session.server", () => ({
  flash: vi.fn(async () => ({}))
}));

vi.mock("@carbon/jobs", () => ({
  trigger
}));

vi.mock("~/modules/shared", () => ({
  getMigrationRun,
  updateMigrationRunStatus
}));

vi.mock("~/utils/path", () => ({
  path: {
    to: {
      migrationRun: (id: string) => `/x/settings/migration-runs/${id}`
    }
  }
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    redirect: vi.fn((url: string, init?: unknown) => {
      throw { status: 302, url, init };
    })
  };
});

describe("migration-runs apply action", () => {
  it("rejects non review-ready runs", async () => {
    requirePermissions.mockResolvedValue({
      client: { from: vi.fn() },
      companyId: "company-1",
      userId: "user-1"
    } as any);
    getMigrationRun.mockResolvedValue({
      data: { id: "run-1", status: "failed" },
      error: null
    } as any);

    const { action } = await import("./migration-runs.$migrationRunId.apply");
    const response = await action({
      request: new Request(
        "http://localhost/x/settings/migration-runs/run-1/apply",
        {
          method: "POST"
        }
      ),
      params: { migrationRunId: "run-1" }
    } as any);

    expect(assertIsPost).toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
    expect(response).toEqual({
      success: false,
      message: "Migration run is not ready to apply"
    });
  });

  it("marks run queued-apply before triggering background apply", async () => {
    const client = { from: vi.fn() };
    requirePermissions.mockResolvedValue({
      client,
      companyId: "company-1",
      userId: "user-1"
    } as any);
    getMigrationRun.mockResolvedValue({
      data: { id: "run-1", status: "review-ready" },
      error: null
    } as any);

    const { action } = await import("./migration-runs.$migrationRunId.apply");

    await expect(
      action({
        request: new Request(
          "http://localhost/x/settings/migration-runs/run-1/apply",
          {
            method: "POST"
          }
        ),
        params: { migrationRunId: "run-1" }
      } as any)
    ).rejects.toMatchObject({
      status: 302,
      url: "/x/settings/migration-runs/run-1"
    });

    expect(updateMigrationRunStatus).toHaveBeenCalledWith(client, {
      id: "run-1",
      companyId: "company-1",
      userId: "user-1",
      status: "queued-apply",
      error: null
    });
    expect(trigger).toHaveBeenCalledWith("migration-run", {
      migrationRunId: "run-1",
      companyId: "company-1",
      userId: "user-1",
      action: "apply"
    });
  });
});
