import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { Client } from "pg";

type DbCredentials = {
  username: string;
  password: string;
  host: string;
  port?: number;
  ssl?: boolean;
};

const secretsClient = new SecretsManagerClient({});
const ssmClient = new SSMClient({});

let credentials: DbCredentials | undefined;

function getLocalCredentials() {
  const host = process.env.DATABASE_HOST;
  const username = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;

  if (!host || !username || !password) {
    return undefined;
  }

  return {
    host,
    port: process.env.DATABASE_PORT ? Number(process.env.DATABASE_PORT) : 5432,
    username,
    password,
    ssl: process.env.DATABASE_SSL !== "false",
  };
}

async function getRdsCredentials() {
  if (credentials) return credentials;

  const localCredentials = getLocalCredentials();
  if (localCredentials) {
    credentials = localCredentials;
    return credentials;
  }

  const parameterResponse = await ssmClient.send(
    new GetParameterCommand({ Name: "/onboarding/rds/secret-arn" }),
  );
  const secretArn = parameterResponse.Parameter?.Value;

  if (!secretArn) {
    throw new Error("SSM parameter /onboarding/rds/secret-arn did not contain a value.");
  }

  const secretResponse = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );

  if (!secretResponse.SecretString) {
    throw new Error("RDS credentials secret did not contain a SecretString.");
  }

  credentials = JSON.parse(secretResponse.SecretString) as DbCredentials;
  return credentials;
}

export async function createDbClient() {
  const databaseName = process.env.DATABASE_NAME;

  if (!databaseName) {
    throw new Error("DATABASE_NAME environment variable is not configured.");
  }

  const rdsCredentials = await getRdsCredentials();
  const client = new Client({
    host: rdsCredentials.host,
    port: rdsCredentials.port ?? 5432,
    database: databaseName,
    user: rdsCredentials.username,
    password: rdsCredentials.password,
    ssl: rdsCredentials.ssl === false ? undefined : { rejectUnauthorized: false },
  });

  await client.connect();
  await client.query("SET search_path TO onboarding, public");
  return client;
}
