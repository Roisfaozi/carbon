import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMissingEnumDefaults,
  buildAddressFields,
  extractPartnerExtensions,
  hasAnyAddressField,
  mapCsvRecords,
  nullifyEmptyStrings,
  parsePermissiveCsv,
  prepareMappedRecords,
} from "./import-runner.ts";

test("parsePermissiveCsv tolerates uneven rows and quoted commas", () => {
  const csv = [
    "id,name,city",
    '1,"Acme, Inc",Austin,EXTRA',
    "2,Globex",
  ].join("\n");

  assert.deepEqual(parsePermissiveCsv(csv), [
    { id: "1", name: "Acme, Inc", city: "Austin" },
    { id: "2", name: "Globex", city: "" },
  ]);
});

test("mapCsvRecords applies enum mappings, default fallback, and ignores N/A columns", () => {
  const rows = [
    { Supplier: "Acme", Status: "A", Ignored: "nope" },
    { Supplier: "Globex", Status: "Unknown", Ignored: "still-nope" },
  ];

  assert.deepEqual(
    mapCsvRecords(rows, {
      name: "Supplier",
      supplierStatus: "Status",
      notes: "N/A",
    }, {
      supplierStatus: {
        A: "Active",
        Default: "Pending",
      },
    }),
    [
      { name: "Acme", supplierStatus: "Active" },
      { name: "Globex", supplierStatus: "Pending" },
    ]
  );
});

test("applyMissingEnumDefaults backfills mapped records when enum field has no source column", () => {
  const mappedRecords = [{ name: "Acme" }, { name: "Globex" }];

  assert.deepEqual(
    applyMissingEnumDefaults(mappedRecords, {
      supplierStatus: { Default: "Pending" },
      processType: { Default: "Inside" },
    }),
    [
      { name: "Acme", supplierStatus: "Pending", processType: "Inside" },
      { name: "Globex", supplierStatus: "Pending", processType: "Inside" },
    ]
  );
});

test("prepareMappedRecords composes mapping and missing-enum default backfill", () => {
  const rows = [
    { Supplier: "Acme", Status: "A" },
    { Supplier: "Globex", Status: "Unknown" },
  ];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      supplierStatus: "Status",
      processType: "N/A",
    }, {
      supplierStatus: {
        A: "Active",
        Default: "Pending",
      },
      processType: {
        Default: "Inside",
      },
    }),
    [
      { name: "Acme", supplierStatus: "Active", processType: "Inside" },
      { name: "Globex", supplierStatus: "Pending", processType: "Inside" },
    ]
  );
});

test("prepareMappedRecords returns empty list when CSV has no rows", () => {
  assert.deepEqual(
    prepareMappedRecords([], {
      name: "Supplier",
    }, {
      supplierStatus: { Default: "Pending" },
    }),
    []
  );
});

test("prepareMappedRecords preserves explicit mapped enum values instead of default-backfilling them", () => {
  const rows = [{ Name: "Drilling", Process: "Outside" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      processType: "Process",
    }, {
      processType: {
        Outside: "Outside",
        Default: "Inside",
      },
    }),
    [{ name: "Drilling", processType: "Outside" }]
  );
});

test("prepareMappedRecords fills missing direct-mapped columns with empty strings", () => {
  const rows = [{ Supplier: "Acme" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      website: "Website",
    }),
    [{ name: "Acme", website: "" }]
  );
});

test("prepareMappedRecords ignores empty column mapping values", () => {
  const rows = [{ Supplier: "Acme", Notes: "hello" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      notes: "",
    }),
    [{ name: "Acme" }]
  );
});

test("prepareMappedRecords ignores N/A column mappings", () => {
  const rows = [{ Supplier: "Acme", Notes: "hello" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      notes: "N/A",
    }),
    [{ name: "Acme" }]
  );
});

test("prepareMappedRecords backfills enum defaults only for keys missing from first mapped row", () => {
  const mappedRecords = prepareMappedRecords(
    [{ Name: "Alpha" }, { Name: "Beta" }],
    { name: "Name", processType: "N/A" },
    {
      processType: { Default: "Inside" },
      supplierStatus: { Default: "Pending" },
    }
  );

  assert.deepEqual(mappedRecords, [
    { name: "Alpha", processType: "Inside", supplierStatus: "Pending" },
    { name: "Beta", processType: "Inside", supplierStatus: "Pending" },
  ]);
});

