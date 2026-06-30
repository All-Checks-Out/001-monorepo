export function localCognitoSub(email: string) {
  return `local:${email.trim().toLowerCase()}`;
}
