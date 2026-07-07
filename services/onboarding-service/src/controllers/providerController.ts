import type { Request, Response } from "express";
import { z } from "zod";
import { handleError, parseBody, parseId } from "./http";
import { requireProviderUser } from "../services/currentUser";
import {
  archiveProviderSubject as archiveProviderSubjectService,
  addProviderDDQPack as addProviderDDQPackService,
  approveProviderCorporationApplication as approveProviderCorporationApplicationService,
  changeProviderDDQChecklistStatus as changeProviderDDQChecklistStatusService,
  changeProviderDDQChecklistTaskStatus as changeProviderDDQChecklistTaskStatusService,
  completeProviderDDQChecklistTaskFormResponse as completeProviderDDQChecklistTaskFormResponseService,
  createProviderSubject as createProviderSubjectService,
  createProviderDDQChecklistTaskEvidenceUploadUrl as createProviderDDQChecklistTaskEvidenceUploadUrlService,
  decideProviderAccessRequest,
  getAvailableProviderDDQPacks as getAvailableProviderDDQPacksService,
  getOrCreateProviderDDQChecklist as getOrCreateProviderDDQChecklistService,
  getProviderDDQChecklist as getProviderDDQChecklistService,
  getProviderDDQChecklistTask as getProviderDDQChecklistTaskService,
  getProviderDDQPackItems as getProviderDDQPackItemsService,
  getProviderDDQPacks as getProviderDDQPacksService,
  getProviderCorporationApplications as getProviderCorporationApplicationsService,
  getProviderAccessRequests as getProviderAccessRequestsService,
  getProviderSubject as getProviderSubjectService,
  getProviderSubjects as getProviderSubjectsService,
  rejectProviderCorporationApplication as rejectProviderCorporationApplicationService,
  saveProviderDDQChecklistTaskFormResponse as saveProviderDDQChecklistTaskFormResponseService,
  selectProviderDDQChecklistBranchOption as selectProviderDDQChecklistBranchOptionService,
  updateProviderSubject as updateProviderSubjectService,
  updateProviderDDQChecklistTaskEvidenceTags as updateProviderDDQChecklistTaskEvidenceTagsService,
} from "../services/onboardingService";

const providerDDQPackBodySchema = z.object({
  ddq_pack_id: z.number().int().positive(),
});

const ddqChecklistStatusBodySchema = z.object({
  action: z.enum(["complete", "withdraw", "restore", "reopen"]),
});

const ddqBranchSelectionBodySchema = z.object({
  option_id: z.string().trim().min(1),
});

const evidenceUploadUrlBodySchema = z.object({
  original_filename: z.string().trim().min(1),
  content_type: z.string().trim().min(1),
  file_size_bytes: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
});

const evidenceTagsBodySchema = z.object({
  tags: z.array(z.string()),
});

const formScalarValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const subjectTableRowValueSchema = z.record(z.string(), formScalarValueSchema);
const subjectEntryValueSchema = z.record(
  z.string(),
  z.union([formScalarValueSchema, z.array(subjectTableRowValueSchema)]),
);
const formValueSchema = z.union([
  formScalarValueSchema,
  z.array(subjectEntryValueSchema),
]);

const formResponseBodySchema = z.object({
  values: z.record(z.string(), formValueSchema),
});

const subjectValueSchema = z.union([
  formScalarValueSchema,
  z.array(subjectTableRowValueSchema),
]);

const subjectBodySchema = z.object({
  subject_type_key: z.string().trim().min(1),
  values: z.record(z.string(), subjectValueSchema),
});

export async function getProviderAccessRequests(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  try {
    const result = await getProviderAccessRequestsService(context);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list access requests.");
  }
}

export async function getProviderCorporationApplications(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  try {
    const result = await getProviderCorporationApplicationsService(context);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list corporation applications.");
  }
}

export async function listProviderDDQPacks(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  try {
    const result = await getProviderDDQPacksService(context);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list DDQ Packs.");
  }
}

