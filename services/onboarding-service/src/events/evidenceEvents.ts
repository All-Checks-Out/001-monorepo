import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import {
  EVENT_SOURCES,
  type EvidenceObjectCreatedEvent,
  type EvidenceUploadRequestedEvent,
} from "@backend/events";
import { isLocalMode } from "../localMode";

const eventBridge = new EventBridgeClient({});

export async function publishEvidenceEvent(
  detail: EvidenceUploadRequestedEvent | EvidenceObjectCreatedEvent,
) {
  if (isLocalMode()) return;

  const eventBusName = process.env.ONBOARDING_EVENT_BUS_NAME;
  if (!eventBusName) return;

  await eventBridge.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName,
          Source: EVENT_SOURCES.onboarding,
          DetailType: detail.eventType,
          Detail: JSON.stringify(detail),
        },
      ],
    }),
  );
}
