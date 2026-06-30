import { authConfig } from "../config";
import type { AuthenticatedUser } from "../session/types";
import {
  CODE_VERIFIER_KEY,
  ID_TOKEN_STORAGE_KEY,
  AUTH_STORAGE_KEYS,
  STATE_KEY,
} from "../session/storage";
import {
  decodeIdToken,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  getCognitoCallbackRedirectUri,
  getCognitoLoginUrl,
  getCognitoLogoutUrl,
} from "./oauth";

export async function startLogin(): Promise<void> {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  window.localStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);
  window.localStorage.setItem(STATE_KEY, state);

  window.location.href = getCognitoLoginUrl(
    state,
    codeChallenge,
    authConfig.cognitoDomain,
    authConfig.cognitoClientId,
  );
}

export async function handleOAuthCallback(
  code: string,
  state: string,
): Promise<AuthenticatedUser> {
  const storedState = window.localStorage.getItem(STATE_KEY);
  const codeVerifier = window.localStorage.getItem(CODE_VERIFIER_KEY);

  if (!storedState || !codeVerifier) {
    throw new Error(
      "Error: unable to read state or code verifier from session storage.",
    );
  }

  if (state !== storedState) {
    throw new Error("Error: cognito/session-storage state mismatch");
  }

  try {
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: authConfig.cognitoClientId,
      code,
      redirect_uri: getCognitoCallbackRedirectUri(),
      code_verifier: codeVerifier,
    });

    const response = await fetch(`${authConfig.cognitoDomain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = (await response.json()) as {
      id_token?: string;
    };

    if (!tokens.id_token) {
      throw new Error("No ID token received");
    }

    window.localStorage.setItem(ID_TOKEN_STORAGE_KEY, tokens.id_token);

    const user = decodeIdToken(tokens.id_token);
    if (!user) {
      throw new Error("Failed to decode user information from ID token");
    }

    return user;
  } finally {
    window.localStorage.removeItem(CODE_VERIFIER_KEY);
    window.localStorage.removeItem(STATE_KEY);
  }
}

export function doLogout(): void {
  AUTH_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
  window.location.href = getCognitoLogoutUrl(
    authConfig.cognitoDomain,
    authConfig.cognitoClientId,
  );
}

export function getUserFromStoredToken(): AuthenticatedUser | null {
  const idToken = window.localStorage.getItem(ID_TOKEN_STORAGE_KEY);
  if (!idToken) return null;
  const user = decodeIdToken(idToken);

  if (!user) {
    AUTH_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    return null;
  }

  return user;
}
