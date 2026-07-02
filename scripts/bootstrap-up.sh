#!/usr/bin/env bash
set -euo pipefail

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

MANAGEMENT_ACCOUNT_ID="$ACO24_MANAGEMENT_ACCOUNT_ID"
TESTING_ACCOUNT_ID="$ACO24_TESTING_ACCOUNT_ID"
STAGING_ACCOUNT_ID="$ACO24_STAGING_ACCOUNT_ID"
PRODUCTION_ACCOUNT_ID="$ACO24_PRODUCTION_ACCOUNT_ID"

WORKLOAD_REGION="eu-west-2"
CLOUDFRONT_REGION="us-east-1"

echo "Credentials required:"
echo "  aws sso login --profile management"
echo "  aws sso login --profile testing"
echo "  aws sso login --profile staging"
echo "  aws sso login --profile production"
echo ""

bootstrap_management_account() {
  for region in "$WORKLOAD_REGION" "$CLOUDFRONT_REGION"; do
    echo "Bootstrapping management account $MANAGEMENT_ACCOUNT_ID in $region..."
    cdk bootstrap "aws://$MANAGEMENT_ACCOUNT_ID/$region" \
      --profile "management"
  done
}

bootstrap_workload_account() {
  local account_name="$1"
  local account_id="$2"
  local profile="$3"

  for region in "$WORKLOAD_REGION" "$CLOUDFRONT_REGION"; do
    echo "Bootstrapping $account_name account $account_id in $region..."
    cdk bootstrap "aws://$account_id/$region" \
      --profile "$profile" \
      --trust "$MANAGEMENT_ACCOUNT_ID" \
      --cloudformation-execution-policies "arn:aws:iam::aws:policy/AdministratorAccess"
  done
}

TARGET_STAGE="${1:-all}"

case "$TARGET_STAGE" in
  all)
    bootstrap_management_account
    bootstrap_workload_account "testing" "$TESTING_ACCOUNT_ID" "testing"
    bootstrap_workload_account "staging" "$STAGING_ACCOUNT_ID" "staging"
    bootstrap_workload_account "production" "$PRODUCTION_ACCOUNT_ID" "production"
    ;;
  testing)
    bootstrap_workload_account "testing" "$TESTING_ACCOUNT_ID" "testing"
    ;;
  staging)
    bootstrap_workload_account "staging" "$STAGING_ACCOUNT_ID" "staging"
    ;;
  production)
    bootstrap_workload_account "production" "$PRODUCTION_ACCOUNT_ID" "production"
    ;;
  management)
    bootstrap_management_account
    ;;
  *)
    echo "Usage: $0 all|management|testing|staging|production" >&2
    exit 1
    ;;
esac

echo ""
echo "Bootstrap complete."
