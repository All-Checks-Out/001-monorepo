import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isLocalMode } from "../localMode";

export function createEvidenceS3Client() {
  if (!isLocalMode()) return new S3Client({});

  return new S3Client({
    region: process.env.AWS_REGION ?? "eu-west-2",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "minioadmin",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "minioadmin",
    },
  });
}

const s3Client = createEvidenceS3Client();

export async function createEvidenceUploadUrl(input: {
  objectKey: string;
  contentType: string;
}) {
  const bucketName = process.env.EVIDENCE_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("EVIDENCE_BUCKET_NAME environment variable is not configured.");
  }

  return await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: input.objectKey,
      ContentType: input.contentType,
    }),
    { expiresIn: 900 },
  );
}

export async function headEvidenceObject(objectKey: string) {
  const bucketName = process.env.EVIDENCE_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("EVIDENCE_BUCKET_NAME environment variable is not configured.");
  }

  const result = await s3Client.send(
    new HeadObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    }),
  );

  return {
    contentLength: result.ContentLength,
    contentType: result.ContentType,
  };
}

export function evidenceObjectUrl(objectKey: string) {
  const cloudfrontUrl = process.env.EVIDENCE_CLOUDFRONT_URL;

  if (!cloudfrontUrl) {
    throw new Error("EVIDENCE_CLOUDFRONT_URL environment variable is not configured.");
  }

  return `${cloudfrontUrl.replace(/\/$/, "")}/${encodeURIComponent(objectKey)}`;
}
