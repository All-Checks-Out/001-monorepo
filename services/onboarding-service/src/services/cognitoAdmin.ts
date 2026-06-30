import {
  AdminDeleteUserCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";

const cognitoClient = new CognitoIdentityProviderClient({});

function getUserPoolId() {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;

  if (!userPoolId) {
    throw new Error("COGNITO_USER_POOL_ID environment variable is not configured.");
  }

  return userPoolId;
}

function getUserSub(attributes: { Name?: string; Value?: string }[] | undefined) {
  return attributes?.find((attribute) => attribute.Name === "sub")?.Value;
}

export async function inviteCognitoUser(email: string) {
  const userPoolId = getUserPoolId();

  try {
    const existingUser = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: email,
      }),
    );
    const sub = getUserSub(existingUser.UserAttributes);
    if (sub) return sub;
  } catch (error) {
    if (!(error instanceof UserNotFoundException)) {
      throw error;
    }
  }

  const createdUser = await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
      ],
    }),
  );

  const sub = getUserSub(createdUser.User?.Attributes);

  if (!sub) {
    throw new Error(`Could not determine Cognito sub for ${email}.`);
  }

  return sub;
}

async function deleteCognitoUser(userPoolId: string, username: string) {
  try {
    await cognitoClient.send(
      new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      }),
    );
  } catch (error) {
    if (error instanceof UserNotFoundException) {
      return false;
    }

    throw error;
  }

  return true;
}

export function getSeedUserPassword() {
  return process.env.ACO24_SEED_USER_PASSWORD ?? "Pass44$$";
}

export async function recreateSeedCognitoUser(user: { email: string }) {
  const userPoolId = getUserPoolId();
  await deleteCognitoUser(userPoolId, user.email);

  const createdUser = await cognitoClient.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
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
      UserPoolId: userPoolId,
      Username: user.email,
      Password: getSeedUserPassword(),
      Permanent: true,
    }),
  );

  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: userPoolId,
      Username: user.email,
      UserAttributes: [{ Name: "email_verified", Value: "true" }],
    }),
  );

  const sub = getUserSub(createdUser.User?.Attributes) ?? await inviteCognitoUser(user.email);
  if (!sub) {
    throw new Error(`Could not determine Cognito sub for ${user.email}.`);
  }

  return sub;
}

export async function deleteAllCognitoUsers() {
  const userPoolId = getUserPoolId();
  let deleted = 0;
  let paginationToken: string | undefined;

  do {
    const response = await cognitoClient.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        PaginationToken: paginationToken,
      }),
    );

    for (const user of response.Users ?? []) {
      if (!user.Username) continue;

      if (await deleteCognitoUser(userPoolId, user.Username)) {
        deleted += 1;
      }
    }

    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return deleted;
}
