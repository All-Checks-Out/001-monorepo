import type { EventBridgeEvent } from "aws-lambda";
import { completeChecklistTaskEvidenceUploadFromObjectKey } from "../services/onboardingService";

type S3ObjectCreatedDetail = {
  bucket?: {
    name?: string;
  };
  object?: {
    key?: string;
  };
};

export const handler = async (
  event: EventBridgeEvent<"Object Created", S3ObjectCreatedDetail>,
) => {
  const key = event.detail.object?.key;

  if (!key) {
    console.warn("S3 ObjectCreated event did not include an object key.");
    return;
  }

  const objectKey = decodeURIComponent(key.replace(/\+/g, " "));

  try {
    await completeChecklistTaskEvidenceUploadFromObjectKey(objectKey);
  } catch (error) {
    console.error("Could not complete checklist task evidence upload.", {
      objectKey,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
