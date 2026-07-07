import type { Request, Response } from "express";
import { z } from "zod";
import { handleError, parseBody, parseId } from "./http";
import { requireAssociationUserWithPermission } from "../services/currentUser";
import {
  changeAssociationDDQPackStatus,
  createAssociationFormTemplate,
  approveAssociationApplication,
  createAssociationDDQPack,
  createAssociationDDQPackItem,
  deleteAssociationDDQPack,
  deleteAssociationDDQPackItem,
  deleteAssociationFormTemplate,
  decideAssociationAccessRequest,
  getAssociationAccessRequests as getAssociationAccessRequestsService,
  getAssociationApplications,
  getAssociationCorporations as getAssociationCorporationsService,
  getAssociationDDQPack,
  getAssociationDDQPackItems,
  getAssociationDDQPacks,
  getAssociationFormTemplate,
  getAssociationFormTemplates,
  getAssociationUsers as getAssociationUsersService,
  rejectAssociationApplication,
  saveAssociationDDQPackDraft,
  updateAssociationDDQPack,
  updateAssociationDDQPackItem,
  updateAssociationFormTemplate,
} from "../services/onboardingService";

const packBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  valid_from: z.string().min(1, "Valid from is required."),
  valid_to: z.string().min(1, "Valid to is required."),
});

const packStatusBodySchema = z.object({
  action: z.enum(["publish", "archive", "restore"]),
});

const ddqTaskTypeSchema = z.enum([
  "document-upload",
  "form-completion",
  "photo-upload",
]);

const itemBodySchema = z.object({
  insert_after_item_id: z.number().int().positive().nullable().optional(),
  client_id: z.string().trim().min(1).optional(),
  parent_branch_item_id: z.number().int().positive().nullable().optional(),
  parent_branch_item_client_id: z.string().trim().min(1).nullable().optional(),
  parent_branch_option_id: z.string().trim().min(1).nullable().optional(),
  kind: z.enum(["ddq-task", "checkpoint", "branch"]),
  task_type: ddqTaskTypeSchema.nullable().optional(),
  title: z.string().trim().min(1, "Title is required."),
  config: z.record(z.string(), z.unknown()).default({}),
});

const draftItemBodySchema = itemBodySchema
  .omit({ insert_after_item_id: true })
  .strict();

const packDraftBodySchema = z.object({
  pack: packBodySchema,
  items: z.array(draftItemBodySchema),
});

const formTemplateBodySchema = z.object({
  short_name: z.string().trim().min(1, "Short name is required."),
  description: z.string().default(""),
  schema_json: z
    .unknown()
    .refine((value) => value !== undefined, "Form template schema is required."),
});

export async function getAssociationCorporationApplications(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(
    req,
    res,
    "association-provider-requests:read",
  );
  if (!context) return;

  try {
    const result = await getAssociationApplications();
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list corporation applications.");
  }
}

export async function approveAssociationCorporationApplication(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(
    req,
    res,
    "association-provider-requests:approve",
  );
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await approveAssociationApplication(id);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not approve corporation application.");
  }
}

export async function rejectAssociationCorporationApplication(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(
    req,
    res,
    "association-provider-requests:approve",
  );
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await rejectAssociationApplication(id);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not reject corporation application.");
  }
}

export async function getAssociationCorporations(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(
    req,
    res,
    "all-corporations:read",
  );
  if (!context) return;

  try {
    const result = await getAssociationCorporationsService();
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list corporations.");
  }
}

export async function getAssociationUsers(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(
    req,
    res,
    "all-users:read",
  );
  if (!context) return;

  try {
    const result = await getAssociationUsersService();
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list users.");
  }
}

export async function getAssociationAccessRequests(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(
    req,
    res,
    "association-provider-requests:read",
  );
  if (!context) return;

  try {
    const result = await getAssociationAccessRequestsService();
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list access requests.");
  }
}

export async function approveAssociationAccessRequest(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(
    req,
    res,
    "association-provider-requests:approve",
  );
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await decideAssociationAccessRequest(id, "approve");
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not approve access request.");
  }
}

export async function rejectAssociationAccessRequest(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(
    req,
    res,
    "association-provider-requests:approve",
  );
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await decideAssociationAccessRequest(id, "reject");
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not reject access request.");
  }
}

export async function listAssociationDDQPacks(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-ddq-packs:read");
  if (!context) return;

  try {
    const result = await getAssociationDDQPacks(context);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list DDQ Packs.");
  }
}

export async function readAssociationDDQPack(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-ddq-packs:read");
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await getAssociationDDQPack(context, id);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not read DDQ Pack.");
  }
}

export async function createAssociationDDQPackController(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-ddq-packs:edit");
  if (!context) return;

  const body = parseBody(req, res, packBodySchema);
  if (!body) return;

  try {
    const result = await createAssociationDDQPack(context, {
      name: body.name,
      validFrom: body.valid_from,
      validTo: body.valid_to,
    });
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, "Could not create DDQ Pack.");
  }
}

