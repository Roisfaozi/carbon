# CSV Import and Migration System

## Overview

The Carbon system includes a comprehensive CSV import and migration system. It allows users to bulk import data for various entities and orchestrate multi-table migration runs with dry-run planning, plan persistence, review, and async apply.

## Architecture

### Frontend Components

- **Location**: `/apps/erp/app/components/ImportCSVModal/`
- **Main Component**: `ImportCSVModal.tsx` - Modal interface for single-table CSV imports
- **Sub-components**:
  - `UploadCSV.tsx` - Handles CSV file upload to private storage
  - `FieldMappings.tsx` - UI for mapping CSV columns to database fields
  - `useCsvContext.tsx` - Context management for import state

### Persisted Migration Runs (Phase 7)

To orchestrate complex multi-table migrations:
1. **Model**: `migrationRun` table stores:
   - `id` and `companyId` (composite primary key)
   - `status`: `queued-dry-run` | `running-dry-run` | `review-ready` | `queued-apply` | `running-apply` | `applied` | `failed`
   - `request`: JSONB payload containing `scenario`, source `profile`, and `files` (file name to raw CSV content maps)
   - `planSnapshot`: JSONB copy of the dry-run plan. Used for execution to prevent drift.
   - `dryRunSummary` and `applySummary`: JSONB summary metrics (inserted, updated, skipped, errors)
   - `error`: Text error reason on failure
   - Standard audit and composite RLS policies.
2. **Settings UI**:
   - List View: `/x/settings/migration-runs` lists runs with status, scenario, table counts, and timestamps.
   - New Run Form: `/x/settings/migration-runs/new` validates JSON payloads and triggers dry-run.
   - Detail View: `/x/settings/migration-runs/$migrationRunId` displays overview and collapsible JSON panels (Request, Dry Run, Plan, Apply).
   - Apply: Route action queues the async apply only when status is `review-ready`.
3. **Async Processing (Inngest)**:
   - Inngest task: `migration-run` (event `carbon/migration-run`) runs in background.
   - Dry-Run Action: Moves status to `running-dry-run`, computes import requests using pure `migration-runner.ts` logic, stores `planSnapshot` + `dryRunSummary`, and sets status to `review-ready` or `failed`.
   - Apply Action: Moves status to `running-apply`, executes the stored `planSnapshot` sequentially by invoking Deno `import-csv` function, aggregates count summary, and transitions to `applied` or `failed`.

### Backend Route

- **Single Table Import Location**: `/apps/erp/app/routes/x+/shared+/import.$tableId.tsx`
- **Flow**:
  1. Checks user permissions for the table being imported
  2. Validates form data using Zod schemas
  3. Extracts column mappings and enum mappings
  4. Calls Deno Supabase edge function `import-csv`

### Supabase Edge Function

- **Location**: `/packages/database/supabase/functions/import-csv/index.ts`
- **Runtime**: Deno
- **Responsibilities**:
  1. Downloads CSV file from private storage
  2. Parses CSV using Deno std library
  3. Maps CSV columns to database fields
  4. Handles enum value mappings
  5. Performs upsert operations with idempotent behavior
  6. Stores external ID mappings for re-imports

## Field Mappings

Field mappings are defined in `/apps/erp/app/modules/shared/imports.models.ts` and include:

### Field Mapping Structure

```typescript
{
  label: string;           // User-friendly field name
  required: boolean;       // Whether field is mandatory
  type: string;           // "string" | "number" | "boolean" | "enum"
  enumData?: {            // For enum fields
    description: string;   // Explanation of the field
    options?: string[];   // Static enum options
    fetcher?: Function;   // Database fetcher for dynamic options
    default?: string;     // Default value
  };
  default?: string;       // Optional default value
}
```

## Supported Import Tables

### Core Tables with Field Mappings

1. **customer** - Permission: `sales`
   - Fields: id, name, accountManagerId, fax, taxId, currencyCode, website
2. **customerContact** - Permission: `sales`
   - Fields: id, companyId, firstName, lastName, email, title, mobilePhone, workPhone, homePhone, fax, notes
3. **supplier** - Permission: `purchasing`
   - Fields: id, name, accountManagerId, phone, fax, taxId, currencyCode, website
4. **supplierContact** - Permission: `purchasing`
   - Fields: id, companyId, firstName, lastName, email, title, mobilePhone, workPhone, homePhone, fax, notes
5. **part** - Permission: `parts`
   - Fields: id, readableId, revision, name, description, active, replenishmentSystem, defaultMethodType, itemTrackingType, unitOfMeasureCode
6. **material** - Permission: `parts`
   - Fields: Same as part, plus: materialSubstanceId, materialFormId, finish, grade, dimensions
7. **tool** - Permission: `parts`
   - Fields: Same as part
8. **fixture** - Permission: `parts`
   - Fields: Same as part
9. **consumable** - Permission: `parts`
   - Fields: Same as part
