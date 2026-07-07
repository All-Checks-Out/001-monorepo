import type {
  SubjectComplexPropertyDefinition,
  SubjectPropertyDefinition,
  SubjectSimplePropertyDefinition,
} from "./subjectTypes";
import { getSubjectTypeDefinition } from "./subjectTypes";

export type SubjectScalarValue = string | number | boolean | null;
export type SubjectComplexRowValue = Record<string, SubjectScalarValue>;
export type SubjectPropertyValue = SubjectScalarValue | SubjectComplexRowValue[];
export type SubjectValues = Record<string, SubjectPropertyValue>;

export type SubjectSimplePropertySelection = {
  key: string;
};

export type SubjectComplexPropertySelection = {
  key: string;
  columns: readonly SubjectSimplePropertySelection[];
};

export type SubjectPropertySelection =
  | SubjectSimplePropertySelection
  | SubjectComplexPropertySelection;

export type SubjectValidationResult =
  | { valid: true; values: SubjectValues }
  | { valid: false; error: string };

export type SubjectPropertySelectionValidationResult =
  | { valid: true; selectedProperties: SubjectPropertySelection[] }
  | { valid: false; error: string };

export function normalizeSubjectValues(
  subjectTypeKey: string,
  values: Record<string, unknown>,
): SubjectValidationResult {
  const definition = getSubjectTypeDefinition(subjectTypeKey);
  if (!definition) return { valid: false, error: "Subject type is invalid." };

  const normalized: SubjectValues = {};
  const propertiesByKey = new Map(
    definition.properties.map((property) => [property.key, property]),
  );

  for (const key of Object.keys(values)) {
    const property = propertiesByKey.get(key);
    if (!property) {
      return { valid: false, error: `Subject property is invalid: ${key}.` };
    }

    const value = normalizeSubjectPropertyValue(property, values[key]);
    if (!value.valid) return value;
    if (hasSubjectPropertyValue(value.value)) normalized[key] = value.value;
  }

  for (const property of definition.properties) {
    if (property.required && !hasSubjectPropertyValue(normalized[property.key])) {
      return { valid: false, error: `${property.label} is required.` };
    }
  }

  return { valid: true, values: normalized };
}

export function validateSubjectValues(
  subjectTypeKey: string,
  values: Record<string, unknown>,
): boolean {
  return normalizeSubjectValues(subjectTypeKey, values).valid;
}

export function subjectDisplayName(
  subjectTypeKey: string,
  values: SubjectValues,
  fallback = "Untitled Subject",
) {
  const definition = getSubjectTypeDefinition(subjectTypeKey);
  if (!definition) return fallback;

  const value = values[definition.displayNameProperty];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);

  return fallback;
}

export function validateSubjectPropertySelections(
  subjectTypeKey: string,
  selections: readonly SubjectPropertySelection[],
): SubjectPropertySelectionValidationResult {
  const definition = getSubjectTypeDefinition(subjectTypeKey);
  if (!definition) return { valid: false, error: "Subject type is invalid." };

  const propertiesByKey = new Map(
    definition.properties.map((property) => [property.key, property]),
  );
  const seenKeys = new Set<string>();
  const normalizedSelections: SubjectPropertySelection[] = [];

  for (const selection of selections) {
    if (seenKeys.has(selection.key)) {
      return { valid: false, error: "Subject properties must be unique." };
    }
    seenKeys.add(selection.key);

    const property = propertiesByKey.get(selection.key);
    if (!property) {
      return { valid: false, error: "Subject property is invalid." };
    }

    if (property.kind === "simple") {
      if ("columns" in selection) {
        return { valid: false, error: "Simple property cannot have columns." };
      }
      normalizedSelections.push({ key: selection.key });
      continue;
    }

    if (!("columns" in selection)) {
      return { valid: false, error: "Complex property must select columns." };
    }

    const columnValidation = validateColumnSelections(property, selection.columns);
    if (!columnValidation.valid) return columnValidation;

    normalizedSelections.push({
      key: selection.key,
      columns: columnValidation.columns,
    });
  }

  return { valid: true, selectedProperties: normalizedSelections };
}

export function extractSelectedSubjectValues(
  subjectTypeKey: string,
  values: SubjectValues,
  selections: readonly SubjectPropertySelection[],
): SubjectValues {
  const definition = getSubjectTypeDefinition(subjectTypeKey);
  if (!definition) return {};

  const propertiesByKey = new Map(
    definition.properties.map((property) => [property.key, property]),
  );
  const extracted: SubjectValues = {};

  for (const selection of selections) {
    const property = propertiesByKey.get(selection.key);
    if (!property) continue;

    const value = values[property.key];
    if (!hasSubjectPropertyValue(value)) continue;

    if (property.kind === "simple") {
      if (!Array.isArray(value)) extracted[property.key] = value;
      continue;
    }

    if (!Array.isArray(value) || !("columns" in selection)) continue;

    const selectedColumnKeys = new Set(selection.columns.map((column) => column.key));
    extracted[property.key] = value.map((row) => {
      const selectedRow: SubjectComplexRowValue = {};
      for (const column of property.properties) {
        if (!selectedColumnKeys.has(column.key)) continue;
        const columnValue = row[column.key];
        if (hasSubjectScalarValue(columnValue)) selectedRow[column.key] = columnValue;
      }
      return selectedRow;
    });
  }

  return extracted;
}

