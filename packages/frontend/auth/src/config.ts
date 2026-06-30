// see https://vite.dev/guide/env-and-mode
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
const cognitoClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const appEnv = import.meta.env.VITE_APP_ENV;

export const authConfig = {
  cognitoDomain,
  cognitoClientId,
  isLocal: appEnv === "local",
};
