import {
  EVENT_DETAIL_TYPES,
  type EvidenceObjectCreatedEvent,
  type EvidenceUploadRequestedEvent,
} from "@backend/events";
import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { createDbClient } from "../database/db";
import {
  createAnalysisJob,
  insertEventInbox,
  markEventInboxProcessed,
  replaceAnalysisTags,
  upsertObjectCreatedProjection,
  upsertUploadRequestedProjection,
} from "../database/documentRepository";
import { publishAnalysisCompletedEvent } from "../events/analysisEvents";
import { suggestImageTags } from "../services/tagSuggestions";

type EvidenceEvent = EvidenceUploadRequestedEvent | EvidenceObjectCreatedEvent;

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    try {
      const detail = parseDetail(record.body);

      if (!detail) {
        continue;
      }

      await processEvidenceEvent(detail);
    } catch (error) {
      console.error("Could not process evidence event.", error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};

function parseDetail(body: string) {
  const envelope = JSON.parse(body) as {
    detail?: EvidenceEvent;
  };
  const detail = envelope.detail ?? JSON.parse(body) as EvidenceEvent;

  if (
    detail.eventType !== EVENT_DETAIL_TYPES.evidenceUploadRequested &&
    detail.eventType !== EVENT_DETAIL_TYPES.evidenceObjectCreated
  ) {
    return null;
  }

  return detail;
}

async function processEvidenceEvent(detail: EvidenceEvent) {
  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const inserted = await insertEventInbox(client, detail);
    if (!inserted) {
      await client.query("COMMIT");
      return;
    }

    if (detail.eventType === EVENT_DETAIL_TYPES.evidenceUploadRequested) {
      await upsertUploadRequestedProjection(client, detail);
      await markEventInboxProcessed(client, detail.eventId);
      await client.query("COMMIT");
      return;
    }

    const projection = await upsertObjectCreatedProjection(client, detail);

    if (!projection.content_type.startsWith("image/")) {
      await createAnalysisJob(
        client,
        projection.evidence_id,
        projection.object_key,
        "skipped",
      );
      await markEventInboxProcessed(client, detail.eventId);
      await client.query("COMMIT");
      return;
    }

    const tags = await suggestImageTags(projection);
    const analysisJobId = await createAnalysisJob(
      client,
      projection.evidence_id,
      projection.object_key,
      "completed",
    );
    await replaceAnalysisTags(client, analysisJobId, projection.evidence_id, tags);
    await markEventInboxProcessed(client, detail.eventId);
    await publishAnalysisCompletedEvent({
      version: 1,
      eventId: randomUUID(),
      eventType: EVENT_DETAIL_TYPES.documentAnalysisCompleted,
      evidenceId: projection.evidence_id,
      objectKey: projection.object_key,
      analysisJobId,
      automaticTags: tags,
      occurredAt: new Date().toISOString(),
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
