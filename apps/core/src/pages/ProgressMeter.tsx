

export function ProgressMeter({ completed, total }: { completed: number; total: number }) {
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-20 bg-border">
        <span
          className="block h-1.5 bg-green-700"
          style={{ width: `${percentage}%` }}
        />
      </span>
      <span>{percentage}%</span>
    </span>
  );
}
