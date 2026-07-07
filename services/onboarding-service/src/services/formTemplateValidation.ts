import { z } from "zod";
import {
  getSubjectTypeDefinition,
  validateSubjectPropertySelections,
} from "@shared/subjects";
import type { FormItem } from "../database/onboardingTypes";

export class FormTemplateValidationError extends Error {}

const optionalCleanStringSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const formItemBaseShape = {
  id: z.string().trim().min(1, "Form item id is required."),
  label: z.string().trim().min(1, "Form item label is required."),
  helpText: optionalCleanStringSchema,
  required: z.boolean("Form item required flag is required."),
};

const optionsSchema = z
  .array(z.string(), "Form item options are required.")
  .transform((options) => options.map((option) => option.trim()).filter(Boolean))
  .refine((options) => options.length > 0, "At least one option is required.");

const subjectSimplePropertySelectionSchema = z.object({
  key: z.string().trim().min(1, "Subject property is required."),
}).strict();

const subjectComplexPropertySelectionSchema = z.object({
  key: z.string().trim().min(1, "Subject property is required."),
  columns: z
    .array(subjectSimplePropertySelectionSchema, "Subject table columns are required.")
    .refine((columns) => columns.length > 0, "Select at least one Subject table column."),
}).strict();

const subjectPropertySelectionSchema = z.union([
  subjectSimplePropertySelectionSchema,
  subjectComplexPropertySelectionSchema,
]);

const subjectPropertySelectionsSchema = z
  .array(subjectPropertySelectionSchema, "Subject properties are required.")
  .refine((properties) => properties.length > 0, "Select at least one Subject property.");

const formItemSchema = z.discriminatedUnion("type", [
  z.object({
    ...formItemBaseShape,
    type: z.literal("text"),
    placeholder: optionalCleanStringSchema,
  }).strict(),
  z.object({
    ...formItemBaseShape,
    type: z.literal("textarea"),
    placeholder: optionalCleanStringSchema,
  }).strict(),
  z.object({
    ...formItemBaseShape,
    type: z.literal("date"),
  }).strict(),
  z.object({
    ...formItemBaseShape,
    type: z.literal("phone"),
    placeholder: optionalCleanStringSchema,
  }).strict(),
  z.object({
    ...formItemBaseShape,
    type: z.literal("select"),
    options: optionsSchema,
  }).strict(),
  z.object({
    ...formItemBaseShape,
    type: z.literal("radio"),
    options: optionsSchema,
  }).strict(),
  z.object({
    ...formItemBaseShape,
    type: z.literal("boolean"),
  }).strict(),
  z.object({
    ...formItemBaseShape,
    type: z.literal("subject"),
    subjectTypeKey: z.string().trim().min(1, "Subject type is required."),
    repeatable: z.boolean("Subject repeatable flag is required."),
    selectedProperties: subjectPropertySelectionsSchema,
  }).strict().superRefine((item, context) => {
    const subjectType = getSubjectTypeDefinition(item.subjectTypeKey);
    if (!subjectType) {
      context.addIssue({
        code: "custom",
        message: "Subject group type is invalid.",
        path: ["subjectTypeKey"],
      });
      return;
    }

    const validation = validateSubjectPropertySelections(
      subjectType.key,
      item.selectedProperties,
    );
    if (!validation.valid) {
      context.addIssue({
        code: "custom",
        message: validation.error,
        path: ["selectedProperties"],
      });
    }
  }),
]);

const formTemplateSchema = z.object({
  version: z.literal(1, "Invalid form template schema."),
  items: z.array(formItemSchema, "Invalid form template schema."),
}).strict();

const formTemplateInputSchema = z.object({
  shortName: z.string().trim().min(1, "Short name is required."),
  description: z.string().trim(),
  schema: formTemplateSchema,
}).strict();

export function parseFormTemplateInput(input: unknown) {
  return parseDomain(formTemplateInputSchema, input);
}

export function parseFormItem(input: unknown): FormItem {
  return parseDomain(formItemSchema, input);
}

function parseDomain<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  throw new FormTemplateValidationError(
    result.error.issues[0]?.message ?? "Invalid form template schema.",
  );
}
