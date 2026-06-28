export const importPermissions = {
  customer: "sales",
  customerContact: "sales",
  supplier: "purchasing",
  supplierContact: "purchasing",
  part: "parts",
  material: "parts",
  tool: "parts",
  fixture: "parts",
  consumable: "parts",
  workCenter: "production",
  process: "production"
} as const;

export type ImportTable = keyof typeof importPermissions;

export function permissionForImportTable(table: ImportTable) {
  return importPermissions[table];
}
