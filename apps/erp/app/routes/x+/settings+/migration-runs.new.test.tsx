import { describe, expect, it, vi } from "vitest";

const { assertIsPost, requirePermissions, trigger, createMigrationRun } =
  vi.hoisted(() => ({
    assertIsPost: vi.fn(),
    requirePermissions: vi.fn(),
    trigger: vi.fn(),
    createMigrationRun: vi.fn()
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

vi.mock("~/modules/settings", async () => {
  const actual = await import("~/modules/settings/settings.models");
  return {
    MigrationRunForm: vi.fn(() => null),
    migrationRunRequestValidator: actual.migrationRunRequestValidator
  };
});

vi.mock("~/modules/shared", () => ({
  createMigrationRun
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

describe("migration-runs new action", () => {
  it("rejects invalid profile shape before create and trigger", async () => {
    requirePermissions.mockResolvedValue({
      client: { from: vi.fn() },
      companyId: "company-1",
      userId: "user-1"
    } as any);

    const form = new FormData();
    form.set("scenario", "golden-v1");
    form.set("profile", JSON.stringify({ id: "profile-1", name: "Profile" }));
    form.set("files", JSON.stringify({ "customer.csv": "id,name\nC-1,Acme" }));
    form.set("filePathPrefix", "private/migration/run-1");

    const { action } = await import("./migration-runs.new");
    const result = await action({
      request: new Request("http://localhost/x/settings/migration-runs/new", {
        method: "POST",
        body: form
      })
    } as any);

    expect(result).toMatchObject({
      data: {
        fieldErrors: expect.any(Object)
      },
      init: {
        status: 422
      }
    });
    expect(createMigrationRun).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
  });

  it("rejects invalid files payload before create and trigger", async () => {
    requirePermissions.mockResolvedValue({
      client: { from: vi.fn() },
      companyId: "company-1",
      userId: "user-1"
    } as any);

    const form = new FormData();
    form.set("scenario", "golden-v1");
    form.set(
      "profile",
      JSON.stringify({ id: "profile-1", name: "Profile", tables: [] })
    );
    form.set("files", JSON.stringify({ "customer.csv": 123 }));
    form.set("filePathPrefix", "private/migration/run-1");

    const { action } = await import("./migration-runs.new");
    const result = await action({
      request: new Request("http://localhost/x/settings/migration-runs/new", {
        method: "POST",
        body: form
      })
    } as any);

    expect(result).toMatchObject({
      data: {
        fieldErrors: expect.any(Object)
      },
      init: {
        status: 422
      }
    });
    expect(createMigrationRun).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
  });

  it("creates run and queues dry-run job", async () => {
    requirePermissions.mockResolvedValue({
      client: { from: vi.fn() },
      companyId: "company-1",
      userId: "user-1"
    } as any);
    createMigrationRun.mockResolvedValue({
      data: { id: "run-1" },
      error: null
    } as any);

    const form = new FormData();
    form.set("scenario", "golden-v1");
    form.set(
      "profile",
      JSON.stringify({ id: "profile-1", name: "Profile", tables: [] })
    );
    form.set("files", JSON.stringify({ "customer.csv": "id,name\nC-1,Acme" }));
    form.set("filePathPrefix", "private/migration/run-1");

    const { action } = await import("./migration-runs.new");

    await expect(
      action({
        request: new Request("http://localhost/x/settings/migration-runs/new", {
          method: "POST",
          body: form
        })
      } as any)
    ).rejects.toMatchObject({
      status: 302,
      url: "/x/settings/migration-runs/run-1"
    });

    expect(assertIsPost).toHaveBeenCalled();
    expect(createMigrationRun).toHaveBeenCalledWith(expect.anything(), {
      request: {
        scenario: "golden-v1",
        profile: { id: "profile-1", name: "Profile", tables: [] },
        files: { "customer.csv": "id,name\nC-1,Acme" },
        filePathPrefix: "private/migration/run-1"
      },
      companyId: "company-1",
      userId: "user-1"
    });
    expect(trigger).toHaveBeenCalledWith("migration-run", {
      migrationRunId: "run-1",
      companyId: "company-1",
      userId: "user-1",
      action: "dry-run"
    });
  });
});
