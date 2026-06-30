#!/usr/bin/env bash
set -euo pipefail

TARGET_STAGE="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$TARGET_STAGE" in
  testing|staging|production)
    ;;
  *)
    echo "Usage: $0 testing|staging|production" >&2
    exit 1
    ;;
esac

confirm_production_destroy() {
  if [[ "$TARGET_STAGE" != "production" ]]; then
    return
  fi

  echo "This will destroy production infrastructure." >&2
  read -r -p "Type 'destroy production infrastructure' to continue: " confirmation

  if [[ "$confirmation" != "destroy production infrastructure" ]]; then
    echo "Refusing to destroy production infrastructure." >&2
    exit 1
  fi
}

confirm_production_destroy

echo "Using AWS_PROFILE=$TARGET_STAGE for $TARGET_STAGE"
echo "Using AWS_PROFILE=management for website operations"
echo ""

run_stage() {
  AWS_PROFILE="$TARGET_STAGE" ACO24_STAGE="$TARGET_STAGE" "$@"
}

run_management() {
  AWS_PROFILE=management ACO24_STAGE="$TARGET_STAGE" "$@"
}

destroy_service() {
  local service="$1"
  local label="$2"

  echo "Destroying $TARGET_STAGE $label..."
  run_stage pnpm -C "$ROOT_DIR/services/$service" run destroy
}

destroy_service "document-analysis-service" "document analysis service"
destroy_service "onboarding-service" "onboarding service"
destroy_service "cognito-service" "Cognito service"

echo "Emptying $TARGET_STAGE website bucket in management account..."
run_management pnpm -C "$ROOT_DIR/apps/shell" run empty-bucket

echo "Destroying $TARGET_STAGE frontend infrastructure in management account..."
run_management pnpm -C "$ROOT_DIR/apps/shell" run destroy

echo ""
echo "$TARGET_STAGE destroy complete."
