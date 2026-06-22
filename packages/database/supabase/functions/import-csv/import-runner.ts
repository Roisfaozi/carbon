export type ColumnMappings = Record<string, string>;
export type EnumMappings = Record<string, Record<string, string>>;

export type PartnerExtensionData = {
  locationName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  paymentTermId?: string;
  shippingMethodId?: string;
  incoterm?: string;
  incotermLocation?: string;
};

/**
 * Fallback CSV parser used when strict parsing rejects row-length mismatches.
 * Handles RFC-4180 quoting but tolerates uneven row widths (extra cells
 * dropped, missing cells become "").
 */
export function parsePermissiveCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
        rows.push(row);
      }
      row = [];
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
      rows.push(row);
    }
  }

  if (rows.length === 0) return [];

  const headers = rows[0] ?? [];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (header === undefined) continue;
      obj[header] = r[i] ?? "";
    }
    return obj;
  });
}

export function mapCsvRecords(
  parsedCsv: Record<string, string>[],
  columnMappings: ColumnMappings,
  enumMappings: EnumMappings = {}
): Record<string, string>[] {
  return parsedCsv.map((row) => {
    const record: Record<string, string> = {};

    for (const [key, value] of Object.entries(columnMappings)) {
      if (key in enumMappings) {
        const enumMapping = enumMappings[key];
        if (!enumMapping) continue;
        const csvValue = row[value] ?? "";
        if (csvValue in enumMapping) {
          record[key] = enumMapping[csvValue] ?? "";
        } else {
          record[key] = enumMapping["Default"] ?? "";
        }
      } else if (value && value !== "N/A") {
        record[key] = row[value] ?? "";
      }
    }

    return record;
  });
}

export function applyMissingEnumDefaults(
  mappedRecords: Record<string, string>[],
  enumMappings: EnumMappings = {}
): Record<string, string>[] {
  if (mappedRecords.length === 0) return mappedRecords;

  const missingEnumKeys = Object.keys(enumMappings).filter(
    (key) => !(key in (mappedRecords[0] ?? {}))
  );

  if (missingEnumKeys.length === 0) return mappedRecords;

  return mappedRecords.map((record) => {
    const processedRecord = { ...record };

    for (const key of missingEnumKeys) {
      processedRecord[key] = enumMappings[key]?.["Default"] ?? "";
    }

    return processedRecord;
  });
}

export function prepareMappedRecords(
  parsedCsv: Record<string, string>[],
  columnMappings: ColumnMappings,
  enumMappings: EnumMappings = {}
): Record<string, string>[] {
  return applyMissingEnumDefaults(
    mapCsvRecords(parsedCsv, columnMappings, enumMappings),
    enumMappings
  );
}

/**
 * Convert empty-string values to undefined. Kysely drops undefined keys from
 * INSERTs, so DB defaults apply instead of storing literal empty strings.
 */
export function nullifyEmptyStrings<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v === "" ? undefined : v;
  }
  return out as Partial<T>;
}

export function extractPartnerExtensions(
  record: Record<string, string>
): PartnerExtensionData {
  return {
    locationName: record.locationName,
    addressLine1: record.addressLine1,
    addressLine2: record.addressLine2,
    city: record.city,
    state: record.state,
    postalCode: record.postalCode,
    countryCode: record.countryCode,
    paymentTermId: record.paymentTermId,
    shippingMethodId: record.shippingMethodId,
    incoterm: record.incoterm,
    incotermLocation: record.incotermLocation,
  };
}

export function hasAnyAddressField(ext: PartnerExtensionData): boolean {
  return !!ext.addressLine1;
}

export function buildAddressFields(ext: PartnerExtensionData): {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  countryCode: string | null;
} {
  return {
    addressLine1: ext.addressLine1 || null,
    addressLine2: ext.addressLine2 || null,
    city: ext.city || null,
    stateProvince: ext.state || null,
    postalCode: ext.postalCode || null,
    countryCode: ext.countryCode || null,
  };
}
