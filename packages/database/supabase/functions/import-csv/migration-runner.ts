import { parsePermissiveCsv, prepareMappedRecords } from "./import-runner.ts";
import type { SourceProfile } from "./migration-source-profiles.ts";

function validateRequiredFields(
  rows: Record<string, string>[],
  requiredFields: string[] = []
): Array<{ row: number; reason: string }> {
  return rows.flatMap((row, rowIndex) =>
    requiredFields
      .filter((field) => !row[field]?.trim())
      .map((field) => ({
        row: rowIndex,
        reason: `Missing required field: ${field}`,
      }))
  );
}

function validateUniqueFields(
  rows: Record<string, string>[],
  uniqueFields: string[] = []
): Array<{ row: number; reason: string }> {
  const errors: Array<{ row: number; reason: string }> = [];

  for (const field of uniqueFields) {
    const seen = new Set<string>();

    for (const [rowIndex, row] of rows.entries()) {
      const value = row[field];
      if (!value) continue;

      if (seen.has(value)) {
        errors.push({ row: rowIndex, reason: `Duplicate value for ${field}: ${value}` });
      } else {
        seen.add(value);
      }
    }
  }

  return errors;
}

export type MigrationImportRequest = {
  table: string;
  filePath: string;
  columnMappings: Record<string, string>;
  enumMappings?: Record<string, Record<string, string>>;
  companyId: string;
  userId: string;
};

export type MigrationDryRunTable = {
  table: string;
  fileName: string;
  rowCount: number;
  mappedRowCount: number;
  errors: Array<{ row: number; reason: string }>;
  warnings: string[];
};

export type MigrationDryRunReport = {
  scenario: string;
  status: "pass" | "fail";
  totalRows: number;
  tables: MigrationDryRunTable[];
  errors: Array<{ table: string; row: number; reason: string }>;
  warnings: Array<{ table: string; message: string }>;
  importRequests: MigrationImportRequest[];
};

export function buildDryRunReport(args: {
  scenario: string;
  profile: SourceProfile;
  files: Record<string, string>;
  companyId?: string;
  userId?: string;
  filePathPrefix?: string;
}): MigrationDryRunReport {
  const tables = args.profile.tables.map((tableProfile) => {
    const csvText = args.files[tableProfile.fileName] ?? "";
    const parsedRows = parsePermissiveCsv(csvText);
    const mappedRows = prepareMappedRecords(
      parsedRows,
      tableProfile.columnMappings,
      tableProfile.enumMappings
    );
    const errors = [
      ...validateRequiredFields(mappedRows, tableProfile.requiredFields),
      ...validateUniqueFields(mappedRows, tableProfile.uniqueFields),
    ];

    return {
      table: tableProfile.table,
      fileName: tableProfile.fileName,
      rowCount: parsedRows.length,
      mappedRowCount: mappedRows.length,
      errors,
      warnings: csvText ? [] : [`Missing file ${tableProfile.fileName}`],
    };
  });

  const errors = tables.flatMap((table) =>
    table.errors.map((error) => ({ table: table.table, ...error }))
  );
  const warnings = tables.flatMap((table) =>
    table.warnings.map((message) => ({ table: table.table, message }))
  );
  const importRequests = args.profile.tables.map((tableProfile) => ({
    table: tableProfile.table,
    filePath: [args.filePathPrefix, tableProfile.fileName].filter(Boolean).join("/"),
    columnMappings: tableProfile.columnMappings,
    enumMappings: tableProfile.enumMappings,
    companyId: args.companyId ?? "",
    userId: args.userId ?? "",
  }));

  return {
    scenario: args.scenario,
    status: errors.length > 0 ? "fail" : "pass",
    totalRows: tables.reduce((sum, table) => sum + table.rowCount, 0),
    tables,
    errors,
    warnings,
    importRequests,
  };
}
