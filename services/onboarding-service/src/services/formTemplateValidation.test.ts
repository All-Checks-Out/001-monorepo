import { describe, expect, it } from "vitest";
import { FormTemplateValidationError, parseFormItem } from "./formTemplateValidation";

describe("formTemplateValidation", () => {
  it("preserves valid repeatable Subject items on form items", () => {
    const item = parseFormItem({
      id: "people",
      type: "subject",
      label: "People",
      required: true,
      subjectTypeKey: "person",
      repeatable: true,
      selectedProperties: [
        { key: "name" },
        {
          key: "directorships",
          columns: [{ key: "company" }, { key: "role" }],
        },
      ],
    });

    expect(item).toMatchObject({
      type: "subject",
      subjectTypeKey: "person",
      repeatable: true,
      selectedProperties: [
        { key: "name" },
        {
          key: "directorships",
          columns: [{ key: "company" }, { key: "role" }],
        },
      ],
    });
  });

  it("rejects unknown Subject types", () => {
    expect(() =>
      parseFormItem({
        id: "people",
        type: "subject",
        label: "People",
        required: false,
        subjectTypeKey: "unknown",
        repeatable: true,
        selectedProperties: [{ key: "name" }],
      }),
    ).toThrow(FormTemplateValidationError);
  });

  it("rejects unknown Subject properties", () => {
    expect(() =>
      parseFormItem({
        id: "people",
        type: "subject",
        label: "People",
        required: false,
        subjectTypeKey: "person",
        repeatable: true,
        selectedProperties: [{ key: "unknown" }],
      }),
    ).toThrow("Subject property is invalid.");
  });

  it("rejects unknown Subject table columns", () => {
    expect(() =>
      parseFormItem({
        id: "people",
        type: "subject",
        label: "People",
        required: false,
        subjectTypeKey: "person",
        repeatable: true,
        selectedProperties: [
          {
            key: "directorships",
            columns: [{ key: "unknown" }],
          },
        ],
      }),
    ).toThrow("Complex property column is invalid.");
  });
});
