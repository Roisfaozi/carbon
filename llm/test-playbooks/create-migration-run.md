# Create Migration Run

Route: `/x/settings/migration-runs`

## Purpose

Manual test guide for current migration run flow.

This guide matches current implementation:
- create persisted migration run
- validate `profile` and `files` payload shape before persisting
- queue dry-run in background
- review stored request / summary / plan snapshot
- queue apply only from `review-ready`
- verify final `applySummary`
- verify invalid payloads are rejected before any job is queued

This is **not** future AI auto-mapping flow. This guide assumes data is already prepared in Carbon canonical CSV shape.

## Prerequisites

- Branch contains migration-run feature commits (for example `feat/migration-tool`)
- Database migration applied
- ERP app running in normal local dev flow
- Inngest dev server running and synced to ERP
- Signed-in ERP user with Settings create/update permission
- Fresh IDs that do not already exist in Carbon

## Local Dev Health Check

Before testing the migration tool, confirm local async stack is healthy.

### ERP route health

```bash
curl -i http://localhost:3000/api/inngest
```

Expected:
- `HTTP/1.1 200`
- JSON response with fields like `function_count`, `mode`, `schema_version`

### Inngest UI health

Open the local Inngest UI.

If using current localhost-mode dev stack, this is usually the URL in `.env.local`:

```txt
INNGEST_BASE_URL=http://localhost:<PORT_INNGEST>
```

Open:
- `http://localhost:<PORT_INNGEST>/apps`
- `http://localhost:<PORT_INNGEST>/runs`

Expected:
- ERP app appears synced in `Apps`
- scheduled/queued runs appear in `Runs`

If Inngest is not synced, fix that first. Migration status will stall or fail misleadingly if the async worker path is unhealthy.

## Form Fields

Migration run form currently asks for 4 values:

1. **Scenario**
2. **Profile JSON**
3. **Files JSON**
4. **File Path Prefix**

For first manual test:
- keep **Profile JSON** as default
- use a small **Files JSON** payload
- use any unique **Scenario** and **File Path Prefix** labels

Default profile comes from [packages/database/supabase/functions/import-csv/migration-source-profiles.ts](packages/database/supabase/functions/import-csv/migration-source-profiles.ts) as `carbonCanonicalProfile`.

## Important Validation Rule

`Profile JSON` is now validated for real shape, not only JSON syntax.

That means `Profile JSON` must include a full object like:

```json
{
  "id": "carbon-canonical-v1",
  "name": "Carbon Canonical CSV v1",
  "tables": [ ... ]
}
```

Do **not** replace it with a minimal object like:

```json
{ "id": "x", "name": "x" }
```

That will now be rejected by the form before the run is created.

Likewise, `Files JSON` must be:

```json
{
  "some-file.csv": "csv,text,content"
}
```

Each file value must be a string.

## Canonical File Names

When using default profile, file names inside `Files JSON` should match these names:

- `customer.csv`
- `supplier.csv`
- `customerContact.csv`
- `supplierContact.csv`
- `part.csv`
- `material.csv`
- `tool.csv`
- `fixture.csv`
- `consumable.csv`
- `workCenter.csv`
- `process.csv`

You only need to include files you are testing.

## Minimum Required Columns by Table

Based on current canonical profile:

- `customer`: `id`, `name`
- `supplier`: `id`, `name`
- `customerContact`: `id`, `companyId`, `email`
- `supplierContact`: `id`, `companyId`, `email`
- `part`: `id`, `readableId`, `name`
- `material`: `id`, `readableId`, `name`
- `tool`: `id`, `readableId`, `name`
- `fixture`: `id`, `readableId`, `name`
- `consumable`: `id`, `readableId`, `name`
- `workCenter`: `id`, `name`, `description`, `locationId`
- `process`: `id`, `name`, `processType`

For first manual smoke test, start with `supplier.csv` only.

## Data Preparation Rules

- Use UTF-8 plain text CSV content
- First row must be header row
- CSV headers should match canonical field names when using default profile
- Use unique IDs for every row
- If child rows reference parent rows, include matching parent data in same run or ensure parent already exists
- Keep first run small: 1-2 files, 1-3 rows each
- Prefer testing with only required columns first

## Recommended First Test: Supplier Smoke Dataset

Use this exact input.

### Scenario

```txt
manual-smoke-supplier-v1
```

### Profile JSON

Leave default form value unchanged.

### File Path Prefix

```txt
private/migration/manual-smoke-supplier-v1
```

### Files JSON

```json
{
  "supplier.csv": "id,name\nSUPP-MANUAL-001,Supplier Manual Test\n"
}
```

Expected result:
- dry-run reaches `review-ready`
- apply reaches `applied`
- `Request.files` stores supplier CSV text inline
- `Apply Summary` is populated

## Recommended Second Test: Process Smoke Dataset

Use this exact input.

### Scenario

