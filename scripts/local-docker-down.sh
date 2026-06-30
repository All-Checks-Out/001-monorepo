#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/local-env.sh"

if [[ -d "$HOME/.orbstack/bin" ]]; then
  export PATH="$HOME/.orbstack/bin:$PATH"
fi

if [[ -d "/Applications/OrbStack.app/Contents/MacOS/xbin" ]]; then
  export PATH="/Applications/OrbStack.app/Contents/MacOS/xbin:$PATH"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "OrbStack Docker CLI was not found. Install/start OrbStack, then retry." >&2
  exit 1
fi

if docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER_NAME"; then
  docker stop "$POSTGRES_CONTAINER_NAME" >/dev/null
  echo "Stopped $POSTGRES_CONTAINER_NAME."
else
  echo "$POSTGRES_CONTAINER_NAME is not running."
fi

if docker ps --format '{{.Names}}' | grep -qx "$MINIO_CONTAINER_NAME"; then
  docker stop "$MINIO_CONTAINER_NAME" >/dev/null
  docker rm "$MINIO_CONTAINER_NAME" >/dev/null
  echo "Stopped and removed $MINIO_CONTAINER_NAME."
elif docker ps -a --format '{{.Names}}' | grep -qx "$MINIO_CONTAINER_NAME"; then
  docker rm "$MINIO_CONTAINER_NAME" >/dev/null
  echo "Removed stopped $MINIO_CONTAINER_NAME."
else
  echo "$MINIO_CONTAINER_NAME is not present."
fi
