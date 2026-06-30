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

echo "Using AWS_PROFILE=$TARGET_STAGE for $TARGET_STAGE"
echo "Using AWS_PROFILE=management for website operations"
echo ""

run_stage() {
  AWS_PROFILE="$TARGET_STAGE" ACO24_STAGE="$TARGET_STAGE" "$@"
}

run_management() {
  AWS_PROFILE=management ACO24_STAGE="$TARGET_STAGE" "$@"
}

deploy_service() {
  local service="$1"
  local label="$2"

  echo "Deploying $TARGET_STAGE $label..."
  run_stage pnpm -C "$ROOT_DIR/services/$service" run deploy
}

deploy_frontend_app() {
  local app="$1"

  echo "Generating $TARGET_STAGE $app environment..."
  run_stage pnpm -C "$ROOT_DIR/apps/$app" run generate-env

  echo "Building $app..."
  pnpm -C "$ROOT_DIR/apps/$app" run build

  echo "Uploading $app to management account website bucket..."
  run_management pnpm -C "$ROOT_DIR/apps/$app" run upload
}

echo "Deploying $TARGET_STAGE frontend infrastructure in management account..."
run_management pnpm -C "$ROOT_DIR/apps/shell" run deploy:infra

deploy_service "cognito-service" "Cognito service"
deploy_service "onboarding-service" "onboarding service"
deploy_service "document-analysis-service" "document analysis service"

deploy_frontend_app "shell"
deploy_frontend_app "core"
deploy_frontend_app "form-design"

echo "Invalidating CloudFront..."
run_management pnpm -C "$ROOT_DIR/apps/shell" run invalidate-all-cloudfront

echo "Website URL:"
run_management pnpm -C "$ROOT_DIR/apps/shell" run url
