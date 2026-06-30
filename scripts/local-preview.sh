#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREVIEW_DIST="$ROOT_DIR/dist-local-preview"

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Building local preview bundles..."

rm -rf "$PREVIEW_DIST"

pnpm -C "$ROOT_DIR/apps/core" run build
pnpm -C "$ROOT_DIR/apps/form-design" run build

(
  cd "$ROOT_DIR/apps/shell"
  VITE_CORE_REMOTE_ENTRY_URL="/core/remoteEntry.js" \
    VITE_FORM_DESIGN_REMOTE_ENTRY_URL="/form-design/remoteEntry.js" \
    pnpm run build
)

mkdir -p "$PREVIEW_DIST/core" "$PREVIEW_DIST/form-design"
cp -R "$ROOT_DIR/apps/shell/dist/." "$PREVIEW_DIST/"
cp -R "$ROOT_DIR/apps/core/dist/." "$PREVIEW_DIST/core/"
cp -R "$ROOT_DIR/apps/form-design/dist/." "$PREVIEW_DIST/form-design/"

echo ""
echo "Starting one-port local preview..."
echo ""
echo "Open:"
echo "  http://localhost:4173"
echo ""
echo "Same-origin preview remotes:"
echo "  core:        http://localhost:4173/core/remoteEntry.js"
echo "  form-design: http://localhost:4173/form-design/remoteEntry.js"
echo ""

pnpm -C "$ROOT_DIR/apps/shell" exec vite preview \
  --host 0.0.0.0 \
  --port 4173 \
  --outDir "$PREVIEW_DIST"
