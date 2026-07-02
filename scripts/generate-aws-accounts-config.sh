#!/usr/bin/env bash
set -euo pipefail

OUTPUT_FILE="packages/shared/aws-accounts/src/index.ts"

validate_account_id() {
  local variable_name="$1"
  local value="${!variable_name:-}"

  if [[ -z "$value" ]]; then
    echo "Missing required environment variable: $variable_name" >&2
    exit 1
  fi

  if [[ ! "$value" =~ ^[0-9]{12}$ ]]; then
    echo "Invalid $variable_name: expected exactly 12 digits." >&2
    exit 1
  fi
}

validate_account_id "ACO24_MANAGEMENT_ACCOUNT_ID"
validate_account_id "ACO24_TESTING_ACCOUNT_ID"
validate_account_id "ACO24_STAGING_ACCOUNT_ID"
validate_account_id "ACO24_PRODUCTION_ACCOUNT_ID"

mkdir -p "$(dirname "$OUTPUT_FILE")"

cat > "$OUTPUT_FILE" <<EOF
export type AwsAccountName =
  | "management"
  | "testing"
  | "staging"
  | "production";

export const AWS_ACCOUNTS = {
  management: "$ACO24_MANAGEMENT_ACCOUNT_ID",
  testing: "$ACO24_TESTING_ACCOUNT_ID",
  staging: "$ACO24_STAGING_ACCOUNT_ID",
  production: "$ACO24_PRODUCTION_ACCOUNT_ID",
} as const satisfies Record<AwsAccountName, string>;

export const MANAGEMENT_ACCOUNT_ID = AWS_ACCOUNTS.management;
export const TESTING_ACCOUNT_ID = AWS_ACCOUNTS.testing;
export const STAGING_ACCOUNT_ID = AWS_ACCOUNTS.staging;
export const PRODUCTION_ACCOUNT_ID = AWS_ACCOUNTS.production;
EOF

echo "Generated $OUTPUT_FILE"
