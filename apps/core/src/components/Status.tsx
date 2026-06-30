interface StatusProps {
  message?: string;
  error?: string;
}

const Status = ({ message, error }: StatusProps) => {
  return (
    <>
      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
};

export default Status;
