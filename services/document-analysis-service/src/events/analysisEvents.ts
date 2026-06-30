import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import {
  EVENT_SOURCES,
  type DocumentAnalysisCompletedEvent,
} from "@backend/events";

const eventBridge = new EventBridgeClient({});

export async function publishAnalysisCompletedEvent(
  detail: DocumentAnalysisCompletedEvent,
) {
  const eventBusName = process.env.ONBOARDING_EVENT_BUS_NAME;
  if (!eventBusName) return;

  await eventBridge.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName,
          Source: EVENT_SOURCES.documentAnalysis,
          DetailType: detail.eventType,
          Detail: JSON.stringify(detail),
        },
      ],
    }),
  );
}
