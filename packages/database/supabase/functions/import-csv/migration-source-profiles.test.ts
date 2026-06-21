import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { goldenManifestSchema } from "./fixture-schema.ts";
import { carbonCanonicalProfile, tableExecutionOrder } from "./migration-source-profiles.ts";

const here = dirname(fileURLToPath(import.meta.url));
const goldenRoot = resolve(here, "fixtures/golden/v1");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("carbon canonical profile covers supported tables in execution order", () => {
  assert.deepEqual(tableExecutionOrder, [
    "customer",
    "supplier",
    "customerContact",
    "supplierContact",
    "part",
    "material",
    "tool",
    "fixture",
    "consumable",
    "workCenter",
    "process",
  ]);

  assert.deepEqual(
    carbonCanonicalProfile.tables.map((table) => table.table),
    tableExecutionOrder
  );
});

test("carbon canonical profile maps material contract fields by name", () => {
  const material = carbonCanonicalProfile.tables.find((table) => table.table === "material");

  assert.ok(material);
  assert.equal(material.fileName, "material.csv");
  assert.equal(material.columnMappings.finish, "finish");
  assert.equal(material.columnMappings.grade, "grade");
  assert.equal(material.columnMappings.dimensions, "dimensions");
  assert.equal("finishId" in material.columnMappings, false);
  assert.equal("gradeId" in material.columnMappings, false);
  assert.equal("dimensionId" in material.columnMappings, false);
});

test("carbon canonical profile covers exactly the golden manifest tables", () => {
  const manifest = goldenManifestSchema.parse(
    readJson(resolve(goldenRoot, "manifest.json"))
  );

  assert.deepEqual(
    [...carbonCanonicalProfile.tables.map((table) => table.table)].sort(),
    [...manifest.tables].sort()
  );
});