test("prepareMappedRecords keeps explicit enum mapping result when source value is blank but mapping exists", () => {
  const rows = [{ Name: "Alpha", Status: "" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        "": "Pending",
        Default: "Pending",
      },
    }),
    [{ name: "Alpha", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords uses default when enum source value is unmapped", () => {
  const rows = [{ Name: "Alpha", Status: "Legacy" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        Active: "Active",
        Default: "Pending",
      },
    }),
    [{ name: "Alpha", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords leaves rows unchanged when enumMappings is omitted", () => {
  const rows = [{ Name: "Alpha" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
    }),
    [{ name: "Alpha" }]
  );
});

test("prepareMappedRecords does not synthesize defaults when enum mapping object is empty", () => {
  const rows = [{ Name: "Alpha" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
    }, {}),
    [{ name: "Alpha" }]
  );
});

test("prepareMappedRecords handles multiple enum-backed fields in one pass", () => {
  const rows = [{ Name: "Alpha", Status: "A", Process: "" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "Status",
      processType: "Process",
    }, {
      supplierStatus: {
        A: "Active",
        Default: "Pending",
      },
      processType: {
        "": "Inside",
        Default: "Inside",
      },
    }),
    [{ name: "Alpha", supplierStatus: "Active", processType: "Inside" }]
  );
});

test("prepareMappedRecords keeps backfilled defaults stable across later rows", () => {
  const rows = [{ Name: "Alpha" }, { Name: "Beta", Ignored: "x" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      processType: "N/A",
    }, {
      processType: {
        Default: "Inside",
      },
    }),
    [
      { name: "Alpha", processType: "Inside" },
      { name: "Beta", processType: "Inside" },
    ]
  );
});

test("prepareMappedRecords leaves empty input empty even with enum defaults", () => {
  assert.deepEqual(
    prepareMappedRecords([], { processType: "N/A" }, { processType: { Default: "Inside" } }),
    []
  );
});

test("prepareMappedRecords can be used as the importer's one-step mapping helper", () => {
  const rows = [{ Supplier: "Acme", Status: "A" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      supplierStatus: "Status",
      notes: "N/A",
    }, {
      supplierStatus: {
        A: "Active",
        Default: "Pending",
      },
    }),
    [{ name: "Acme", supplierStatus: "Active" }]
  );
});

test("prepareMappedRecords does not overwrite already-mapped enum key during default backfill", () => {
  const rows = [{ Name: "Proc", Type: "Inside" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      processType: "Type",
    }, {
      processType: {
        Inside: "Inside",
        Default: "Outside",
      },
    }),
    [{ name: "Proc", processType: "Inside" }]
  );
});

test("prepareMappedRecords treats missing source cell as empty string for non-enum mapping", () => {
  const rows = [{ Name: "Proc" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      city: "City",
    }),
    [{ name: "Proc", city: "" }]
  );
});

test("prepareMappedRecords treats missing source cell as default for enum mapping", () => {
  const rows = [{ Name: "Proc" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        Default: "Pending",
      },
    }),
    [{ name: "Proc", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords skips enum default backfill when first row already contains mapped key", () => {
  const rows = [{ Name: "Proc", Status: "A" }, { Name: "Other", Status: "" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        A: "Active",
        "": "Pending",
        Default: "Pending",
      },
    }),
    [
      { name: "Proc", supplierStatus: "Active" },
      { name: "Other", supplierStatus: "Pending" },
    ]
  );
});

test("prepareMappedRecords backfills defaults for all rows when enum key is entirely unmapped", () => {
  const rows = [{ Name: "Proc" }, { Name: "Other" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "N/A",
    }, {
      supplierStatus: {
        Default: "Pending",
      },
    }),
    [
      { name: "Proc", supplierStatus: "Pending" },
      { name: "Other", supplierStatus: "Pending" },
    ]
  );
});

test("prepareMappedRecords ignores unrelated CSV columns", () => {
  const rows = [{ Name: "Proc", Extra: "ignored" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
    }),
    [{ name: "Proc" }]
  );
});

test("prepareMappedRecords can combine enum defaults with direct empty-string mapping", () => {
  const rows = [{ Name: "Proc" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      website: "Website",
      processType: "N/A",
    }, {
      processType: {
        Default: "Inside",
      },
    }),
    [{ name: "Proc", website: "", processType: "Inside" }]
  );
});

test("prepareMappedRecords honors explicit enum value over Default when both exist", () => {
  const rows = [{ Name: "Proc", Status: "A" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        A: "Active",
        Default: "Pending",
      },
    }),
    [{ name: "Proc", supplierStatus: "Active" }]
  );
});

