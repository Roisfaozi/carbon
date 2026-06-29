import { z } from "zod";
import type { ColumnMappings, EnumMappings } from "./import-runner.ts";
import { supportedFixtureTableSchema } from "./fixture-schema.ts";

export type MigrationTable = z.infer<typeof supportedFixtureTableSchema>;

const columnMappingsSchema = z.record(z.string());
const enumMappingsSchema = z.record(z.record(z.string()));

export const sourceTableProfileSchema = z.object({
  table: supportedFixtureTableSchema,
  fileName: z.string().min(1),
  columnMappings: columnMappingsSchema,
  enumMappings: enumMappingsSchema.optional(),
  requiredFields: z.array(z.string()).optional(),
  uniqueFields: z.array(z.string()).optional()
});

export type SourceTableProfile = z.infer<typeof sourceTableProfileSchema> & {
  columnMappings: ColumnMappings;
  enumMappings?: EnumMappings;
};

export const sourceProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tables: z.array(sourceTableProfileSchema)
});

export type SourceProfile = z.infer<typeof sourceProfileSchema>;

export const migrationRunFilesSchema = z.record(z.string());

export const migrationRunRequestSchema = z.object({
  scenario: z.string().min(1),
  profile: sourceProfileSchema,
  files: migrationRunFilesSchema,
  filePathPrefix: z.string().optional()
});

export type MigrationRunRequest = z.infer<typeof migrationRunRequestSchema>;

export const tableExecutionOrder: MigrationTable[] = [
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
];

function sameNameMappings(fields: string[]): ColumnMappings {
  return Object.fromEntries(fields.map((field) => [field, field]));
}

export const carbonCanonicalProfile: SourceProfile = {
  id: "carbon-canonical-v1",
  name: "Carbon Canonical CSV v1",
  tables: [
    {
      table: "customer",
      fileName: "customer.csv",
      requiredFields: ["id", "name"],
      uniqueFields: ["id"],
      columnMappings: sameNameMappings([
        "id",
        "name",
        "accountManagerId",
        "customerStatusId",
        "customerTypeId",
        "phone",
        "fax",
        "taxId",
        "currencyCode",
        "website",
        "locationName",
        "addressLine1",
        "addressLine2",
        "city",
        "state",
        "postalCode",
        "countryCode",
        "paymentTermId",
      ]),
    },
    {
      table: "supplier",
      fileName: "supplier.csv",
      requiredFields: ["id", "name"],
      uniqueFields: ["id"],
      columnMappings: sameNameMappings([
        "id",
        "name",
        "accountManagerId",
        "supplierStatus",
        "supplierTypeId",
        "phone",
        "fax",
        "taxId",
        "currencyCode",
        "website",
        "locationName",
        "addressLine1",
        "addressLine2",
        "city",
        "state",
        "postalCode",
        "countryCode",
        "paymentTermId",
        "shippingMethodId",
        "incoterm",
        "incotermLocation",
      ]),
    },
    {
      table: "customerContact",
      fileName: "customerContact.csv",
      requiredFields: ["id", "companyId", "email"],
      uniqueFields: ["id"],
      columnMappings: sameNameMappings([
        "id",
        "companyId",
        "firstName",
        "lastName",
        "email",
        "title",
        "mobilePhone",
        "workPhone",
        "homePhone",
        "fax",
        "notes",
      ]),
    },
    {
      table: "supplierContact",
      fileName: "supplierContact.csv",
      requiredFields: ["id", "companyId", "email"],
      uniqueFields: ["id"],
      columnMappings: sameNameMappings([
        "id",
        "companyId",
        "firstName",
        "lastName",
        "email",
        "title",
        "mobilePhone",
        "workPhone",
        "homePhone",
        "fax",
        "notes",
      ]),
    },
    {
      table: "part",
      fileName: "part.csv",
      requiredFields: ["id", "readableId", "name"],
      uniqueFields: ["id"],
      columnMappings: sameNameMappings([
        "id",
        "readableId",
        "revision",
        "name",
        "active",
        "replenishmentSystem",
        "defaultMethodType",
        "itemTrackingType",
        "unitOfMeasureCode",
        "supplierId",
        "supplierPartId",
        "supplierUnitOfMeasureCode",
        "minimumOrderQuantity",
        "orderMultiple",
        "conversionFactor",
        "unitPrice",
        "leadTime",
      ]),
    },
    {
      table: "material",
      fileName: "material.csv",
      requiredFields: ["id", "readableId", "name"],
      uniqueFields: ["id"],
      columnMappings: sameNameMappings([
        "id",
        "readableId",
        "revision",
        "name",
        "active",
        "materialSubstanceId",
        "materialFormId",
        "defaultMethodType",
        "itemTrackingType",
        "finish",
        "grade",
        "dimensions",
        "unitOfMeasureCode",
        "supplierId",
        "supplierPartId",
        "supplierUnitOfMeasureCode",
        "minimumOrderQuantity",
        "orderMultiple",
        "conversionFactor",
        "unitPrice",
        "leadTime",
      ]),
    },
    ...["tool", "fixture", "consumable"].map((table) => ({
      table: table as MigrationTable,
      fileName: `${table}.csv`,
      requiredFields: ["id", "readableId", "name"],
      uniqueFields: ["id"],
      columnMappings: sameNameMappings([
        "id",
        "readableId",
        "revision",
        "name",
        "active",
        "replenishmentSystem",
        "defaultMethodType",
        "itemTrackingType",
        "unitOfMeasureCode",
        "supplierId",
        "supplierPartId",
        "supplierUnitOfMeasureCode",
        "minimumOrderQuantity",
        "orderMultiple",
        "conversionFactor",
        "unitPrice",
        "leadTime",
      ]),
    })),
    {
      table: "workCenter",
      fileName: "workCenter.csv",
      requiredFields: ["id", "name", "description", "locationId"],
      uniqueFields: ["id"],
      columnMappings: sameNameMappings([
        "id",
        "name",
        "description",
        "defaultStandardFactor",
        "laborRate",
        "machineRate",
        "overheadRate",
        "locationId",
      ]),
    },
    {
      table: "process",
      fileName: "process.csv",
      requiredFields: ["id", "name", "processType", "defaultStandardFactor"],
      uniqueFields: ["id"],
      columnMappings: sameNameMappings([
        "id",
        "name",
        "processType",
        "defaultStandardFactor",
        "completeAllOnScan",
      ]),
    },
  ],
};
