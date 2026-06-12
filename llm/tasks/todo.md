# Supplier Contact and Location Auto-Fill for PDF Invoice Extraction

## Tasks

- [x] Extend `SupplierContact` and `SupplierLocation` components to support `extractedValue` (and `extractedEmail` for contact) and pass them as initial values to quick-create modals. Spawn subtasks to query the cache folder any time I need to learn something about the codebase. NEVER update the cache with plans or information about code that is not yet committed.
- [x] Implement database matching logic for contact (by name or email) and location (by address substring match) inside the `handleExtractionComplete` function in `PurchaseInvoiceForm.tsx`. Spawn subtasks to query the cache folder any time I need to learn something about the codebase. NEVER update the cache with plans or information about code that is not yet committed.
- [x] Run `biome check` to ensure code is properly formatted and linted. Spawn subtasks to query the cache folder any time I need to learn something about the codebase. NEVER update the cache with plans or information about code that is not yet committed.
- [x] Stage and commit the changes, then push to GitHub branch. Spawn subtasks to query the cache folder any time I need to learn something about the codebase. NEVER update the cache with plans or information about code that is not yet committed.

## Review

- Extended `SupplierContactSelectProps` and `SupplierLocationSelectProps` to support `extractedValue` and `extractedEmail` props.
- If no matching contact or location is found, these extracted values are pre-filled in the search fields of `CreatableCombobox` and passed as the `initialValues` of `SupplierContactForm` (`firstName`, `lastName`, `email`) and `SupplierLocationForm` (`addressLine1`), simplifying the user's manual review/creation flow.
- Added database queries in `handleExtractionComplete` to automatically match extracted supplier contact (via name or email) and address (via address line 1 substring match) against existing records for the resolved supplier. If matched, the field is automatically filled.
- Cleared the extracted states if the supplier changes or if a match is successfully found.
