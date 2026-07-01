import { Router } from "express";
import {
  approveAssociationAccessRequest,
  approveAssociationCorporationApplication,
  changeAssociationDDQPackStatusController,
  createAssociationDDQPackController,
  createAssociationDDQPackItemController,
  createAssociationFormTemplateController,
  deleteAssociationDDQPackController,
  deleteAssociationDDQPackItemController,
  deleteAssociationFormTemplateController,
  getAssociationAccessRequests,
  getAssociationCorporationApplications,
  getAssociationCorporations,
  getAssociationUsers,
  listAssociationDDQPackItems,
  listAssociationDDQPacks,
  listAssociationFormTemplates,
  readAssociationDDQPack,
  readAssociationFormTemplate,
  rejectAssociationAccessRequest,
  rejectAssociationCorporationApplication,
  saveAssociationDDQPackDraftController,
  updateAssociationDDQPackController,
  updateAssociationDDQPackItemController,
  updateAssociationFormTemplateController,
} from "../controllers/associationController";
import { getHealth } from "../controllers/healthController";
import {
  completeLocalDevEvidenceUpload,
  listLocalDevUsers,
} from "../controllers/localDevController";
import {
  approveProviderCorporationApplication,
  approveProviderAccessRequest,
  changeProviderDDQChecklistStatus,
  changeProviderDDQChecklistTaskStatus,
  completeProviderDDQChecklistTaskFormResponse,
  createProviderDDQChecklist,
  createProviderDDQChecklistTaskEvidenceUploadUrl,
  createProviderDDQPack,
  getProviderCorporationApplications,
  getProviderAccessRequests,
  listAvailableProviderDDQPacks,
  listProviderDDQPackItems,
  listProviderDDQPacks,
  readProviderDDQChecklist,
  readProviderDDQChecklistTask,
  rejectProviderCorporationApplication,
  rejectProviderAccessRequest,
  saveProviderDDQChecklistTaskFormResponse,
  updateProviderDDQChecklistTaskEvidenceTags,
} from "../controllers/providerController";
import {
  createPublicAccessRequest,
  createPublicCorporationApplication,
  getPublicProviders,
} from "../controllers/publicController";
import {
  getMe,
  getMyAccessRequests,
  getMyCorporation,
  getMyUsers,
  inviteMyUser,
  updateMyCorporationUserPermissions,
} from "../controllers/sharedController";
import {
  createRootUser,
  fullFactoryResetDemoData,
  getRootSetupStatus,
  recreateSampleData,
  seededFactoryResetDemoData,
} from "../controllers/setupController";

export const publicRoutes = Router();
export const protectedRoutes = Router();
export const localDevRoutes = Router();

publicRoutes.get("/health", getHealth);
publicRoutes.post("/corporation-applications", createPublicCorporationApplication);
publicRoutes.get("/providers", getPublicProviders);
publicRoutes.post("/access-requests", createPublicAccessRequest);
publicRoutes.get("/root-user", getRootSetupStatus);
publicRoutes.post("/root-user", createRootUser);
publicRoutes.post("/data/full-factory-reset", fullFactoryResetDemoData);
publicRoutes.post("/data/seeded-factory-reset", seededFactoryResetDemoData);
publicRoutes.post("/data/recreate-sample-data", recreateSampleData);

localDevRoutes.get("/users", listLocalDevUsers);
localDevRoutes.post("/evidence-uploads/complete", completeLocalDevEvidenceUpload);

