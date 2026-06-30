import { ProviderDDQChecklistTaskEvidence } from "@frontend/api/onboarding/types";
import { Button } from "@frontend/shadcn/components/ui/button";
import { ExternalLink } from "lucide-react";
import { EvidencePreview } from "./EvidencePreview";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function EvidenceReview({
  evidence,
}: {
  evidence: ProviderDDQChecklistTaskEvidence;
}) {
  return (
    <div className="grid gap-3">
      <EvidencePreview
        name={evidence.original_filename}
        contentType={evidence.content_type}
        fileSizeBytes={evidence.file_size_bytes}
        url={evidence.url}
      />
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Uploaded</dt>
        <dd>{evidence.uploaded_at ? formatDateTime(evidence.uploaded_at) : "-"}</dd>
        <dt className="text-muted-foreground">Uploader</dt>
        <dd>User {evidence.uploaded_by_app_user_id}</dd>
        <dt className="text-muted-foreground">Tags</dt>
        <dd>{evidence.tags.map((tag) => tag.tag).join(", ") || "-"}</dd>
      </dl>
      <Button type="button" size="sm" variant="outline" asChild>
        <a href={evidence.url} target="_blank" rel="noreferrer">
          <ExternalLink className="size-4" />
          Open original
        </a>
      </Button>
    </div>
  );
}
