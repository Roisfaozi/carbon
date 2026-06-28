import assert from "node:assert/strict";
import test from "node:test";
import { buildDryRunReport } from "./migration-runner.ts";
import { carbonCanonicalProfile } from "./migration-source-profiles.ts";

test("buildDryRunReport only creates import requests for files present in request.files", () => {
  const report = buildDryRunReport({
    scenario: "subset-only-customer",
    profile: carbonCanonicalProfile,
    files: {
      "customer.csv": "id,name\nCUST-1,Acme\n"
    },
    companyId: "company-1",
    userId: "user-1",
    filePathPrefix: "migration/subset"
  });

  assert.deepEqual(report.importRequests, [
    {
      table: "customer",
      fileName: "customer.csv",
      filePath: "migration/subset/customer.csv",
      columnMappings: carbonCanonicalProfile.tables[0].columnMappings,
      enumMappings: carbonCanonicalProfile.tables[0].enumMappings,
      companyId: "company-1",
      userId: "user-1"
    }
  ]);
});