```txt
manual-smoke-process-v1
```

### Profile JSON

Leave default form value unchanged.

### File Path Prefix

```txt
private/migration/manual-smoke-process-v1
```

### Files JSON

```json
{
  "process.csv": "id,name,processType\nPROC-MANUAL-001,Manual Process,Inside\n"
}
```

Expected result:
- dry-run reaches `review-ready`
- apply reaches `applied`
- `processType` value accepted by current import contract

## Recommended Third Test: Work Center Smoke Dataset

Use this exact input.

### Scenario

```txt
manual-smoke-workcenter-v1
```

### Profile JSON

Leave default form value unchanged.

### File Path Prefix

```txt
private/migration/manual-smoke-workcenter-v1
```

### Files JSON

```json
{
  "workCenter.csv": "id,name,description,locationId\nWC-MANUAL-001,Manual Work Center,Manual test work center,LOC-MANUAL-001\n"
}
```

Expected result:
- dry-run reaches `review-ready`
- apply reaches `applied`
- `locationId` must point at valid location data already present in Carbon

## Recommended Failure Test: Missing Required Field

Use this to verify failed dry-run path.

### Scenario

```txt
manual-fail-contact-missing-email-v1
```

### Profile JSON

Leave default form value unchanged.

### File Path Prefix

```txt
private/migration/manual-fail-contact-missing-email-v1
```

### Files JSON

```json
{
  "customer.csv": "id,name\nCUST-MANUAL-003,Charlie Manual Test\n",
  "customerContact.csv": "id,companyId,firstName,lastName,title\nCONT-MANUAL-002,CUST-MANUAL-003,No,Email,Buyer\n"
}
```

Expected result: dry-run ends in `failed` and detail page shows error.

## Recommended Validation Test: Invalid Profile Shape

Use this to verify create action blocks invalid profile before run creation.

### Scenario

```txt
manual-invalid-profile-v1
```

### Profile JSON

```json
{
  "id": "broken-profile",
  "name": "Broken Profile"
}
```

### File Path Prefix

```txt
private/migration/manual-invalid-profile-v1
```

### Files JSON

```json
{
  "customer.csv": "id,name\nCUST-MANUAL-004,Delta Manual Test\n"
}
```

Expected result:
- form shows validation error
- no redirect
- no migration run should be created
- no Inngest job should be queued

## Recommended Validation Test: Invalid Files Payload

Use this to verify non-string file values are blocked before run creation.

### Scenario

```txt
manual-invalid-files-v1
```

### Profile JSON

Leave default form value unchanged.

### File Path Prefix

```txt
private/migration/manual-invalid-files-v1
```

### Files JSON

```json
{
  "customer.csv": 123
}
```

Expected result:
- form shows validation error
- no redirect
- no migration run should be created
- no Inngest job should be queued

## Manual Test Steps

### 1. Open list page

- URL: `/x/settings/migration-runs`
- Expected: table titled `Migration Runs`
- Expected: button `New Migration Run`

### 2. Open create form

- Click `New Migration Run`
- Expected route: `/x/settings/migration-runs/new`
- Expected fields:
  - `Scenario`
  - `Profile JSON`
  - `Files JSON`
  - `File Path Prefix`
  - submit button `Queue Dry Run`

### 3. Sanity-check the default profile

Before submitting the first run, quickly confirm the visible `Profile JSON` contains:
- `id`
- `name`
- `tables`

If `tables` is missing, do not submit.

### 4. Fill form

For first smoke test:
- Scenario: `manual-smoke-supplier-v1`
- Profile JSON: leave default
- Files JSON: paste supplier smoke dataset
- File Path Prefix: `private/migration/manual-smoke-supplier-v1`

### 5. Submit

- Click `Queue Dry Run`
- Expected redirect: `/x/settings/migration-runs/<id>`
- Expected detail drawer opens for created run

### 6. Verify dry-run status progression

Expected progression:
- `queued-dry-run`
- `running-dry-run`
- `review-ready`

Refresh manually if needed. There is no realtime progress stream in this phase.

Also check local Inngest `Runs` page to confirm a `carbon/migration-run` event was processed.

### 7. Verify dry-run detail contents

On detail page, verify these sections exist:
- `Overview`
- `Request`
- `Dry Run Summary`
- `Plan Snapshot`
- `Apply Summary`

For successful dry-run:
- `Request` contains your scenario, profile, files, and filePathPrefix
- `Request.profile.tables` exists in the stored request
- `Dry Run Summary` is populated
- `Plan Snapshot` is populated
- `Queue Apply` button is enabled

### 8. Queue apply

- Click `Queue Apply`
- Expected progression:
  - `queued-apply`
  - `running-apply`
  - `applied`

Refresh manually if needed.

### 9. Verify apply results

After success:
- status badge shows `Applied`
- `Apply Summary` is populated
- `Plan Snapshot` still matches reviewed dry-run snapshot

