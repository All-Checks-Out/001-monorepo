#!/usr/bin/env bash

set -euo pipefail

TARGET_ENV="$ACO24_STAGE"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

assert_production_reset_allowed() {
  if [[ "$TARGET_ENV" != "production" ]]; then
    return
  fi

  echo "This will reset the production database." >&2
  read -r -p "Type 'reset production database' to continue: " confirmation

  if [[ "$confirmation" != "reset production database" ]]; then
    echo "Refusing to reset production database." >&2
    exit 1
  fi
}

run_local_reset() {
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
    pnpm exec tsx scripts/src/database-migrate.ts reset
}

run_deployed_reset() {
  cd "$ROOT_DIR/services/onboarding-service"
  pnpm exec tsx scripts/src/database-migrate.ts reset
}

case "$TARGET_ENV" in
  local)
    run_local_reset
    pnpm run database:migrate
    ;;
  testing|staging|production)
    assert_production_reset_allowed
    run_deployed_reset
    pnpm run database:migrate
    ;;
  *)
    echo "Usage: $0 local|testing|staging|production" >&2
    exit 1
    ;;
esac