10. **workCenter** - Permission: `production`
    - Required Fields: id, name, description, defaultStandardFactor, laborRate, machineRate, overheadRate, locationId
    - Description: Bulk import work centers with cost rates and location assignment
11. **process** - Permission: `production`
    - Required Fields: id, name, processType
    - Optional Fields: defaultStandardFactor (required for Inside processes), completeAllOnScan
    - Description: Bulk import processes (Inside/Outside) with default standards

`fixedAsset` and `methodMaterial` are intentionally not exposed as supported CSV imports until their edge import semantics are implemented end-to-end.

## Import Process Flow

### Single Table Frontend Flow

1. User opens ImportCSVModal
2. Uploads CSV file to `/private` storage (via browser)
3. Selects field mappings (which CSV columns map to which database fields)
4. Configures enum mappings for dropdown fields (e.g., "Buy" → "Make")
5. Submits form to `/import/$tableId` route

### Backend Flow

1. **Route Handler** (`import.$tableId.tsx`):
   - Verifies user has permission to import the table
   - Validates input data using Zod schema
   - Extracts column mappings and enum mappings
   - Calls Supabase edge function

2. **Edge Function** (`import-csv/index.ts`):
   - Downloads CSV from private storage
   - Parses CSV into records
   - Uses `import-runner.ts` helpers for permissive parsing, column mapping, enum defaulting, and partner side-table field extraction
   - Maps CSV columns to field names using columnMappings
   - Applies enum mappings for enum fields
   - Validates records
   - Handles insert/update logic:
     - **Insert**: Creates new records with external ID mapping
     - **Update**: Updates existing records found via external ID mapping
   - Performs database transaction with rollback on error

### Idempotent Imports

- Uses `externalIntegrationMapping` table to track CSV imports
- Format: `integration: "csv"`, `externalId: <CSV_ID>`
- Allows re-importing same CSV without duplicates
- Updates existing records if CSV ID already exists

## Zod Validators

All import tables have Zod validators in `importSchemas` for client-side validation:
- Ensures required fields are present
- Validates field types
- Provides user-friendly error messages

## Permissions

Import permissions are defined in `importPermissions`:

```typescript
{
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
}
```

## Key Features

1. **Column Mapping**: Flexible assignment of CSV columns to database fields
2. **Enum Mapping**: Custom value mappings for dropdown fields (e.g., "B" → "Buy")
3. **Default Values**: Auto-populate fields from predefined defaults
4. **Validation**: Both client and server-side validation with schema enforcement
5. **Idempotent Imports**: Re-import same data without creating duplicates
6. **Transaction Safety**: All or nothing behavior for database operations
7. **Error Handling**: Graceful error reporting with detailed messages

## Location References

### Models & Validation

- `/apps/erp/app/modules/shared/imports.models.ts` - Field mappings and Zod schemas
- `/apps/erp/app/modules/resources/resources.models.ts` - Work center validator
- `/apps/erp/app/modules/production/production.models.ts` - Process validator
- `/apps/erp/app/modules/settings/settings.models.ts` - `migrationRunRequestValidator`

### Routes & Controllers

- `/apps/erp/app/routes/x+/shared+/import.$tableId.tsx` - Import route handler
- `/apps/erp/app/routes/x+/settings+/migration-runs.tsx` - Migration runs list route
- `/apps/erp/app/routes/x+/settings+/migration-runs.new.tsx` - Create migration run route
- `/apps/erp/app/routes/x+/settings+/migration-runs.$migrationRunId.tsx` - Migration run detail route
- `/apps/erp/app/routes/x+/settings+/migration-runs.$migrationRunId.apply.tsx` - Migration run apply action route

### Frontend Components

- `/apps/erp/app/components/ImportCSVModal/` - Import UI components
- `/apps/erp/app/modules/settings/ui/MigrationRuns/` - Persisted migration run list/detail/form components

### Backend & Async Processing

- `/packages/database/supabase/functions/import-csv/index.ts` - Edge function
- `/packages/jobs/src/inngest/functions/tasks/migration-run.ts` - Async Inngest processor
- `/packages/jobs/src/inngest/functions/tasks/migration-run.core.ts` - Core plan processor

## Test Foundation

The import CSV package includes a migration test foundation under `/packages/database/supabase/functions/import-csv/fixtures/`:
- `golden/v1/` contains replayable happy-path CSV data, reference data, existing state, and expected semantic results.
- `edge-cases/` contains focused scenarios for supported import paths.
- `fixture-schema.ts` defines the manifest, expected-result, reference-data, and existing-state schemas used by the fixture validation tests.
- `imports.contract.test.ts` keeps ERP import tables, app schemas, edge-supported tables, material field names, and enum-mapping payload typing aligned.
- `migration-source-profiles.ts` defines the canonical Carbon source profile and table execution order for migration planning.
- `migration-runner.ts` builds dry-run reports and deterministically runs plan orchestration without direct database calls.
