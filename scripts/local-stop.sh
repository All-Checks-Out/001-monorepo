#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
MANAGED_MARKER="Managed by pnpm run start:local/stop:local"

if [[ -d "$HOME/.orbstack/bin" ]]; then
  export PATH="$HOME/.orbstack/bin:$PATH"
fi

if [[ -d "/Applications/OrbStack.app/Contents/MacOS/xbin" ]]; then
  export PATH="/Applications/OrbStack.app/Contents/MacOS/xbin:$PATH"
fi

remove_managed_local_env() {
  local app_dir="$1"
  local target="$ROOT_DIR/$app_dir/.env.local"

  if [[ ! -f "$target" ]]; then
    echo "$app_dir/.env.local is not present."
    return
  fi

  if grep -q "$MANAGED_MARKER" "$target"; then
    rm "$target"
    echo "Removed $app_dir/.env.local."
    return
  fi

  echo "Left $app_dir/.env.local in place because it does not look managed by start:local."
}

remove_managed_local_env "apps/shell"
remove_managed_local_env "apps/core"
remove_managed_local_env "apps/form-design"

pnpm run docker:down

echo ""
echo "Local mode is stopped."
echo "Stop any running backend/frontend terminals with Ctrl-C."
