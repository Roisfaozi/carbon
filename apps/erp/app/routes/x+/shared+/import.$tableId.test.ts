import { notFound } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { getCarbonServiceRole } from "@carbon/auth/client.server";
import { validator } from "@carbon/form";
import { describe, expect, it, vi } from "vitest";
import { action } from "./import.$tableId";

vi.mock("@carbon/auth", () => ({
  notFound: vi.fn((message: string) => new Error(message))
}));

vi.mock("@carbon/auth/auth.server", () => ({
  requirePermissions: vi.fn()
}));

vi.mock("@carbon/auth/client.server", () => ({
  getCarbonServiceRole: vi.fn()
}));

vi.mock("@carbon/form", () => ({
  validator: vi.fn()
}));

vi.mock("~/modules/shared", () => ({
  importPermissions: {
    customer: "sales"
  },
  importSchemas: {
    customer: {
      extend: vi.fn(() => ({
        safeParse: vi.fn()
      }))
    }
  },
  importCsv: vi.fn()
}));

describe("import.$tableId action smoke", () => {
  it("rejects unsupported table ids before permission check", async () => {
    await expect(
      action({
        request: new Request("http://localhost/import/unknown", {
          method: "POST",
          body: new FormData()
        }),
        params: { tableId: "unknown" }
      } as any)
    ).rejects.toThrow("Table not found in the list of supported tables");

    expect(notFound).toHaveBeenCalledWith(
      "Table not found in the list of supported tables"
    );
    expect(requirePermissions).not.toHaveBeenCalled();
  });

  it("rejects missing table ids", async () => {
    await expect(
      action({
        request: new Request("http://localhost/import", {
          method: "POST",
          body: new FormData()
        }),
        params: {}
      } as any)
    ).rejects.toThrow("No table ID provided");

    expect(notFound).toHaveBeenCalledWith("No table ID provided");
  });

  it("parses enumMappings json and forwards payload to importCsv", async () => {
    const modules = await import("~/modules/shared");
    const importCsv = vi.mocked(modules.importCsv);
    const importSchemas = modules.importSchemas as any;
    const schemaExtend = vi.mocked(importSchemas.customer.extend);
    const serviceRole = { role: "service-role" };
    const form = new FormData();
    form.set("filePath", "private/path.csv");
    form.set("name", "Customer Name");
    form.set(
      "enumMappings",
      JSON.stringify({
        customerStatusId: { Active: "status-active", Default: "status-active" }
      })
    );

    schemaExtend.mockReturnValue({ schema: true } as any);
    vi.mocked(validator).mockReturnValue({
      validate: vi.fn().mockResolvedValue({
        data: {
          filePath: "private/path.csv",
          name: "Customer Name",
          enumMappings: JSON.stringify({
            customerStatusId: {
              Active: "status-active",
              Default: "status-active"
            }
          })
        }
      })
    } as any);
    vi.mocked(requirePermissions).mockResolvedValue({
      companyId: "company-1",
      userId: "user-1"
    } as any);
    vi.mocked(getCarbonServiceRole).mockReturnValue(serviceRole as any);
    importCsv.mockResolvedValue({
      data: { inserted: 1, updated: 0, skipped: 0, errors: [] },
      error: null
    } as any);

    const result = await action({
      request: new Request("http://localhost/import/customer", {
        method: "POST",
        body: form
      }),
      params: { tableId: "customer" }
    } as any);

    expect(schemaExtend).toHaveBeenCalled();
    expect(validator).toHaveBeenCalledWith({ schema: true });
    expect(importCsv).toHaveBeenCalledWith(serviceRole, {
      table: "customer",
      filePath: "private/path.csv",
      columnMappings: { name: "Customer Name" },
      enumMappings: {
        customerStatusId: {
          Active: "status-active",
          Default: "status-active"
        }
      },
      companyId: "company-1",
      userId: "user-1"
    });
    expect(result).toEqual({
      success: true,
      message: "Import successful",
      inserted: 1,
      updated: 0,
      skipped: 0,
      errors: []
    });
  });
});
