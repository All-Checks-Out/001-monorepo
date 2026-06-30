

interface StatusProps {
  message?: string;
  error?: string;
}

export const Status = ({ message, error }: StatusProps) => {
  return (
    <>
      {message && <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
};