This confirms apply used stored plan snapshot instead of recomputing from live input.

## Failure Path Checks

### Dry-run failure

Use failure dataset above.

Expected:
- status becomes `failed`
- `Error` section appears in detail view
- `Queue Apply` button stays disabled

### Invalid profile/files payload

Use either validation test above.

Expected:
- create form rejects submission
- no row added to migration runs list
- no background job queued

### Apply guard

Try to apply a run that is not `review-ready`.

Expected:
- apply is rejected
- route returns `Migration run is not ready to apply`
- no background apply should start

## What to Prepare Before a Bigger Migration Test

For broader manual testing, prepare these items:

1. **Entity scope**
   - Decide which tables you are testing first
   - Start with `customer` / `supplier`
   - Add contacts next
   - Leave `workCenter` and `process` for later unless reference data is known-good

2. **Unique IDs**
   - Every row should use IDs that do not already exist in Carbon

3. **Relationship mapping**
   - `customerContact.companyId` must point at a customer `id`
   - `supplierContact.companyId` must point at a supplier `id`

4. **Reference data awareness**
   - Some optional fields may reference existing Carbon records or enums
   - For first test, avoid optional lookup-heavy columns unless you know their values are valid
   - `workCenter.locationId` must reference valid location data already present in Carbon
   - `process.processType` should use current accepted runtime values like `Inside`

5. **Small batch first**
   - Run 1 file / 1 row first
   - Then 2 files / a few rows
   - Then full pack

6. **Current browser verification blocker**
   - In this session, browser automation could not run because `agent-browser` was unavailable in the CLI environment
   - Use manual browser testing for final supplier / process / workCenter verification until that tooling is available again
   - Because of that blocker, no exact nested-button repro was confirmed on the migration-runs table in this session
   - Do not change migration-runs table markup unless the warning is reproduced on the exact page path during manual testing

7. **Known good manual order**
   - `supplier.csv`
   - `process.csv`
   - `workCenter.csv`
   - customer + contact datasets after single-table smoke passes

8. **Recommended location prerequisite for work center**
   - Before running `workCenter.csv`, confirm the `locationId` you plan to use already exists in seeded data or create it first
   - Replace `LOC-MANUAL-001` with a real location identifier from your environment if needed

9. **Manual test note for process**
   - Start with only `id`, `name`, and `processType`
   - Add optional fields like `defaultStandardFactor` or `completeAllOnScan` only after the minimal smoke case passes

10. **Manual test note for supplier**
   - Start with only `id` and `name`
   - Add address, payment, shipping, and incoterm fields only after the minimal smoke case passes to isolate failures more easily

11. **Expected status path for all happy-path smoke runs**
   - `queued-dry-run`
   - `running-dry-run`
   - `review-ready`
   - `queued-apply`
   - `running-apply`
   - `applied`

## Using Fixture Data as Reference

Canonical fixture examples live here:
- [packages/database/supabase/functions/import-csv/fixtures/golden/v1/](packages/database/supabase/functions/import-csv/fixtures/golden/v1/)
- [packages/database/supabase/functions/import-csv/fixtures/golden/v1/manifest.json](packages/database/supabase/functions/import-csv/fixtures/golden/v1/manifest.json)

Use those files as source examples if you want a richer manual dataset shaped for the canonical profile.

## Current Status Vocabulary

Possible run statuses:
- `queued-dry-run`
- `running-dry-run`
- `review-ready`
- `queued-apply`
- `running-apply`
- `applied`
- `failed`

## Common Failure Causes

- Inngest worker not running or not synced
- `Profile JSON` missing `tables`
- invalid JSON in `Profile JSON`
- invalid JSON in `Files JSON`
- non-string values inside `Files JSON`
- wrong file names in `Files JSON`
- required columns missing from CSV header
- required cell values missing from rows
- parent/child references do not line up

## Fast Pass Checklist

- [ ] `/api/inngest` returns `200`
- [ ] local Inngest app is synced
- [ ] Can open `/x/settings/migration-runs`
- [ ] Can open `/x/settings/migration-runs/new`
- [ ] Default `Profile JSON` contains `tables`
- [ ] Can submit supplier smoke dataset
- [ ] Dry-run reaches `review-ready`
- [ ] Detail shows request / summary / snapshot
- [ ] Apply reaches `applied`
- [ ] Apply summary is populated
- [ ] Failure dataset reaches `failed`
- [ ] Invalid profile/files payload is blocked before run creation
- [ ] Failed run shows error and cannot be applied
- [ ] Supplier smoke dataset confirmed by manual browser run when browser tooling is available
- [ ] Process smoke dataset confirmed by manual browser run when browser tooling is available
- [ ] WorkCenter smoke dataset confirmed by manual browser run when browser tooling is available
- [ ] No nested-button warning repro found on `/x/settings/migration-runs` unless exact page path shows it again