test("prepareMappedRecords uses Default when enum mapping misses provided CSV value", () => {
  const rows = [{ Name: "Proc", Status: "Old" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        Active: "Active",
        Default: "Pending",
      },
    }),
    [{ name: "Proc", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords supports blank-string enum keys", () => {
  const rows = [{ Name: "Proc", Status: "" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        "": "Pending",
        Default: "Pending",
      },
    }),
    [{ name: "Proc", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords remains deterministic across identical inputs", () => {
  const rows = [{ Name: "Proc", Status: "A" }];
  const args: Parameters<typeof prepareMappedRecords> = [
    rows,
    { name: "Name", supplierStatus: "Status" },
    { supplierStatus: { A: "Active", Default: "Pending" } },
  ];

  assert.deepEqual(prepareMappedRecords(...args), prepareMappedRecords(...args));
});

test("prepareMappedRecords does not mutate source rows", () => {
  const rows = [{ Name: "Proc", Status: "A" }];

  void prepareMappedRecords(rows, {
    name: "Name",
    supplierStatus: "Status",
  }, {
    supplierStatus: { A: "Active", Default: "Pending" },
  });

  assert.deepEqual(rows, [{ Name: "Proc", Status: "A" }]);
});

test("prepareMappedRecords does not mutate input enum mappings", () => {
  const enumMappings = { supplierStatus: { A: "Active", Default: "Pending" } };

  void prepareMappedRecords([{ Name: "Proc", Status: "Old" }], {
    name: "Name",
    supplierStatus: "Status",
  }, enumMappings);

  assert.deepEqual(enumMappings, {
    supplierStatus: { A: "Active", Default: "Pending" },
  });
});

test("prepareMappedRecords does not mutate column mappings", () => {
  const columnMappings = { name: "Name", supplierStatus: "Status" };

  void prepareMappedRecords([{ Name: "Proc", Status: "A" }], columnMappings, {
    supplierStatus: { A: "Active", Default: "Pending" },
  });

  assert.deepEqual(columnMappings, { name: "Name", supplierStatus: "Status" });
});

test("prepareMappedRecords supports mapping many rows consistently", () => {
  const rows = [
    { Name: "A", Status: "A" },
    { Name: "B", Status: "Old" },
    { Name: "C", Status: "" },
  ];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        A: "Active",
        "": "Pending",
        Default: "Pending",
      },
    }),
    [
      { name: "A", supplierStatus: "Active" },
      { name: "B", supplierStatus: "Pending" },
      { name: "C", supplierStatus: "Pending" },
    ]
  );
});

test("prepareMappedRecords can backfill two missing enum columns at once", () => {
  const rows = [{ Name: "A" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "N/A",
      processType: "N/A",
    }, {
      supplierStatus: { Default: "Pending" },
      processType: { Default: "Inside" },
    }),
    [{ name: "A", supplierStatus: "Pending", processType: "Inside" }]
  );
});

test("prepareMappedRecords leaves unrelated rows alone when adding default enum columns", () => {
  const rows = [{ Name: "A" }, { Name: "B" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      processType: "N/A",
    }, {
      processType: { Default: "Inside" },
    }),
    [
      { name: "A", processType: "Inside" },
      { name: "B", processType: "Inside" },
    ]
  );
});

test("prepareMappedRecords applies direct mapping and enum mapping together", () => {
  const rows = [{ Name: "A", City: "Austin", Status: "A" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      city: "City",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        A: "Active",
        Default: "Pending",
      },
    }),
    [{ name: "A", city: "Austin", supplierStatus: "Active" }]
  );
});

test("prepareMappedRecords uses empty string when direct mapping source cell missing on later rows", () => {
  const rows = [{ Name: "A", City: "Austin" }, { Name: "B" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      city: "City",
    }),
    [
      { name: "A", city: "Austin" },
      { name: "B", city: "" },
    ]
  );
});

test("prepareMappedRecords can map enum from later rows without affecting first-row backfill decision", () => {
  const rows = [{ Name: "A" }, { Name: "B", Status: "A" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        A: "Active",
        Default: "Pending",
      },
    }),
    [
      { name: "A", supplierStatus: "Pending" },
      { name: "B", supplierStatus: "Active" },
    ]
  );
});

test("prepareMappedRecords keeps mapped keys stringly-typed like importer expects", () => {
  const rows = [{ Name: "A", Rate: "12.5" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      laborRate: "Rate",
    }),
    [{ name: "A", laborRate: "12.5" }]
  );
});

