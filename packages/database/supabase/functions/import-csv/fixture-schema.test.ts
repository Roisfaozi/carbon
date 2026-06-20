import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  expectedScenarioSchema,
  goldenManifestSchema,
  referenceDataSchema,
} from "./fixture-schema.ts";

const here = dirname(fileURLToPath(import.meta.url));
const goldenRoot = resolve(here, "fixtures/golden/v1");

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8"));
}

test("golden fixture manifest is valid and excludes known unsupported tables", () => {
  const manifest = goldenManifestSchema.parse(
    readJson(resolve(goldenRoot, "manifest.json"))
  );

  assert.equal(manifest.version, 1);
  assert.ok(manifest.tables.includes("workCenter"));
  assert.ok(manifest.tables.includes("process"));
  assert.ok(manifest.tables.includes("material"));
  assert.ok(!manifest.tables.includes("methodMaterial"));
  assert.ok(!manifest.tables.includes("fixedAsset"));
});

test("golden fixture pack has csv and expected json for every declared table", () => {
  const manifest = goldenManifestSchema.parse(
    readJson(resolve(goldenRoot, "manifest.json"))
  );

  for (const table of manifest.tables) {
    assert.equal(existsSync(resolve(goldenRoot, `${table}.csv`)), true, `${table}.csv missing`);
    assert.equal(
      existsSync(resolve(goldenRoot, "expected", `${table}.json`)),
      true,
      `expected/${table}.json missing`
    );
  }
});

test("golden reference data includes required lookup foundations", () => {
  const referenceData = referenceDataSchema.parse(
    readJson(resolve(goldenRoot, "reference-data.json"))
  );

  assert.ok(referenceData.location.length > 0);
  assert.ok(referenceData.unitOfMeasure.length > 0);
  assert.ok(referenceData.materialSubstance.length > 0);
});

test("golden expected summary is valid and totals match per-table files", () => {
  const manifest = goldenManifestSchema.parse(
    readJson(resolve(goldenRoot, "manifest.json"))
  );
  const summary = expectedScenarioSchema.parse(
    readJson(resolve(goldenRoot, "expected", "summary.json"))
  );

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const table of manifest.tables) {
    const perTable = expectedScenarioSchema.parse(
      readJson(resolve(goldenRoot, "expected", `${table}.json`))
    );
    inserted += perTable.summary.inserted;
    updated += perTable.summary.updated;
    skipped += perTable.summary.skipped;
  }

  assert.equal(summary.summary.inserted, inserted);
  assert.equal(summary.summary.updated, updated);
  assert.equal(summary.summary.skipped, skipped);
});
