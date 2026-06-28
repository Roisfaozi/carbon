import assert from "node:assert/strict";
import test from "node:test";
import { permissionForImportTable } from "./permissions.ts";

test("permissionForImportTable matches import table permission ownership", () => {
  assert.equal(permissionForImportTable("customer"), "sales");
  assert.equal(permissionForImportTable("customerContact"), "sales");
  assert.equal(permissionForImportTable("supplier"), "purchasing");
  assert.equal(permissionForImportTable("supplierContact"), "purchasing");
  assert.equal(permissionForImportTable("part"), "parts");
  assert.equal(permissionForImportTable("material"), "parts");
  assert.equal(permissionForImportTable("tool"), "parts");
  assert.equal(permissionForImportTable("fixture"), "parts");
  assert.equal(permissionForImportTable("consumable"), "parts");
  assert.equal(permissionForImportTable("workCenter"), "production");
  assert.equal(permissionForImportTable("process"), "production");
});