protectedRoutes.get("/me", getMe);
protectedRoutes.get("/my-corporation", getMyCorporation);
protectedRoutes.get("/my-users", getMyUsers);
protectedRoutes.post("/my-users/invites", inviteMyUser);
protectedRoutes.put("/my-users/:id/permissions", updateMyCorporationUserPermissions);
protectedRoutes.get("/association/corporation-applications", getAssociationCorporationApplications);
protectedRoutes.post(
  "/association/corporation-applications/:id/approve",
  approveAssociationCorporationApplication,
);
protectedRoutes.post(
  "/association/corporation-applications/:id/reject",
  rejectAssociationCorporationApplication,
);
protectedRoutes.get("/association/corporations", getAssociationCorporations);
protectedRoutes.get("/association/users", getAssociationUsers);
protectedRoutes.get("/association/access-requests", getAssociationAccessRequests);
protectedRoutes.post("/association/access-requests/:id/approve", approveAssociationAccessRequest);
protectedRoutes.post("/association/access-requests/:id/reject", rejectAssociationAccessRequest);
protectedRoutes.get("/association/form-templates", listAssociationFormTemplates);
protectedRoutes.post("/association/form-templates", createAssociationFormTemplateController);
protectedRoutes.get("/association/form-templates/:id", readAssociationFormTemplate);
protectedRoutes.put("/association/form-templates/:id", updateAssociationFormTemplateController);
protectedRoutes.delete("/association/form-templates/:id", deleteAssociationFormTemplateController);
protectedRoutes.get("/association/ddq-packs", listAssociationDDQPacks);
protectedRoutes.post("/association/ddq-packs", createAssociationDDQPackController);
protectedRoutes.put("/association/ddq-packs/:packId/draft", saveAssociationDDQPackDraftController);
protectedRoutes.get("/association/ddq-packs/:id", readAssociationDDQPack);
protectedRoutes.patch("/association/ddq-packs/:id", updateAssociationDDQPackController);
protectedRoutes.post("/association/ddq-packs/:id/status", changeAssociationDDQPackStatusController);
protectedRoutes.delete("/association/ddq-packs/:id", deleteAssociationDDQPackController);
protectedRoutes.get("/association/ddq-packs/:packId/items", listAssociationDDQPackItems);
protectedRoutes.post("/association/ddq-packs/:packId/items", createAssociationDDQPackItemController);
protectedRoutes.patch(
  "/association/ddq-packs/:packId/items/:itemId",
  updateAssociationDDQPackItemController,
);
protectedRoutes.delete(
  "/association/ddq-packs/:packId/items/:itemId",
  deleteAssociationDDQPackItemController,
);
protectedRoutes.get("/provider/access-requests", getProviderAccessRequests);
protectedRoutes.post("/provider/access-requests/:id/approve", approveProviderAccessRequest);
protectedRoutes.post("/provider/access-requests/:id/reject", rejectProviderAccessRequest);
protectedRoutes.get("/provider/ddq-packs", listProviderDDQPacks);
protectedRoutes.post("/provider/ddq-packs", createProviderDDQPack);
protectedRoutes.get("/provider/ddq-packs/available", listAvailableProviderDDQPacks);
protectedRoutes.get("/provider/ddq-packs/:packId/checklist", readProviderDDQChecklist);
protectedRoutes.post("/provider/ddq-packs/:packId/checklist", createProviderDDQChecklist);
protectedRoutes.post("/provider/ddq-packs/:packId/checklist/status", changeProviderDDQChecklistStatus);
protectedRoutes.post(
  "/provider/ddq-packs/:packId/checklist/tasks/:taskId/status",
  changeProviderDDQChecklistTaskStatus,
);
protectedRoutes.get(
  "/provider/ddq-packs/:packId/checklist/tasks/:taskId",
  readProviderDDQChecklistTask,
);
protectedRoutes.put(
  "/provider/ddq-packs/:packId/checklist/tasks/:taskId/form-response",
  saveProviderDDQChecklistTaskFormResponse,
);
protectedRoutes.post(
  "/provider/ddq-packs/:packId/checklist/tasks/:taskId/form-response/complete",
  completeProviderDDQChecklistTaskFormResponse,
);
protectedRoutes.post(
  "/provider/ddq-packs/:packId/checklist/tasks/:taskId/evidence/upload-url",
  createProviderDDQChecklistTaskEvidenceUploadUrl,
);
protectedRoutes.put(
  "/provider/ddq-packs/:packId/checklist/tasks/:taskId/evidence/:evidenceId/tags",
  updateProviderDDQChecklistTaskEvidenceTags,
);
protectedRoutes.get("/provider/ddq-packs/:packId/items", listProviderDDQPackItems);
protectedRoutes.get("/provider/corporation-applications", getProviderCorporationApplications);
protectedRoutes.post(
  "/provider/corporation-applications/:id/approve",
  approveProviderCorporationApplication,
);
protectedRoutes.post(
  "/provider/corporation-applications/:id/reject",
  rejectProviderCorporationApplication,
);
protectedRoutes.get("/my-access-requests", getMyAccessRequests);
