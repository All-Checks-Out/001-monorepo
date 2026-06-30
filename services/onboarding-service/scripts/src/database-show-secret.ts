import { getDatabaseName, getRdsCredentials } from "./lib/onboardingDatabase";
import { getParameter } from "./lib/ssm";

async function main() {
  if (process.env.PROFILE) {
    process.env.AWS_PROFILE = process.env.PROFILE;
  }

  const [secretArn, credentials] = await Promise.all([
    getParameter("/onboarding/rds/secret-arn"),
    getRdsCredentials(),
  ]);
  const databaseName = getDatabaseName();

  console.log("");
  console.log(`Secret ARN: ${secretArn}`);
  console.log(`Database name: ${databaseName}`);
  console.log("");
  console.log(JSON.stringify(credentials, null, 2));
}

main().catch((error) => {
  console.error(
    "Failed to read database secret:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
