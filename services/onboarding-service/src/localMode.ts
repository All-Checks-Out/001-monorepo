export function isLocalMode() {
  return (
    process.env.APP_ENV === "local" &&
    !process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}
