#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Deploying mandatory management DNS stack..."
AWS_PROFILE=management pnpm -C "$ROOT_DIR/apps/shell" run dns-zone-up