function validateColumnSelections(
  property: SubjectComplexPropertyDefinition,
  columns: readonly SubjectSimplePropertySelection[],
):
  | { valid: true; columns: SubjectSimplePropertySelection[] }
  | { valid: false; error: string } {
  if (columns.length === 0) {
    return { valid: false, error: "Complex property must select at least one column." };
  }

  const columnsByKey = new Map(property.properties.map((column) => [column.key, column]));
  const seenKeys = new Set<string>();
  const normalizedColumns: SubjectSimplePropertySelection[] = [];

  for (const column of columns) {
    if (seenKeys.has(column.key)) {
      return { valid: false, error: "Complex property columns must be unique." };
    }
    seenKeys.add(column.key);

    if (!columnsByKey.has(column.key)) {
      return { valid: false, error: "Complex property column is invalid." };
    }

    normalizedColumns.push({ key: column.key });
  }

  return { valid: true, columns: normalizedColumns };
}

function normalizeSubjectPropertyValue(
  property: SubjectPropertyDefinition,
  value: unknown,
): { valid: true; value: SubjectPropertyValue } | { valid: false; error: string } {
  if (property.kind === "simple") return normalizeSimplePropertyValue(property, value);
  return normalizeComplexPropertyValue(property, value);
}

function normalizeComplexPropertyValue(
  property: SubjectComplexPropertyDefinition,
  value: unknown,
): { valid: true; value: SubjectComplexRowValue[] } | { valid: false; error: string } {
  if (value === undefined || value === null) return { valid: true, value: [] };
  if (!Array.isArray(value)) {
    return { valid: false, error: `${property.label} must be a table of rows.` };
  }

  const normalizedRows: SubjectComplexRowValue[] = [];
  const columnsByKey = new Map(property.properties.map((column) => [column.key, column]));

  for (const [rowIndex, row] of value.entries()) {
    if (!isRecord(row)) {
      return { valid: false, error: `${property.label} row ${rowIndex + 1} is invalid.` };
    }

    const normalizedRow: SubjectComplexRowValue = {};
    for (const key of Object.keys(row)) {
      const column = columnsByKey.get(key);
      if (!column) {
        return {
          valid: false,
          error: `${property.label} column is invalid: ${key}.`,
        };
      }

      const columnValue = normalizeSimplePropertyValue(column, row[key]);
      if (!columnValue.valid) return columnValue;
      if (hasSubjectScalarValue(columnValue.value)) normalizedRow[key] = columnValue.value;
    }

    for (const column of property.properties) {
      if (column.required && !hasSubjectScalarValue(normalizedRow[column.key])) {
        return { valid: false, error: `${column.label} is required.` };
      }
    }

    if (Object.keys(normalizedRow).length > 0) normalizedRows.push(normalizedRow);
  }

  return { valid: true, value: normalizedRows };
}

function normalizeSimplePropertyValue(
  property: SubjectSimplePropertyDefinition,
  value: unknown,
): { valid: true; value: SubjectScalarValue } | { valid: false; error: string } {
  if (value === undefined || value === null) return { valid: true, value: null };

  if (property.valueType === "boolean") {
    if (typeof value !== "boolean") {
      return { valid: false, error: `${property.label} must be yes or no.` };
    }
    return { valid: true, value };
  }

  if (property.valueType === "number" || property.valueType === "currency") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { valid: false, error: `${property.label} must be a number.` };
    }
    return { valid: true, value };
  }

  if (typeof value !== "string") {
    return { valid: false, error: `${property.label} must be a valid value.` };
  }

  const trimmed = value.trim();
  if (!trimmed) return { valid: true, value: null };

  if (property.valueType === "date" && !isValidISODate(trimmed)) {
    return { valid: false, error: `${property.label} must use YYYY-MM-DD.` };
  }

  if (property.valueType === "email" && !isValidEmail(trimmed)) {
    return { valid: false, error: `${property.label} must be an email address.` };
  }

  if (property.valueType === "phone" && !isValidPhone(trimmed)) {
    return { valid: false, error: `${property.label} must be a phone number.` };
  }

  if (
    property.valueType === "select" &&
    property.options &&
    !property.options.includes(trimmed)
  ) {
    return { valid: false, error: `${property.label} must be an available option.` };
  }

  return { valid: true, value: trimmed };
}

function hasSubjectPropertyValue(value: SubjectPropertyValue | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  return hasSubjectScalarValue(value);
}

function hasSubjectScalarValue(value: SubjectScalarValue | undefined) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return typeof value === "number" || typeof value === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return /^[+()\d\s-]{5,}$/.test(value);
}
