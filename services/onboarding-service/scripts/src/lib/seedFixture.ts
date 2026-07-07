import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { normalizeSubjectValues } from "@shared/subjects";
import { z } from "zod";

const corporationTypeSchema = z.enum([
  "ASSOCIATION",
  "PROVIDER",
  "AGENT",
  "STAKEHOLDER",
]);
const corporationStatusSchema = z.enum(["pending", "approved", "rejected"]);
const userStatusSchema = z.enum(["invited", "active", "disabled"]);
const applicationTypeSchema = z.enum(["PROVIDER", "AGENT", "STAKEHOLDER"]);
const requestStatusSchema = z.enum(["pending", "approved", "rejected"]);
const ddqPackStatusSchema = z.enum(["draft", "published", "archived"]);
const ddqPackItemKindSchema = z.enum(["ddq-task", "checkpoint"]);
const ddqTaskTypeSchema = z.enum([
  "document-upload",
  "form-completion",
  "photo-upload",
]);
const ddqChecklistStatusSchema = z.enum(["active", "completed", "withdrawn"]);
const subjectScalarValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const subjectTableRowValueSchema = z.record(z.string(), subjectScalarValueSchema);
const subjectValueSchema = z.union([
  subjectScalarValueSchema,
  z.array(subjectTableRowValueSchema),
]);
const formItemBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  helpText: z.string().optional(),
  required: z.boolean(),
});
const formItemSchema = z.discriminatedUnion("type", [
  formItemBaseSchema.extend({
    type: z.literal("text"),
    placeholder: z.string().optional(),
  }),
  formItemBaseSchema.extend({
    type: z.literal("textarea"),
    placeholder: z.string().optional(),
  }),
  formItemBaseSchema.extend({
    type: z.literal("date"),
  }),
  formItemBaseSchema.extend({
    type: z.literal("phone"),
    placeholder: z.string().optional(),
  }),
  formItemBaseSchema.extend({
    type: z.literal("select"),
    options: z.array(z.string()),
  }),
  formItemBaseSchema.extend({
    type: z.literal("radio"),
    options: z.array(z.string()),
  }),
  formItemBaseSchema.extend({
    type: z.literal("boolean"),
  }),
]);
const formTemplateSchema = z.object({
  version: z.literal(1),
  items: z.array(formItemSchema),
});

const ddqPackItemSchema = z.discriminatedUnion("kind", [
  z.object({
    legacyId: z.number().int().positive(),
    position: z.number().int().positive(),
    kind: z.literal("checkpoint"),
    taskType: z.null(),
    title: z.string().min(1),
    config: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    legacyId: z.number().int().positive(),
    position: z.number().int().positive(),
    kind: z.literal("ddq-task"),
    taskType: ddqTaskTypeSchema,
    title: z.string().min(1),
    config: z.record(z.string(), z.unknown()).default({}),
  }),
]);

export const seedFixtureSchema = z.object({
  exportedAt: z.string(),
  sourceStage: z.string().optional(),
  corporations: z.array(
    z.object({
      legacyId: z.number().int().positive(),
      name: z.string().min(1),
      type: corporationTypeSchema,
      status: corporationStatusSchema,
    }),
  ),
  users: z.array(
    z.object({
      legacyId: z.number().int().positive(),
      corporationLegacyId: z.number().int().positive(),
      email: z.string().email(),
      status: userStatusSchema,
      permissions: z.array(z.string()).default([]),
    }),
  ),
  corporationApplications: z.array(
    z.object({
      legacyId: z.number().int().positive(),
      name: z.string().min(1),
      type: applicationTypeSchema,
      applicantEmail: z.string().email(),
      status: corporationStatusSchema,
      providerCorporationLegacyId: z.number().int().positive().nullable(),
    }),
  ),
  corporationAccessRequests: z.array(
    z.object({
      legacyId: z.number().int().positive(),
      requesterCorporationLegacyId: z.number().int().positive(),
      providerCorporationLegacyId: z.number().int().positive(),
      status: requestStatusSchema,
    }),
  ),
  ddqPacks: z.array(
    z.object({
      legacyId: z.number().int().positive(),
      associationCorporationLegacyId: z.number().int().positive(),
      name: z.string().min(1),
      validFrom: z.string().min(1),
      validTo: z.string().min(1),
      status: ddqPackStatusSchema,
      items: z.array(ddqPackItemSchema).min(1),
    }),
  ).default([]),
  formTemplates: z.array(
    z.object({
      legacyId: z.number().int().positive(),
      associationCorporationLegacyId: z.number().int().positive(),
      shortName: z.string().min(1),
      description: z.string().default(""),
      schema: formTemplateSchema,
    }),
  ).default([]),
  providerDDQPacks: z.array(
    z.object({
      legacyId: z.number().int().positive(),
      providerCorporationLegacyId: z.number().int().positive(),
      ddqPackLegacyId: z.number().int().positive(),
    }),
  ).default([]),
  providerDDQChecklists: z.array(
    z.object({
      legacyId: z.number().int().positive(),
      providerDDQPackLegacyId: z.number().int().positive(),
      status: ddqChecklistStatusSchema,
      tasks: z.array(
        z.object({
          ddqPackItemLegacyId: z.number().int().positive(),
          status: ddqChecklistStatusSchema,
        }),
      ),
    }),
  ).default([]),
  subjects: z.array(
    z.object({
      legacyId: z.string().min(1),
      providerCorporationLegacyId: z.number().int().positive(),
      subjectTypeKey: z.string().min(1),
      displayName: z.string().min(1),
      values: z.record(z.string(), subjectValueSchema),
    }).superRefine((subject, context) => {
      const validation = normalizeSubjectValues(
        subject.subjectTypeKey,
        subject.values,
      );

      if (!validation.valid) {
        context.addIssue({
          code: "custom",
          path: ["values"],
          message: validation.error,
        });
      }
    }),
  ).default([]),
});

export type SeedFixture = z.infer<typeof seedFixtureSchema>;

export function getSeedFixturePath() {
  return resolve(
    process.env.ACO24_SEED_FIXTURE
      ?? join(process.cwd(), "scripts", "src", "fixtures", "testing-seed-data.json"),
  );
}

export async function readSeedFixture() {
  const fixturePath = getSeedFixturePath();
  const raw = await readFile(fixturePath, "utf8");
  return seedFixtureSchema.parse(JSON.parse(raw));
}

export async function writeSeedFixture(fixture: SeedFixture) {
  const fixturePath = getSeedFixturePath();
  await mkdir(dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  return fixturePath;
}