test("prepareMappedRecords handles blank csv text mapped through parser and mapper flow", () => {
  const parsed = parsePermissiveCsv("Name,Status\nA,\n");

  assert.deepEqual(
    prepareMappedRecords(parsed, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        "": "Pending",
        Default: "Pending",
      },
    }),
    [{ name: "A", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords can be chained after parser for uneven CSV rows", () => {
  const parsed = parsePermissiveCsv('Name,Status\nA,A,EXTRA\nB\n');

  assert.deepEqual(
    prepareMappedRecords(parsed, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        A: "Active",
        Default: "Pending",
      },
    }),
    [
      { name: "A", supplierStatus: "Active" },
      { name: "B", supplierStatus: "Pending" },
    ]
  );
});

test("prepareMappedRecords mirrors importer behavior for missing enum-only field", () => {
  const rows = [{ Supplier: "Acme" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      supplierStatus: "N/A",
    }, {
      supplierStatus: {
        Default: "Pending",
      },
    }),
    [{ name: "Acme", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords mirrors importer behavior for mixed enum and direct mappings", () => {
  const rows = [{ Supplier: "Acme", Status: "A", Website: "https://acme.test" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      supplierStatus: "Status",
      website: "Website",
    }, {
      supplierStatus: {
        A: "Active",
        Default: "Pending",
      },
    }),
    [{
      name: "Acme",
      supplierStatus: "Active",
      website: "https://acme.test",
    }]
  );
});

test("prepareMappedRecords mirrors importer behavior for explicit blank direct field", () => {
  const rows = [{ Supplier: "Acme", Website: "" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      website: "Website",
    }),
    [{ name: "Acme", website: "" }]
  );
});

test("prepareMappedRecords mirrors importer behavior for enum default-only map", () => {
  const rows = [{ Supplier: "Acme", Status: "Legacy" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      supplierStatus: "Status",
    }, {
      supplierStatus: {
        Default: "Pending",
      },
    }),
    [{ name: "Acme", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords mirrors importer behavior when all enum columns are N/A", () => {
  const rows = [{ Supplier: "Acme" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      supplierStatus: "N/A",
      processType: "N/A",
    }, {
      supplierStatus: { Default: "Pending" },
      processType: { Default: "Inside" },
    }),
    [{ name: "Acme", supplierStatus: "Pending", processType: "Inside" }]
  );
});

test("prepareMappedRecords mirrors importer behavior when one enum mapped and one backfilled", () => {
  const rows = [{ Supplier: "Acme", Status: "A" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      supplierStatus: "Status",
      processType: "N/A",
    }, {
      supplierStatus: { A: "Active", Default: "Pending" },
      processType: { Default: "Inside" },
    }),
    [{ name: "Acme", supplierStatus: "Active", processType: "Inside" }]
  );
});

test("prepareMappedRecords mirrors importer behavior with no mappings except N/A", () => {
  const rows = [{ Supplier: "Acme" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      notes: "N/A",
    }, {
      notes: { Default: "" },
    }),
    [{ notes: "" }]
  );
});

test("prepareMappedRecords mirrors importer behavior when row source key absent", () => {
  const rows = [{ Supplier: "Acme" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Supplier",
      city: "City",
      supplierStatus: "Status",
    }, {
      supplierStatus: { Default: "Pending" },
    }),
    [{ name: "Acme", city: "", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords mirrors importer behavior when parser returns empty rows", () => {
  assert.deepEqual(prepareMappedRecords(parsePermissiveCsv(""), { name: "Name" }), []);
});

test("prepareMappedRecords provides exact one-step behavior needed by edge importer refactor", () => {
  const parsed = [
    { Supplier: "Acme", Status: "A" },
    { Supplier: "Globex", Status: "Unknown" },
  ];

  assert.deepEqual(
    prepareMappedRecords(parsed, {
      name: "Supplier",
      supplierStatus: "Status",
      processType: "N/A",
    }, {
      supplierStatus: { A: "Active", Default: "Pending" },
      processType: { Default: "Inside" },
    }),
    [
      { name: "Acme", supplierStatus: "Active", processType: "Inside" },
      { name: "Globex", supplierStatus: "Pending", processType: "Inside" },
    ]
  );
});

test("prepareMappedRecords returns fresh row objects", () => {
  const rows = [{ Name: "A" }];
  const result = prepareMappedRecords(rows, { name: "Name" });

  assert.notStrictEqual(result[0], rows[0]);
});

test("prepareMappedRecords returns fresh array", () => {
  const rows = [{ Name: "A" }];
  const result = prepareMappedRecords(rows, { name: "Name" });

  assert.notStrictEqual(result, rows);
});

test("prepareMappedRecords keeps parser behavior intact for row-width mismatch cases", () => {
  const parsed = parsePermissiveCsv('Name,Status,City\nA,A,Austin,EXTRA\nB\n');
  assert.deepEqual(
    prepareMappedRecords(parsed, {
      name: "Name",
      supplierStatus: "Status",
      city: "City",
    }, {
      supplierStatus: { A: "Active", Default: "Pending" },
    }),
    [
      { name: "A", supplierStatus: "Active", city: "Austin" },
      { name: "B", supplierStatus: "Pending", city: "" },
    ]
  );
});

test("prepareMappedRecords keeps direct empty values as empty strings instead of undefined", () => {
  const rows = [{ Name: "A", City: "" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      city: "City",
    }),
    [{ name: "A", city: "" }]
  );
});

test("prepareMappedRecords backfills enum defaults after direct mapping stage", () => {
  const rows = [{ Name: "A", City: "Austin" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      city: "City",
      supplierStatus: "N/A",
    }, {
      supplierStatus: { Default: "Pending" },
    }),
    [{ name: "A", city: "Austin", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords keeps explicit enum empty mapping over Default after direct stage", () => {
  const rows = [{ Name: "A", Status: "" }];

  assert.deepEqual(
    prepareMappedRecords(rows, {
      name: "Name",
      supplierStatus: "Status",
    }, {
      supplierStatus: { "": "Pending", Default: "Other" },
    }),
    [{ name: "A", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords handles single-row N/A-only defaults", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Name: "A" }], { processType: "N/A" }, { processType: { Default: "Inside" } }),
    [{ processType: "Inside" }]
  );
});

test("prepareMappedRecords handles mixed N/A and direct fields with missing columns", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Name: "A" }], { name: "Name", city: "City", processType: "N/A" }, { processType: { Default: "Inside" } }),
    [{ name: "A", city: "", processType: "Inside" }]
  );
});

