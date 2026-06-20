import { z } from "zod";

export const supportedFixtureTableSchema = z.enum([
  "customer",
  "customerContact",
  "supplier",
  "supplierContact",
  "part",
  "material",
  "tool",
  "fixture",
  "consumable",
  "workCenter",
  "process",
]);

export const effectEntrySchema = z.object({
  entity: z.string(),
  count: z.number().int().nonnegative(),
});

export const expectedScenarioSchema = z.object({
  version: z.literal(1),
  scenario: z.string().min(1),
  table: z.string().min(1).optional(),
  status: z.enum(["pass", "known-gap"]),
  summary: z.object({
    inserted: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    errors: z.array(
      z.object({
        row: z.number().int().nonnegative(),
        reason: z.string().min(1),
      })
    ),
  }),
  effects: z.object({
    create: z.array(effectEntrySchema),
    update: z.array(effectEntrySchema),
    upsert: z.array(effectEntrySchema),
  }),
  notes: z.array(z.string()),
});

export const goldenManifestSchema = z.object({
  version: z.literal(1),
  scenario: z.string().min(1),
  tables: z.array(supportedFixtureTableSchema).min(1),
  knownUnsupportedTables: z.array(supportedFixtureTableSchema),
});

export const referenceDataSchema = z.object({
  companyId: z.string().min(1),
  location: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
  ),
  unitOfMeasure: z.array(
    z.object({
      code: z.string().min(1),
      name: z.string().min(1),
    })
  ),
  materialSubstance: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
  ),
  materialForm: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
  ),
  customerStatus: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
  ),
  customerType: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
  ),
  supplierType: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
    })
  ),
});

export const existingStateSchema = z.object({
  externalIntegrationMappings: z.array(
    z.object({
      entityType: z.string().min(1),
      externalId: z.string().min(1),
      entityId: z.string().min(1),
    })
  ),
  entities: z.object({
    customer: z.array(z.record(z.unknown())),
    supplier: z.array(z.record(z.unknown())),
    item: z.array(z.record(z.unknown())),
    contact: z.array(z.record(z.unknown())),
    workCenter: z.array(z.record(z.unknown())),
    process: z.array(z.record(z.unknown())),
  }),
});
