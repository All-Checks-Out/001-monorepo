export const TOKEN_STORAGE_KEY = "cognito_access_token";
export const ID_TOKEN_STORAGE_KEY = "cognito_id_token";
export const CODE_VERIFIER_KEY = "pkce_code_verifier";
export const STATE_KEY = "oauth_state";
export const LOCAL_USER_STORAGE_KEY = "local_user";

export const AUTH_STORAGE_KEYS = [
  TOKEN_STORAGE_KEY,
  ID_TOKEN_STORAGE_KEY,
  CODE_VERIFIER_KEY,
  STATE_KEY,
  LOCAL_USER_STORAGE_KEY,
] as const;
