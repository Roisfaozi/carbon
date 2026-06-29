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

test("carbon canonical profile maps supplier fields needed by migration runs", () => {
  const supplier = carbonCanonicalProfile.tables.find((table) => table.table === "supplier");

  assert.ok(supplier);
  assert.equal(supplier.fileName, "supplier.csv");
  assert.deepEqual(supplier.requiredFields, ["id", "name"]);
  assert.equal(supplier.columnMappings.supplierStatus, "supplierStatus");
  assert.equal(supplier.columnMappings.locationName, "locationName");
  assert.equal(supplier.columnMappings.paymentTermId, "paymentTermId");
  assert.equal(supplier.columnMappings.shippingMethodId, "shippingMethodId");
  assert.equal(supplier.columnMappings.incoterm, "incoterm");
  assert.equal(supplier.columnMappings.incotermLocation, "incotermLocation");
});

test("carbon canonical profile maps work center fields by name", () => {
  const workCenter = carbonCanonicalProfile.tables.find(
    (table) => table.table === "workCenter"
  );

  assert.ok(workCenter);
  assert.equal(workCenter.fileName, "workCenter.csv");
  assert.deepEqual(workCenter.requiredFields, [
    "id",
    "name",
    "description",
    "locationId",
  ]);
  assert.equal(
    workCenter.columnMappings.defaultStandardFactor,
    "defaultStandardFactor"
  );
  assert.equal(workCenter.columnMappings.laborRate, "laborRate");
  assert.equal(workCenter.columnMappings.machineRate, "machineRate");
  assert.equal(workCenter.columnMappings.overheadRate, "overheadRate");
  assert.equal(workCenter.columnMappings.locationId, "locationId");
});

test("carbon canonical profile maps process fields by name", () => {
  const process = carbonCanonicalProfile.tables.find((table) => table.table === "process");

  assert.ok(process);
  assert.equal(process.fileName, "process.csv");
  assert.deepEqual(process.requiredFields, [
    "id",
    "name",
    "processType",
    "defaultStandardFactor",
  ]);
  assert.equal(process.columnMappings.processType, "processType");
  assert.equal(
    process.columnMappings.defaultStandardFactor,
    "defaultStandardFactor"
  );
  assert.equal(process.columnMappings.completeAllOnScan, "completeAllOnScan");
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