export async function updateAssociationDDQPackController(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-ddq-packs:edit");
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  const body = parseBody(req, res, packBodySchema);
  if (!body) return;

  try {
    const result = await updateAssociationDDQPack(context, id, {
      name: body.name,
      validFrom: body.valid_from,
      validTo: body.valid_to,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not update DDQ Pack.");
  }
}

export async function saveAssociationDDQPackDraftController(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-ddq-packs:edit");
  if (!context) return;

  const packId = parsePackId(req, res);
  if (packId === null) return;

  const body = parseBody(req, res, packDraftBodySchema);
  if (!body) return;

  try {
    const result = await saveAssociationDDQPackDraft(context, packId, {
      pack: {
        name: body.pack.name,
        validFrom: body.pack.valid_from,
        validTo: body.pack.valid_to,
      },
      items: body.items.map((item) => ({
        clientId: item.client_id,
        kind: item.kind,
        taskType: item.task_type ?? null,
        title: item.title,
        config: item.config,
        parentBranchItemId: item.parent_branch_item_id ?? null,
        parentBranchOptionId: item.parent_branch_option_id ?? null,
        parentBranchItemClientId: item.parent_branch_item_client_id ?? null,
      })),
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not save DDQ Pack draft.");
  }
}

export async function changeAssociationDDQPackStatusController(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-ddq-packs:edit");
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  const body = parseBody(req, res, packStatusBodySchema);
  if (!body) return;

  try {
    const result = await changeAssociationDDQPackStatus(context, id, body.action);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not update DDQ Pack status.");
  }
}

export async function deleteAssociationDDQPackController(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-ddq-packs:edit");
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await deleteAssociationDDQPack(context, id);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not delete DDQ Pack.");
  }
}

export async function listAssociationDDQPackItems(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-ddq-packs:read");
  if (!context) return;

  const packId = parsePackId(req, res);
  if (packId === null) return;

  try {
    const result = await getAssociationDDQPackItems(context, packId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list DDQ Pack Items.");
  }
}

export async function createAssociationDDQPackItemController(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-ddq-packs:edit");
  if (!context) return;

  const packId = parsePackId(req, res);
  if (packId === null) return;

  const body = parseBody(req, res, itemBodySchema);
  if (!body) return;

  try {
    const result = await createAssociationDDQPackItem(
      context,
      packId,
      body.insert_after_item_id ?? null,
      {
        clientId: body.client_id,
        kind: body.kind,
        taskType: body.task_type ?? null,
        title: body.title,
        config: body.config,
        parentBranchItemId: body.parent_branch_item_id ?? null,
        parentBranchOptionId: body.parent_branch_option_id ?? null,
        parentBranchItemClientId: body.parent_branch_item_client_id ?? null,
      },
    );
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, "Could not create DDQ Pack Item.");
  }
}

export async function updateAssociationDDQPackItemController(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-ddq-packs:edit");
  if (!context) return;

  const packId = parsePackId(req, res);
  if (packId === null) return;

  const itemId = parseItemId(req, res);
  if (itemId === null) return;

  const body = parseBody(req, res, itemBodySchema.omit({ insert_after_item_id: true }));
  if (!body) return;

  try {
    const result = await updateAssociationDDQPackItem(context, packId, itemId, {
      clientId: body.client_id,
      kind: body.kind,
      taskType: body.task_type ?? null,
      title: body.title,
      config: body.config,
      parentBranchItemId: body.parent_branch_item_id ?? null,
      parentBranchOptionId: body.parent_branch_option_id ?? null,
      parentBranchItemClientId: body.parent_branch_item_client_id ?? null,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not update DDQ Pack Item.");
  }
}

export async function deleteAssociationDDQPackItemController(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-ddq-packs:edit");
  if (!context) return;

  const packId = parsePackId(req, res);
  if (packId === null) return;

  const itemId = parseItemId(req, res);
  if (itemId === null) return;

  try {
    const result = await deleteAssociationDDQPackItem(context, packId, itemId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not delete DDQ Pack Item.");
  }
}

export async function listAssociationFormTemplates(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-forms:read");
  if (!context) return;

  try {
    const result = await getAssociationFormTemplates(context);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list form templates.");
  }
}

export async function readAssociationFormTemplate(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-forms:read");
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await getAssociationFormTemplate(context, id);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not read form template.");
  }
}

export async function createAssociationFormTemplateController(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-forms:edit");
  if (!context) return;

  const body = parseBody(req, res, formTemplateBodySchema);
  if (!body) return;

  try {
    const result = await createAssociationFormTemplate(context, {
      shortName: body.short_name,
      description: body.description,
      schema: body.schema_json,
    });
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, "Could not create form template.");
  }
}

export async function updateAssociationFormTemplateController(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-forms:edit");
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  const body = parseBody(req, res, formTemplateBodySchema);
  if (!body) return;

  try {
    const result = await updateAssociationFormTemplate(context, id, {
      shortName: body.short_name,
      description: body.description,
      schema: body.schema_json,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not update form template.");
  }
}

export async function deleteAssociationFormTemplateController(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "association-forms:edit");
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await deleteAssociationFormTemplate(context, id);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not delete form template.");
  }
}

function parsePackId(req: Request, res: Response) {
  return parseNamedId(req, res, "packId");
}

function parseItemId(req: Request, res: Response) {
  return parseNamedId(req, res, "itemId");
}

function parseNamedId(req: Request, res: Response, name: string) {
  const id = Number(req.params[name]);

  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: `Invalid ${name}.` });
    return null;
  }

  return id;
}