test("prepareMappedRecords handles direct field present and enum absent", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Name: "A", City: "Austin" }], { name: "Name", city: "City", processType: "N/A" }, { processType: { Default: "Inside" } }),
    [{ name: "A", city: "Austin", processType: "Inside" }]
  );
});

test("prepareMappedRecords handles multiple rows with direct field absent and enum absent", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Name: "A" }, { Name: "B" }], { name: "Name", city: "City", processType: "N/A" }, { processType: { Default: "Inside" } }),
    [
      { name: "A", city: "", processType: "Inside" },
      { name: "B", city: "", processType: "Inside" },
    ]
  );
});

test("prepareMappedRecords preserves order", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Name: "B" }, { Name: "A" }], { name: "Name" }),
    [{ name: "B" }, { name: "A" }]
  );
});

test("prepareMappedRecords keeps string outputs for enum defaults", () => {
  assert.equal(
    typeof prepareMappedRecords([{ Name: "A" }], { processType: "N/A" }, { processType: { Default: "Inside" } })[0].processType,
    "string"
  );
});

test("prepareMappedRecords keeps string outputs for direct mapping", () => {
  assert.equal(
    typeof prepareMappedRecords([{ Name: "A" }], { name: "Name" })[0].name,
    "string"
  );
});

test("prepareMappedRecords keeps string outputs for missing direct mapping cells", () => {
  assert.equal(
    typeof prepareMappedRecords([{ Name: "A" }], { city: "City" })[0].city,
    "string"
  );
});

test("prepareMappedRecords behaves deterministically with repeated call chain", () => {
  const rows = [{ Name: "A", Status: "A" }];
  const first = prepareMappedRecords(rows, { name: "Name", supplierStatus: "Status" }, { supplierStatus: { A: "Active", Default: "Pending" } });
  const second = prepareMappedRecords(rows, { name: "Name", supplierStatus: "Status" }, { supplierStatus: { A: "Active", Default: "Pending" } });

  assert.deepEqual(first, second);
});

test("prepareMappedRecords supports empty Default string", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Name: "A" }], { supplierStatus: "N/A" }, { supplierStatus: { Default: "" } }),
    [{ supplierStatus: "" }]
  );
});

test("prepareMappedRecords ignores rows' unrelated extra keys consistently", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Name: "A", Extra: "x" }, { Name: "B", Extra: "y" }], { name: "Name" }),
    [{ name: "A" }, { name: "B" }]
  );
});

test("prepareMappedRecords handles parser output with empty-string header values by direct lookup", () => {
  const parsed = [{ Name: "A", "": "x" }];
  assert.deepEqual(prepareMappedRecords(parsed, { name: "Name" }), [{ name: "A" }]);
});

test("prepareMappedRecords keeps backfilled enum key insertion deterministic", () => {
  const result = prepareMappedRecords([{ Name: "A" }], { name: "Name", processType: "N/A" }, { processType: { Default: "Inside" } });
  assert.deepEqual(Object.keys(result[0]), ["name", "processType"]);
});

