import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { getCognitoConfig } from "./ssm";
import { getStage } from "./stage";

const cognitoClient = new CognitoIdentityProviderClient({});

export type CognitoConfig = {
  clientId: string;
  userPoolId: string;
};

export type SeedCognitoUser = {
  email: string;
};

function getUserSub(attributes: { Name?: string; Value?: string }[] | undefined) {
  return attributes?.find((attribute) => attribute.Name === "sub")?.Value;
}

export function getSeedUserPassword() {
  const explicitPassword = process.env.ACO24_SEED_USER_PASSWORD;
  if (explicitPassword) {
    return explicitPassword;
  }

  if (getStage() === "production") {
    throw new Error(
      "ACO24_SEED_USER_PASSWORD must be set when seeding production.",
    );
  }

  return "Pass44$$";
}

export async function deleteCognitoUser(
  config: CognitoConfig,
  username: string,
) {
  try {
    await cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: config.userPoolId,
        Username: username,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === "UserNotFoundException") {
      return false;
    }

    throw error;
  }

  return true;
}

async function getCognitoSub(config: CognitoConfig, username: string) {
  const response = await cognitoClient.send(
    new AdminGetUserCommand({
      UserPoolId: config.userPoolId,
      Username: username,
    }),
  );

  const sub = getUserSub(response.UserAttributes);
  if (!sub) {
    throw new Error(`Could not read Cognito sub for ${username}.`);
  }

  return sub;
}

export async function createSeedCognitoUser(
  config: CognitoConfig,
  user: SeedCognitoUser,
) {
  await deleteCognitoUser(config, user.email);

  const createdUser = await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: config.userPoolId,
      Username: user.email,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: user.email },
        { Name: "email_verified", Value: "true" },
      ],
    }),
  );

  await cognitoClient.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: config.userPoolId,
      Username: user.email,
      Password: getSeedUserPassword(),
      Permanent: true,
    }),
  );

  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: config.userPoolId,
      Username: user.email,
      UserAttributes: [{ Name: "email_verified", Value: "true" }],
    }),
  );

  const sub = getUserSub(createdUser.User?.Attributes)
    ?? await getCognitoSub(config, user.email);

  return sub;
}

export async function deleteAllCognitoUsers() {
  const config = await getCognitoConfig();
  let deleted = 0;
  let paginationToken: string | undefined;

  do {
    const response = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: config.userPoolId,
        PaginationToken: paginationToken,
      }),
    );

    for (const user of response.Users ?? []) {
      if (!user.Username) {
        continue;
      }

      if (await deleteCognitoUser(config, user.Username)) {
        deleted += 1;
      }
    }

    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return deleted;
}
