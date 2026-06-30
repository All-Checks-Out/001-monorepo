import { execSync } from "node:child_process";
import { deleteAllCognitoUsers } from "./lib/cognitoSeed";
import { getStage } from "./lib/stage";

function assertResetAllowed() {
  if (
    getStage() === "production"
    && process.env.ACO24_CONFIRM_PRODUCTION_DATA_RESET !== "yes"
  ) {
    throw new Error(
      "Refusing to reset production data. Set ACO24_CONFIRM_PRODUCTION_DATA_RESET=yes to continue.",
    );
  }
}

async function main() {
  assertResetAllowed();

  console.log("Resetting onboarding database schema...");
  execSync("pnpm exec tsx scripts/src/database-migrate.ts reset", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  console.log("");

  const deletedCognitoUsers = await deleteAllCognitoUsers();
  console.log(`Cleared ${deletedCognitoUsers} Cognito user(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