test("prepareMappedRecords can model importer behavior for route-supplied enumMappings object", () => {
  const enumMappings = {
    supplierStatus: {
      ActiveLabel: "Active",
      Default: "Pending",
    },
  };
  assert.deepEqual(
    prepareMappedRecords([{ Supplier: "A", Status: "ActiveLabel" }], { name: "Supplier", supplierStatus: "Status" }, enumMappings),
    [{ name: "A", supplierStatus: "Active" }]
  );
});

test("prepareMappedRecords can model importer behavior for route-supplied default-only enumMappings object", () => {
  const enumMappings = {
    supplierStatus: {
      Default: "Pending",
    },
  };
  assert.deepEqual(
    prepareMappedRecords([{ Supplier: "A", Status: "Legacy" }], { name: "Supplier", supplierStatus: "Status" }, enumMappings),
    [{ name: "A", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords keeps parse→map→default composition compact", () => {
  const csv = 'Supplier,Status\nA,A\nB,Legacy\n';
  assert.deepEqual(
    prepareMappedRecords(parsePermissiveCsv(csv), { name: "Supplier", supplierStatus: "Status" }, { supplierStatus: { A: "Active", Default: "Pending" } }),
    [
      { name: "A", supplierStatus: "Active" },
      { name: "B", supplierStatus: "Pending" },
    ]
  );
});

test("prepareMappedRecords supports enum backfill on parser-produced empty dataset without crashing", () => {
  assert.deepEqual(
    prepareMappedRecords(parsePermissiveCsv(""), { supplierStatus: "N/A" }, { supplierStatus: { Default: "Pending" } }),
    []
  );
});

test("prepareMappedRecords can be dropped into importer without changing summary-facing record shapes", () => {
  assert.deepEqual(
    prepareMappedRecords([{ id: "SUP-1", Name: "A" }], { id: "id", name: "Name" }),
    [{ id: "SUP-1", name: "A" }]
  );
});

test("prepareMappedRecords keeps exact row count", () => {
  const rows = [{ Name: "A" }, { Name: "B" }, { Name: "C" }];
  assert.equal(prepareMappedRecords(rows, { name: "Name" }).length, 3);
});

test("prepareMappedRecords keeps exact one-row count", () => {
  assert.equal(prepareMappedRecords([{ Name: "A" }], { name: "Name" }).length, 1);
});

test("prepareMappedRecords keeps zero-row count", () => {
  assert.equal(prepareMappedRecords([], { name: "Name" }).length, 0);
});

test("prepareMappedRecords handles row objects with multiple unmapped source keys", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Name: "A", One: "1", Two: "2" }], { name: "Name" }),
    [{ name: "A" }]
  );
});

test("prepareMappedRecords maps exact source key names case-sensitively like importer currently does", () => {
  assert.deepEqual(
    prepareMappedRecords([{ name: "A" }], { name: "Name" }),
    [{ name: "" }]
  );
});

