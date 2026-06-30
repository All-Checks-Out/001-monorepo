export const EVENT_SOURCES = {
  onboarding: "aco010.onboarding",
  documentAnalysis: "aco010.document-analysis",
} as const;

export const EVENT_DETAIL_TYPES = {
  evidenceUploadRequested: "evidence.upload-requested",
  evidenceObjectCreated: "evidence.object-created",
  documentAnalysisCompleted: "document-analysis.completed",
} as const;

export type EvidenceUploadRequestedEvent = {
  version: 1;
  eventId: string;
  eventType: typeof EVENT_DETAIL_TYPES.evidenceUploadRequested;
  evidenceId: number;
  checklistTaskId: number;
  providerCorporationId: number;
  uploadedByAppUserId: number;
  bucketName: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
  uploadTimeTags: string[];
  occurredAt: string;
};

export type EvidenceObjectCreatedEvent = {
  version: 1;
  eventId: string;
  eventType: typeof EVENT_DETAIL_TYPES.evidenceObjectCreated;
  evidenceId: number;
  checklistTaskId: number;
  providerCorporationId: number;
  uploadedByAppUserId: number;
  bucketName: string;
  objectKey: string;
  originalFilename: string;
  contentType: string;
  uploadTimeTags: string[];
  occurredAt: string;
};

export type DocumentAnalysisCompletedEvent = {
  version: 1;
  eventId: string;
  eventType: typeof EVENT_DETAIL_TYPES.documentAnalysisCompleted;
  evidenceId: number;
  objectKey: string;
  analysisJobId: string;
  automaticTags: {
    tag: string;
    confidence: number | null;
    source: "aws-rekognition";
  }[];
  occurredAt: string;
};

export type DomainEvent =
  | EvidenceUploadRequestedEvent
  | EvidenceObjectCreatedEvent
  | DocumentAnalysisCompletedEvent;
