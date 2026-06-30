import { DocumentPanel } from "./DocumentPanel";

export function EvidencePreview({
  name,
  contentType,
  fileSizeBytes,
  url,
}: {
  name: string;
  contentType: string;
  fileSizeBytes: number;
  url: string;
}) {
  if (contentType.startsWith("image/")) {
    return (
      <div className="grid gap-2">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden border bg-background">
          <img src={url} alt={name} className="max-h-full max-w-full object-contain" />
        </div>
        <DocumentPanel
          name={name}
          contentType={contentType}
          fileSizeBytes={fileSizeBytes}
          compact
        />
      </div>
    );
  }

  if (contentType === "application/pdf") {
    return (
      <div className="grid gap-2">
        <object
          data={url}
          type="application/pdf"
          className="h-72 w-full border bg-background"
        >
          <DocumentPanel
            name={name}
            contentType={contentType}
            fileSizeBytes={fileSizeBytes}
          />
        </object>
        <DocumentPanel
          name={name}
          contentType={contentType}
          fileSizeBytes={fileSizeBytes}
          compact
        />
      </div>
    );
  }

  return (
    <DocumentPanel
      name={name}
      contentType={contentType}
      fileSizeBytes={fileSizeBytes}
    />
  );
}