export async function listProviderSubjects(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  try {
    const result = await getProviderSubjectsService(context, {
      subjectTypeKey: stringQuery(req.query.subject_type_key),
      q: stringQuery(req.query.q),
      includeArchived: req.query.include_archived === "true",
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list Subjects.");
  }
}

export async function readProviderSubject(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const subjectId = parseNamedId(req, res, "subjectId");
  if (subjectId === null) return;

  try {
    const result = await getProviderSubjectService(context, subjectId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not read Subject.");
  }
}

export async function createProviderSubject(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const body = parseBody(req, res, subjectBodySchema);
  if (!body) return;

  try {
    const result = await createProviderSubjectService(context, {
      subjectTypeKey: body.subject_type_key,
      values: body.values,
    });
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, "Could not create Subject.");
  }
}

export async function updateProviderSubject(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const subjectId = parseNamedId(req, res, "subjectId");
  if (subjectId === null) return;

  const body = parseBody(req, res, subjectBodySchema);
  if (!body) return;

  try {
    const result = await updateProviderSubjectService(context, subjectId, {
      subjectTypeKey: body.subject_type_key,
      values: body.values,
    });
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not update Subject.");
  }
}

export async function archiveProviderSubject(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const subjectId = parseNamedId(req, res, "subjectId");
  if (subjectId === null) return;

  try {
    const result = await archiveProviderSubjectService(context, subjectId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not archive Subject.");
  }
}

export async function listAvailableProviderDDQPacks(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  try {
    const result = await getAvailableProviderDDQPacksService(context);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list available DDQ Packs.");
  }
}

export async function createProviderDDQPack(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const body = parseBody(req, res, providerDDQPackBodySchema);
  if (!body) return;

  try {
    const result = await addProviderDDQPackService(context, body.ddq_pack_id);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, "Could not add DDQ Pack.");
  }
}

export async function listProviderDDQPackItems(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const packId = parseNamedId(req, res, "packId");
  if (packId === null) return;

  try {
    const result = await getProviderDDQPackItemsService(context, packId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list DDQ Pack Items.");
  }
}

export async function readProviderDDQChecklist(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const packId = parseNamedId(req, res, "packId");
  if (packId === null) return;

  try {
    const result = await getProviderDDQChecklistService(context, packId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not read DDQ Checklist.");
  }
}

export async function createProviderDDQChecklist(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const packId = parseNamedId(req, res, "packId");
  if (packId === null) return;

  try {
    const result = await getOrCreateProviderDDQChecklistService(context, packId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not create DDQ Checklist.");
  }
}

export async function changeProviderDDQChecklistStatus(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const packId = parseNamedId(req, res, "packId");
  if (packId === null) return;

  const body = parseBody(req, res, ddqChecklistStatusBodySchema);
  if (!body) return;

  try {
    const result = await changeProviderDDQChecklistStatusService(
      context,
      packId,
      body.action,
    );
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not update DDQ Checklist status.");
  }
}

export async function changeProviderDDQChecklistTaskStatus(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const packId = parseNamedId(req, res, "packId");
  if (packId === null) return;

  const taskId = parseNamedId(req, res, "taskId");
  if (taskId === null) return;

  const body = parseBody(req, res, ddqChecklistStatusBodySchema);
  if (!body) return;

  try {
    const result = await changeProviderDDQChecklistTaskStatusService(
      context,
      packId,
      taskId,
      body.action,
    );
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not update DDQ Checklist Task status.");
  }
}

export async function selectProviderDDQChecklistBranchOption(
  req: Request,
  res: Response,
) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const packId = parseNamedId(req, res, "packId");
  if (packId === null) return;

  const branchTaskId = parseNamedId(req, res, "branchTaskId");
  if (branchTaskId === null) return;

  const body = parseBody(req, res, ddqBranchSelectionBodySchema);
  if (!body) return;

  try {
    const result = await selectProviderDDQChecklistBranchOptionService(
      context,
      packId,
      branchTaskId,
      body.option_id,
    );
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not update branch selection.");
  }
}

export async function readProviderDDQChecklistTask(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const packId = parseNamedId(req, res, "packId");
  if (packId === null) return;

  const taskId = parseNamedId(req, res, "taskId");
  if (taskId === null) return;

  try {
    const result = await getProviderDDQChecklistTaskService(context, packId, taskId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not read DDQ Checklist Task.");
  }
}

export async function saveProviderDDQChecklistTaskFormResponse(
  req: Request,
  res: Response,
) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const packId = parseNamedId(req, res, "packId");
  if (packId === null) return;

  const taskId = parseNamedId(req, res, "taskId");
  if (taskId === null) return;

  const body = parseBody(req, res, formResponseBodySchema);
  if (!body) return;

  try {
    const result = await saveProviderDDQChecklistTaskFormResponseService(
      context,
      packId,
      taskId,
      { values: body.values },
    );
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not save form response.");
  }
}

export async function completeProviderDDQChecklistTaskFormResponse(
  req: Request,
  res: Response,
) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const packId = parseNamedId(req, res, "packId");
  if (packId === null) return;

  const taskId = parseNamedId(req, res, "taskId");
  if (taskId === null) return;

  const body = parseBody(req, res, formResponseBodySchema);
  if (!body) return;

  try {
    const result = await completeProviderDDQChecklistTaskFormResponseService(
      context,
      packId,
      taskId,
      { values: body.values },
    );
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not complete form response.");
  }
}

export async function createProviderDDQChecklistTaskEvidenceUploadUrl(
  req: Request,
  res: Response,
) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const packId = parseNamedId(req, res, "packId");
  if (packId === null) return;

  const taskId = parseNamedId(req, res, "taskId");
  if (taskId === null) return;

  const body = parseBody(req, res, evidenceUploadUrlBodySchema);
  if (!body) return;

  try {
    const result = await createProviderDDQChecklistTaskEvidenceUploadUrlService(
      context,
      packId,
      taskId,
      {
        originalFilename: body.original_filename,
        contentType: body.content_type,
        fileSizeBytes: body.file_size_bytes,
        tags: body.tags,
      },
    );
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, "Could not create evidence upload URL.");
  }
}

export async function updateProviderDDQChecklistTaskEvidenceTags(
  req: Request,
  res: Response,
) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const packId = parseNamedId(req, res, "packId");
  if (packId === null) return;

  const taskId = parseNamedId(req, res, "taskId");
  if (taskId === null) return;

  const evidenceId = parseNamedId(req, res, "evidenceId");
  if (evidenceId === null) return;

  const body = parseBody(req, res, evidenceTagsBodySchema);
  if (!body) return;

  try {
    const result = await updateProviderDDQChecklistTaskEvidenceTagsService(
      context,
      packId,
      taskId,
      evidenceId,
      body.tags,
    );
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not update checklist task evidence tags.");
  }
}

export async function approveProviderCorporationApplication(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await approveProviderCorporationApplicationService(context, id);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not approve corporation application.");
  }
}

export async function rejectProviderCorporationApplication(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await rejectProviderCorporationApplicationService(context, id);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not reject corporation application.");
  }
}

export async function approveProviderAccessRequest(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await decideProviderAccessRequest(context, id, "approve");
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not approve access request.");
  }
}

export async function rejectProviderAccessRequest(req: Request, res: Response) {
  const context = await requireProviderUser(req, res);
  if (!context) return;

  const id = parseId(req, res);
  if (id === null) return;

  try {
    const result = await decideProviderAccessRequest(context, id, "reject");
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not reject access request.");
  }
}

function parseNamedId(req: Request, res: Response, name: string) {
  const id = Number(req.params[name]);

  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: `Invalid ${name}.` });
    return null;
  }

  return id;
}

function stringQuery(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}
