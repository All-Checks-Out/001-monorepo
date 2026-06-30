import assert from "node:assert/strict";
import { attachAuth, requireAuth } from "../../src/middleware/auth";
import { listLocalDevUsers } from "../../src/controllers/localDevController";
import { publishEvidenceEvent } from "../../src/events/evidenceEvents";
import { createEvidenceS3Client } from "../../src/services/evidenceStorage";
import type { Request, Response } from "express";

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (statusCode: number) => MockResponse;
  json: (body: unknown) => MockResponse;
};

function mockResponse(): MockResponse {
  const response: MockResponse = {
    statusCode: 200,
    body: null,
    status(statusCode: number) {
      this.statusCode = statusCode;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response;
}

async function testLocalDevEndpointDisabledOutsideLocal() {
  process.env.APP_ENV = "testing";
  const response = mockResponse();

  await listLocalDevUsers({} as Request, response as unknown as Response);

  assert.equal(response.statusCode, 404);
}

function testLocalAuthHeaderIgnoredOutsideLocal() {
  process.env.APP_ENV = "testing";
  const request = {
    header(name: string) {
      return name === "x-local-user-id" ? "1" : undefined;
    },
  } as Request;
  const response = mockResponse();

  attachAuth(request, response as unknown as Response, () => undefined);
  requireAuth(request, response as unknown as Response, () => undefined);

  assert.equal(response.statusCode, 401);
}

async function testS3ClientUsesMinioConfigInLocalMode() {
  process.env.APP_ENV = "local";
  process.env.S3_ENDPOINT = "http://localhost:9000";
  process.env.AWS_REGION = "eu-west-2";
  process.env.AWS_ACCESS_KEY_ID = "minioadmin";
  process.env.AWS_SECRET_ACCESS_KEY = "minioadmin";

  const client = createEvidenceS3Client();
  const endpoint = await client.config.endpoint?.();

  assert.equal(client.config.forcePathStyle, true);
  assert.equal(endpoint?.hostname, "localhost");
  assert.equal(endpoint?.port, 9000);
}

async function testEventBridgePublishSkippedInLocalMode() {
  process.env.APP_ENV = "local";
  process.env.ONBOARDING_EVENT_BUS_NAME = "local-event-bus-that-should-not-be-used";
  process.env.AWS_REGION = "invalid-local-region";

  await publishEvidenceEvent({
    version: 1,
    eventId: "local-test-event",
    eventType: "evidence.upload-requested",
    evidenceId: 1,
    checklistTaskId: 1,
    providerCorporationId: 1,
    uploadedByAppUserId: 1,
    bucketName: "local-bucket",
    objectKey: "local-object",
    originalFilename: "local.pdf",
    contentType: "application/pdf",
    uploadTimeTags: [],
    occurredAt: new Date(0).toISOString(),
  });
}

async function main() {
  await testLocalDevEndpointDisabledOutsideLocal();
  testLocalAuthHeaderIgnoredOutsideLocal();
  await testS3ClientUsesMinioConfigInLocalMode();
  await testEventBridgePublishSkippedInLocalMode();
  console.log("Local mode checks passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
