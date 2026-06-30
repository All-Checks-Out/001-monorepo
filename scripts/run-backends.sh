#!/usr/bin/env bash

set -euo pipefail

TARGET_ENV="$ACO24_STAGE"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

case "$TARGET_ENV" in
  local)
    source "$SCRIPT_DIR/local-env.sh"
    "$SCRIPT_DIR/local-docker-up.sh"
    cd "$ROOT_DIR/services/onboarding-service"
    exec env \
      APP_ENV="$APP_ENV" \
      DATABASE_NAME="$DATABASE_NAME" \
      CDK_DATABASE_NAME="$CDK_DATABASE_NAME" \
      DATABASE_HOST="$DATABASE_HOST" \
      DATABASE_PORT="$DATABASE_PORT" \
      DATABASE_USER="$DATABASE_USER" \
      DATABASE_PASSWORD="$DATABASE_PASSWORD" \
      DATABASE_SSL="$DATABASE_SSL" \
      S3_ENDPOINT="$S3_ENDPOINT" \
      EVIDENCE_BUCKET_NAME="$EVIDENCE_BUCKET_NAME" \
      EVIDENCE_CLOUDFRONT_URL="$EVIDENCE_CLOUDFRONT_URL" \
      AWS_REGION="$AWS_REGION" \
      AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
      AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
      pnpm exec tsx src/local.ts
    ;;
  testing|staging|production)
    DATABASE_NAME="uptickart"
    COGNITO_USER_POOL_ID=$(aws ssm get-parameter --name /cognito/user-pool-id --query Parameter.Value --output text)
    cd "$ROOT_DIR/services/onboarding-service"
    exec env \
      DATABASE_NAME="$DATABASE_NAME" \
      COGNITO_USER_POOL_ID="$COGNITO_USER_POOL_ID" \
      pnpm exec tsx src/local.ts
    ;;
  *)
    echo "Usage: $0 local|testing|staging|production" >&2
    exit 1
    ;;
esac
