import { Button } from "@frontend/shadcn/components/ui/button";
import { Input } from "@frontend/shadcn/components/ui/input";
import { Plus, X } from "lucide-react";

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

export function TagEditor({
  tags,
  value,
  disabled,
  message,
  onChange,
  onAdd,
  onRemove,
}: {
  tags: string[];
  value: string;
  disabled: boolean;
  message: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (tag: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Manual tags</span>
        <span className="flex gap-2">
          <Input
            value={value}
            disabled={disabled}
            placeholder="Add a tag"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAdd();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={disabled || !normalizeTag(value)}
            aria-label="Add tag"
            title="Add tag"
            onClick={onAdd}
          >
            <Plus className="size-4" />
          </Button>
        </span>
      </label>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      <div className="flex min-h-8 flex-wrap gap-1">
        {tags.length > 0 ? (
          tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex h-7 items-center gap-1 rounded-sm border bg-background px-2 text-xs"
            >
              {tag}
              <button
                type="button"
                className="inline-flex text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={disabled}
                aria-label={`Remove ${tag}`}
                title={`Remove ${tag}`}
                onClick={() => onRemove(tag)}
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">No manual tags</span>
        )}
      </div>
    </div>
  );
}
