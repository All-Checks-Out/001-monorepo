import { FileText, Image as ImageIcon } from "lucide-react";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentPanel({
  name,
  contentType,
  fileSizeBytes,
  compact = false,
}: {
  name: string;
  contentType: string;
  fileSizeBytes: number;
  compact?: boolean;
}) {
  const Icon = contentType.startsWith("image/") ? ImageIcon : FileText;

  return (
    <div className={`flex items-start gap-3 border bg-background ${compact ? "p-2" : "p-3"}`}>
      <Icon className="mt-0.5 size-5 text-muted-foreground" />
      <div className="min-w-0 text-xs">
        <div className="truncate font-medium" title={name}>{name}</div>
        <div className="text-muted-foreground">{contentType}</div>
        {fileSizeBytes > 0 && (
          <div className="text-muted-foreground">{formatBytes(fileSizeBytes)}</div>
        )}
      </div>
    </div>
  );
}
