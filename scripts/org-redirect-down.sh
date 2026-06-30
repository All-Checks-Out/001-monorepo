#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Destroying management aco24.org redirect stack..."
AWS_PROFILE=management pnpm -C "$ROOT_DIR/apps/shell" run org-redirect-down
