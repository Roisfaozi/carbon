import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  fieldMappings,
  importPermissions,
  importSchemas
} from "./imports.models";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../../..");
const importCsvPath = resolve(
  repoRoot,
  "packages/database/supabase/functions/import-csv/index.ts"
);
const sharedServicePath = resolve(
  repoRoot,
  "apps/erp/app/modules/shared/shared.service.ts"
);

const importCsvSource = readFileSync(importCsvPath, "utf8");
const sharedServiceSource = readFileSync(sharedServicePath, "utf8");

function getSchemaKeys(table: keyof typeof importSchemas): string[] {
  const schema = importSchemas[table];
  return Object.keys(schema.shape).sort();
}

function getFieldMappingKeys(table: keyof typeof fieldMappings): string[] {
  return Object.keys(fieldMappings[table]).sort();
}

function getEdgeSupportedTables(): string[] {
  const match = importCsvSource.match(/table:\s*z\.enum\(\[([\s\S]*?)\]\)/);
  if (!match) {
    throw new Error("Could not find importCsvValidator table enum");
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
}

describe("CSV import contract", () => {
  it("keeps app import table registries aligned", () => {
    const mappingTables = Object.keys(fieldMappings).sort();
    const permissionTables = Object.keys(importPermissions).sort();
    const schemaTables = Object.keys(importSchemas).sort();

    expect(permissionTables).toEqual(mappingTables);
    expect(schemaTables).toEqual(mappingTables);
  });

  it("keeps field mappings and app schemas aligned per table", () => {
    const diffs = Object.keys(fieldMappings)
      .sort()
      .flatMap((table) => {
        const fieldKeys = getFieldMappingKeys(
          table as keyof typeof fieldMappings
        );
        const schemaKeys = getSchemaKeys(table as keyof typeof importSchemas);

        return [
          ...fieldKeys
            .filter((key) => !schemaKeys.includes(key))
            .map((key) => `${table}: fieldMappings-only:${key}`),
          ...schemaKeys
            .filter((key) => !fieldKeys.includes(key))
            .map((key) => `${table}: schema-only:${key}`)
        ];
      });

    expect(diffs).toEqual([]);
  });

  it("keeps process type options aligned with edge importer support", () => {
    expect(fieldMappings.process.processType.enumData.options).toEqual([
      "Inside",
      "Outside"
    ]);
  });

  it("types enumMappings in shared service as nested label-to-value records", () => {
    expect(sharedServiceSource).toContain(
      "enumMappings?: Record<string, Record<string, string>>;"
    );
  });

  it("keeps route-visible tables aligned with edge-supported tables", () => {
    expect(getEdgeSupportedTables()).toEqual(
      Object.keys(importPermissions).sort()
    );
  });

  it("keeps material field names aligned between app contract and edge importer", () => {
    const materialFieldKeys = getFieldMappingKeys("material");

    expect(materialFieldKeys).toEqual(
      expect.arrayContaining(["finish", "grade", "dimensions"])
    );
    expect(importCsvSource).toContain("finish: z.string().optional()");
    expect(importCsvSource).toContain("grade: z.string().optional()");
    expect(importCsvSource).toContain("dimensions: z.string().optional()");
    expect(importCsvSource).not.toContain("finishId");
    expect(importCsvSource).not.toContain("gradeId");
    expect(importCsvSource).not.toContain("dimensionId");
  });
});
