import { expect, type Page } from "@playwright/test";

export const associationUserEmail = "prudence.paperwork@example.test";
export const providerUserEmail = "arthur.uptick@example.test";

type LocalUser = {
  id: number;
  cognito_sub: string;
  email: string;
  corporation_name: string;
};

type LocalUsersResponse = {
  users: LocalUser[];
};

const localUserStorageKey = "local_user";

export async function selectLocalUser(page: Page, email: string, path = "/") {
  const apiBaseURL = process.env.ACO_E2E_API_BASE_URL ?? "http://127.0.0.1:3001";
  const response = await page.request.get(`${apiBaseURL}/local-dev/users`);
  expect(response.ok()).toBeTruthy();

  const { users } = (await response.json()) as LocalUsersResponse;
  const user = users.find((candidate) => candidate.email === email);
  expect(user, `seeded local user ${email}`).toBeTruthy();

  await page.goto("/");
  await page.evaluate(
    ({ storageKey, selectedUser }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          sub: selectedUser.cognito_sub,
          email: selectedUser.email,
          emailVerified: true,
          localUserId: selectedUser.id,
        }),
      );
    },
    { storageKey: localUserStorageKey, selectedUser: user! },
  );
  await page.goto(path);
}

export async function clearLocalUser(page: Page) {
  await page.goto("/");
  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, localUserStorageKey);
}