test("prepareMappedRecords still default-backfills enum keys when direct-mapped source key case mismatches", () => {
  assert.deepEqual(
    prepareMappedRecords([{ status: "A" }], { supplierStatus: "Status" }, { supplierStatus: { A: "Active", Default: "Pending" } }),
    [{ supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords handles complete importer-like supplier row", () => {
  const row = {
    Supplier: "Acme",
    Status: "A",
    Website: "https://acme.test",
    Phone: "555-0101",
  };

  assert.deepEqual(
    prepareMappedRecords([row], {
      name: "Supplier",
      supplierStatus: "Status",
      website: "Website",
      phone: "Phone",
    }, {
      supplierStatus: { A: "Active", Default: "Pending" },
    }),
    [{
      name: "Acme",
      supplierStatus: "Active",
      website: "https://acme.test",
      phone: "555-0101",
    }]
  );
});

test("prepareMappedRecords handles complete importer-like work center row with no enums", () => {
  const row = {
    ID: "WC-1",
    Name: "Mill",
    Labor: "50",
  };

  assert.deepEqual(
    prepareMappedRecords([row], {
      id: "ID",
      name: "Name",
      laborRate: "Labor",
    }),
    [{ id: "WC-1", name: "Mill", laborRate: "50" }]
  );
});

test("prepareMappedRecords handles importer-like process row with enum and default", () => {
  const row = {
    ID: "P-1",
    Name: "Mill",
    Process: "Outside",
  };

  assert.deepEqual(
    prepareMappedRecords([row], {
      id: "ID",
      name: "Name",
      processType: "Process",
      completeAllOnScan: "N/A",
    }, {
      processType: { Outside: "Outside", Default: "Inside" },
      completeAllOnScan: { Default: "false" },
    }),
    [{ id: "P-1", name: "Mill", processType: "Outside", completeAllOnScan: "false" }]
  );
});

test("prepareMappedRecords keeps behavior stable for current edge-function refactor seam", () => {
  const rows = [{ Supplier: "Acme", Status: "Legacy" }];
  const result = prepareMappedRecords(rows, { name: "Supplier", supplierStatus: "Status" }, { supplierStatus: { Default: "Pending" } });
  assert.deepEqual(result, [{ name: "Acme", supplierStatus: "Pending" }]);
});

test("prepareMappedRecords supports route-generated enum mappings that include Default and explicit labels", () => {
  const mappings = { processType: { Inside: "Inside", Default: "Inside" } };
  assert.deepEqual(
    prepareMappedRecords([{ Process: "Inside" }], { processType: "Process" }, mappings),
    [{ processType: "Inside" }]
  );
});

test("prepareMappedRecords supports route-generated enum mappings when explicit label missing", () => {
  const mappings = { processType: { Default: "Inside" } };
  assert.deepEqual(
    prepareMappedRecords([{ Process: "Legacy" }], { processType: "Process" }, mappings),
    [{ processType: "Inside" }]
  );
});

test("prepareMappedRecords supports direct-only record shapes needed by importer", () => {
  assert.deepEqual(
    prepareMappedRecords([{ ID: "C-1", Name: "Acme" }], { id: "ID", name: "Name" }),
    [{ id: "C-1", name: "Acme" }]
  );
});

test("prepareMappedRecords supports enum-only record shapes needed by importer", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Status: "A" }], { supplierStatus: "Status" }, { supplierStatus: { A: "Active", Default: "Pending" } }),
    [{ supplierStatus: "Active" }]
  );
});

test("prepareMappedRecords supports mixed enum-only and N/A-backed defaults", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Status: "A" }], { supplierStatus: "Status", processType: "N/A" }, { supplierStatus: { A: "Active", Default: "Pending" }, processType: { Default: "Inside" } }),
    [{ supplierStatus: "Active", processType: "Inside" }]
  );
});

test("prepareMappedRecords remains minimal seam for importer extraction", () => {
  const rows = [{ Supplier: "Acme", Status: "A" }];
  const columnMappings = { name: "Supplier", supplierStatus: "Status" };
  const enumMappings = { supplierStatus: { A: "Active", Default: "Pending" } };

  assert.deepEqual(prepareMappedRecords(rows, columnMappings, enumMappings), [
    { name: "Acme", supplierStatus: "Active" },
  ]);
});

test("prepareMappedRecords supports exact enum default backfill semantics from importer", () => {
  const rows = [{ Supplier: "Acme", Status: "A" }];
  const columnMappings = { name: "Supplier", supplierStatus: "Status", completeAllOnScan: "N/A" };
  const enumMappings = {
    supplierStatus: { A: "Active", Default: "Pending" },
    completeAllOnScan: { Default: "false" },
  };

  assert.deepEqual(prepareMappedRecords(rows, columnMappings, enumMappings), [
    { name: "Acme", supplierStatus: "Active", completeAllOnScan: "false" },
  ]);
});

test("prepareMappedRecords ends step 2 extraction seam with stable behavior", () => {
  const csv = 'Supplier,Status\nAcme,A\n';
  assert.deepEqual(
    prepareMappedRecords(parsePermissiveCsv(csv), { name: "Supplier", supplierStatus: "Status" }, { supplierStatus: { A: "Active", Default: "Pending" } }),
    [{ name: "Acme", supplierStatus: "Active" }]
  );
});

test("prepareMappedRecords can be reused by edge importer once index.ts wiring moves over", () => {
  const rows = [{ Name: "Acme" }];
  assert.deepEqual(
    prepareMappedRecords(rows, { name: "Name", processType: "N/A" }, { processType: { Default: "Inside" } }),
    [{ name: "Acme", processType: "Inside" }]
  );
});

test("prepareMappedRecords produces identical result to map+backfill manual composition", () => {
  const rows = [{ Supplier: "Acme", Status: "A" }, { Supplier: "Globex", Status: "Legacy" }];
  const columnMappings = { name: "Supplier", supplierStatus: "Status", processType: "N/A" };
  const enumMappings = {
    supplierStatus: { A: "Active", Default: "Pending" },
    processType: { Default: "Inside" },
  };

  const manual = applyMissingEnumDefaults(mapCsvRecords(rows, columnMappings, enumMappings), enumMappings);
  const composed = prepareMappedRecords(rows, columnMappings, enumMappings);

  assert.deepEqual(composed, manual);
});

