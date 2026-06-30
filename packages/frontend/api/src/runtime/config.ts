// see https://vite.dev/guide/env-and-mode
const onboardingServiceBaseUrl = import.meta.env.VITE_ONBOARDING_SERVICE_BASE_URL;
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
const cognitoClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const cognitoUserPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const appEnv = import.meta.env.VITE_APP_ENV;

function removeTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export const config = {
  onboardingServiceBaseUrl: removeTrailingSlash(onboardingServiceBaseUrl),
  cognitoDomain,
  cognitoClientId,
  cognitoUserPoolId,
  isLocal: appEnv === "local",
};
