#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [[ "${ACO_E2E_SKIP_LOCAL_SETUP:-}" != "1" ]]; then
  pnpm -C "$ROOT_DIR" run start:local
fi

ACO24_STAGE=local pnpm -C "$ROOT_DIR" run backend -- dev local &

echo "Waiting for onboarding service on http://127.0.0.1:3001/public/health..."
until curl -fsS "http://127.0.0.1:3001/public/health" >/dev/null 2>&1; do
  sleep 1
done

pnpm -C "$ROOT_DIR" run preview -- local
