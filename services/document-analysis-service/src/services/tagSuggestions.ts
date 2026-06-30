import {
  DetectLabelsCommand,
  RekognitionClient,
} from "@aws-sdk/client-rekognition";
import type { AnalysisTagRow } from "../database/documentRepository";

const rekognitionClient = new RekognitionClient();

export async function suggestImageTags(document: {
  bucket_name: string;
  object_key: string;
}): Promise<AnalysisTagRow[]> {
  const response = await rekognitionClient.send(
    new DetectLabelsCommand({
      Image: {
        S3Object: {
          Bucket: document.bucket_name,
          Name: document.object_key,
        },
      },
      MaxLabels: 20,
      MinConfidence: 75,
    }),
  );

  return normalizeTags(
    (response.Labels ?? [])
      .map((label) => ({
        tag: label.Name,
        confidence: label.Confidence ?? null,
        source: "aws-rekognition" as const,
      }))
      .filter((label): label is AnalysisTagRow => Boolean(label.tag)),
  );
}

function normalizeTags(tags: AnalysisTagRow[]) {
  const normalizedTags = new Map<string, AnalysisTagRow>();

  for (const tag of tags) {
    const normalized = tag.tag.trim();
    if (!normalized || normalized.length > 40) continue;

    const key = normalized.toLowerCase();
    const existing = normalizedTags.get(key);

    if (!existing || (tag.confidence ?? 0) > (existing.confidence ?? 0)) {
      normalizedTags.set(key, {
        ...tag,
        tag: normalized,
        confidence: tag.confidence === null ? null : Number(tag.confidence.toFixed(2)),
      });
    }
  }

  return Array.from(normalizedTags.values()).slice(0, 20);
}
