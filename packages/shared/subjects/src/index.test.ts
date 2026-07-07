import { describe, expect, it } from "vitest";
import {
  extractSelectedSubjectValues,
  getSubjectComplexPropertyColumnDefinition,
  getSubjectPropertyDefinition,
  getSubjectTypeDefinition,
  getSubjectTypes,
  normalizeSubjectValues,
  subjectDisplayName,
  validateSubjectPropertySelections,
} from "./index";

describe("subject metadata", () => {
  it("has unique subject type, property, and complex column keys", () => {
    const typeKeys = new Set<string>();

    for (const type of getSubjectTypes()) {
      expect(typeKeys.has(type.key)).toBe(false);
      typeKeys.add(type.key);

      const propertyKeys = new Set<string>();
      for (const property of type.properties) {
        expect(propertyKeys.has(property.key)).toBe(false);
        propertyKeys.add(property.key);

        if (property.kind === "complex") {
          const columnKeys = new Set<string>();
          for (const column of property.properties) {
            expect(column.kind).toBe("simple");
            expect(columnKeys.has(column.key)).toBe(false);
            columnKeys.add(column.key);
          }
        }
      }

      expect(propertyKeys.has(type.displayNameProperty)).toBe(true);
    }
  });

  it("removes property-like concepts as top-level subject types", () => {
    expect(getSubjectTypeDefinition("directorship")).toBeNull();
    expect(getSubjectTypeDefinition("employment")).toBeNull();
    expect(getSubjectTypeDefinition("qualification")).toBeNull();
    expect(getSubjectTypeDefinition("membership")).toBeNull();
  });

  it("looks up subject types, properties, and complex table columns", () => {
    expect(getSubjectTypeDefinition("person")?.label).toBe("Person");
    expect(getSubjectPropertyDefinition("person", "date_of_birth")?.kind).toBe(
      "simple",
    );
    expect(
      getSubjectComplexPropertyColumnDefinition(
        "person",
        "directorships",
        "company",
      )?.valueType,
    ).toBe("text");
    expect(getSubjectPropertyDefinition("person", "not_real")).toBeNull();
  });
});

describe("subject value validation", () => {
  it("normalizes simple values", () => {
    const result = normalizeSubjectValues("person", {
      name: "  Jane Doe  ",
      date_of_birth: "1988-04-12",
    });

    expect(result).toEqual({
      valid: true,
      values: {
        name: "Jane Doe",
        date_of_birth: "1988-04-12",
      },
    });
  });

  it("normalizes repeatable complex table values", () => {
    const result = normalizeSubjectValues("person", {
      name: "Jane Doe",
      directorships: [
        {
          company: "  Example Ltd  ",
          role: "Director",
          date_started: "2021-01-01",
          date_left: "",
        },
      ],
    });

    expect(result).toEqual({
      valid: true,
      values: {
        name: "Jane Doe",
        directorships: [
          {
            company: "Example Ltd",
            role: "Director",
            date_started: "2021-01-01",
          },
        ],
      },
    });
  });

  it("rejects missing required values", () => {
    expect(normalizeSubjectValues("person", {})).toEqual({
      valid: false,
      error: "Name is required.",
    });
  });

  it("rejects invalid dates and select options", () => {
    expect(
      normalizeSubjectValues("person", {
        name: "Jane Doe",
        date_of_birth: "12/04/1988",
      }),
    ).toEqual({
      valid: false,
      error: "Date of birth must use YYYY-MM-DD.",
    });

    expect(
      normalizeSubjectValues("person", {
        name: "Jane Doe",
        date_of_birth: "2024-02-31",
      }),
    ).toEqual({
      valid: false,
      error: "Date of birth must use YYYY-MM-DD.",
    });

    expect(
      normalizeSubjectValues("person", {
        name: "Jane Doe",
        gender: "unknown",
      }),
    ).toEqual({
      valid: false,
      error: "Gender must be an available option.",
    });
  });

  it("rejects unknown subject types, properties, and table columns", () => {
    expect(normalizeSubjectValues("not_real", {})).toEqual({
      valid: false,
      error: "Subject type is invalid.",
    });

    expect(
      normalizeSubjectValues("person", {
        name: "Jane Doe",
        not_real: "value",
      }),
    ).toEqual({
      valid: false,
      error: "Subject property is invalid: not_real.",
    });

    expect(
      normalizeSubjectValues("person", {
        name: "Jane Doe",
        directorships: [{ not_real: "value" }],
      }),
    ).toEqual({
      valid: false,
      error: "Directorships column is invalid: not_real.",
    });
  });

  it("rejects complex properties that are not table rows", () => {
    expect(
      normalizeSubjectValues("person", {
        name: "Jane Doe",
        directorships: { company: "Example Ltd" },
      }),
    ).toEqual({
      valid: false,
      error: "Directorships must be a table of rows.",
    });
  });

  it("builds a display name from the configured display property", () => {
    expect(subjectDisplayName("person", { name: "Jane Doe" })).toBe("Jane Doe");
    expect(subjectDisplayName("person", {})).toBe("Untitled Subject");
  });
});

describe("subject property selection", () => {
  it("validates simple properties and complex table columns", () => {
    expect(
      validateSubjectPropertySelections("person", [
        { key: "name" },
        {
          key: "directorships",
          columns: [{ key: "company" }, { key: "role" }],
        },
      ]),
    ).toEqual({
      valid: true,
      selectedProperties: [
        { key: "name" },
        {
          key: "directorships",
          columns: [{ key: "company" }, { key: "role" }],
        },
      ],
    });
  });

  it("rejects invalid property selections", () => {
    expect(validateSubjectPropertySelections("person", [{ key: "not_real" }])).toEqual({
      valid: false,
      error: "Subject property is invalid.",
    });

    expect(
      validateSubjectPropertySelections("person", [
        { key: "directorships", columns: [{ key: "not_real" }] },
      ]),
    ).toEqual({
      valid: false,
      error: "Complex property column is invalid.",
    });
  });

  it("extracts selected values including full matching table rows", () => {
    expect(
      extractSelectedSubjectValues(
        "person",
        {
          name: "Jane Doe",
          date_of_birth: "1988-04-12",
          directorships: [
            {
              company: "Example Ltd",
              role: "Director",
              date_started: "2021-01-01",
            },
          ],
        },
        [
          { key: "name" },
          {
            key: "directorships",
            columns: [{ key: "company" }, { key: "role" }],
          },
        ],
      ),
    ).toEqual({
      name: "Jane Doe",
      directorships: [
        {
          company: "Example Ltd",
          role: "Director",
        },
      ],
    });
  });
});