test("prepareMappedRecords keeps composition no-op for already-complete enum rows", () => {
  const rows = [{ Process: "Inside" }];
  assert.deepEqual(
    prepareMappedRecords(rows, { processType: "Process" }, { processType: { Inside: "Inside", Default: "Outside" } }),
    [{ processType: "Inside" }]
  );
});

test("prepareMappedRecords keeps composition no-op when no enum defaults missing", () => {
  const rows = [{ Process: "Inside", Status: "A" }];
  assert.deepEqual(
    prepareMappedRecords(rows, { processType: "Process", supplierStatus: "Status" }, { processType: { Inside: "Inside", Default: "Outside" }, supplierStatus: { A: "Active", Default: "Pending" } }),
    [{ processType: "Inside", supplierStatus: "Active" }]
  );
});

test("prepareMappedRecords ends with compact seam test", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Supplier: "Acme" }], { name: "Supplier" }),
    [{ name: "Acme" }]
  );
});

test("prepareMappedRecords still supports helper-only extraction before full runner exists", () => {
  assert.deepEqual(
    prepareMappedRecords([{ Supplier: "Acme", Status: "Legacy" }], { name: "Supplier", supplierStatus: "Status" }, { supplierStatus: { Default: "Pending" } }),
    [{ name: "Acme", supplierStatus: "Pending" }]
  );
});

test("prepareMappedRecords supports row count equality for importer summaries", () => {
  const rows = [{ Supplier: "A" }, { Supplier: "B" }];
  assert.equal(prepareMappedRecords(rows, { name: "Supplier" }).length, rows.length);
});

test("nullifyEmptyStrings converts only empty strings to undefined", () => {
  assert.deepEqual(nullifyEmptyStrings({ a: "", b: "x", c: 0, d: null }), {
    a: undefined,
    b: "x",
    c: 0,
    d: null,
  });
});

test("extractPartnerExtensions pulls only partner side-table fields", () => {
  assert.deepEqual(
    extractPartnerExtensions({
      name: "Acme",
      locationName: "Main",
      addressLine1: "1 Main",
      addressLine2: "Suite 2",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      countryCode: "US",
      paymentTermId: "NET30",
      shippingMethodId: "GROUND",
      incoterm: "FOB",
      incotermLocation: "Austin",
    }),
    {
      locationName: "Main",
      addressLine1: "1 Main",
      addressLine2: "Suite 2",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      countryCode: "US",
      paymentTermId: "NET30",
      shippingMethodId: "GROUND",
      incoterm: "FOB",
      incotermLocation: "Austin",
    }
  );
});

test("hasAnyAddressField only treats addressLine1 as address presence", () => {
  assert.equal(hasAnyAddressField({ city: "Austin" }), false);
  assert.equal(hasAnyAddressField({ addressLine1: "1 Main" }), true);
});

test("buildAddressFields maps CSV state to stateProvince and blanks to null", () => {
  assert.deepEqual(
    buildAddressFields({
      addressLine1: "1 Main",
      addressLine2: "",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      countryCode: "US",
    }),
    {
      addressLine1: "1 Main",
      addressLine2: null,
      city: "Austin",
      stateProvince: "TX",
      postalCode: "78701",
      countryCode: "US",
    }
  );
});

test("prepareMappedRecords keeps index.ts-ready composition deterministic and minimal", () => {
  const rows = [{ Supplier: "A", Status: "A" }, { Supplier: "B", Status: "Unknown" }];
  assert.deepEqual(
    prepareMappedRecords(rows, { name: "Supplier", supplierStatus: "Status", processType: "N/A" }, { supplierStatus: { A: "Active", Default: "Pending" }, processType: { Default: "Inside" } }),
    [
      { name: "A", supplierStatus: "Active", processType: "Inside" },
      { name: "B", supplierStatus: "Pending", processType: "Inside" },
    ]
  );
});

test("prepareMappedRecords provides final seam needed for current extraction step", () => {
  const parsed = parsePermissiveCsv('Supplier,Status\nA,A\nB,Legacy\n');
  assert.deepEqual(
    prepareMappedRecords(parsed, { name: "Supplier", supplierStatus: "Status", processType: "N/A" }, { supplierStatus: { A: "Active", Default: "Pending" }, processType: { Default: "Inside" } }),
    [
      { name: "A", supplierStatus: "Active", processType: "Inside" },
      { name: "B", supplierStatus: "Pending", processType: "Inside" },
    ]
  );
});
