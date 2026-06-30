#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -d "$HOME/.orbstack/bin" ]]; then
  export PATH="$HOME/.orbstack/bin:$PATH"
fi

if [[ -d "/Applications/OrbStack.app/Contents/MacOS/xbin" ]]; then
  export PATH="/Applications/OrbStack.app/Contents/MacOS/xbin:$PATH"
fi

source "$SCRIPT_DIR/local-env.sh"

ensure_local_env() {
  local app_dir="$1"
  local template="$ROOT_DIR/$app_dir/.env.local-rename-me"
  local target="$ROOT_DIR/$app_dir/.env.local"

  if [[ -f "$target" ]]; then
    echo "$app_dir/.env.local already exists."
    return
  fi

  if [[ ! -f "$template" ]]; then
    echo "Missing $app_dir/.env.local-rename-me." >&2
    exit 1
  fi

  cp "$template" "$target"
  echo "Created $app_dir/.env.local."
}

ensure_local_env "apps/shell"
ensure_local_env "apps/core"
ensure_local_env "apps/form-design"

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  echo "Installing workspace dependencies..."
  pnpm install
fi

pnpm run docker:up
pnpm run database -- update local
(
  cd "$ROOT_DIR/services/onboarding-service"
  env \
    APP_ENV="$APP_ENV" \
    DATABASE_NAME="$DATABASE_NAME" \
    DATABASE_HOST="$DATABASE_HOST" \
    DATABASE_PORT="$DATABASE_PORT" \
    DATABASE_USER="$DATABASE_USER" \
    DATABASE_PASSWORD="$DATABASE_PASSWORD" \
    DATABASE_SSL="$DATABASE_SSL" \
    pnpm exec tsx scripts/src/data-seed-local.ts
)

echo ""
echo "Local mode is ready."
echo ""
echo "Run the backend in one terminal:"
echo "  pnpm run backend -- dev local"
echo ""
echo "Run the frontends in another terminal:"
echo "  pnpm run dev -- local"
echo ""
echo "Open:"
echo "  http://localhost:5173"
echo ""
echo "MinIO console:"
echo "  http://localhost:$MINIO_CONSOLE_PORT"
