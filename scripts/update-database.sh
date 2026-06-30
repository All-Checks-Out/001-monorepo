#!/usr/bin/env bash

set -euo pipefail

TARGET_ENV="$ACO24_STAGE"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

run_local_migration() {
  source "$SCRIPT_DIR/local-env.sh"
  "$SCRIPT_DIR/local-docker-up.sh"
  cd "$ROOT_DIR/services/onboarding-service"
  env \
    DATABASE_HOST="$DATABASE_HOST" \
    DATABASE_PORT="$DATABASE_PORT" \
    DATABASE_USER="$DATABASE_USER" \
    DATABASE_PASSWORD="$DATABASE_PASSWORD" \
    DATABASE_SSL="$DATABASE_SSL" \
    CDK_DATABASE_NAME="$CDK_DATABASE_NAME" \
    pnpm exec tsx scripts/src/database-migrate.ts
}

run_deployed_migration() {
  cd "$ROOT_DIR/services/onboarding-service"
  pnpm exec tsx scripts/src/database-migrate.ts
}

case "$TARGET_ENV" in
  local)
    run_local_migration
    ;;
  testing|staging|production)
    run_deployed_migration
    ;;
  *)
    echo "Usage: $0 local|testing|staging|production" >&2
    exit 1
    ;;
esac
