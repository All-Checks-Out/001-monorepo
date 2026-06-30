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

start_docker_app() {
  if [[ -d "/Applications/OrbStack.app" || -d "$HOME/Applications/OrbStack.app" ]]; then
    echo "Starting OrbStack..."
    open -ga OrbStack
    return
  fi

  echo "OrbStack was not found. Install/start OrbStack, then retry." >&2
  exit 1
}

ensure_docker_ready() {
  if ! command -v docker >/dev/null 2>&1; then
    start_docker_app
  elif docker info >/dev/null 2>&1; then
    return
  else
    start_docker_app
  fi

  for _ in {1..60}; do
    if [[ -d "$HOME/.orbstack/bin" ]]; then
      export PATH="$HOME/.orbstack/bin:$PATH"
    fi

    if [[ -d "/Applications/OrbStack.app/Contents/MacOS/xbin" ]]; then
      export PATH="/Applications/OrbStack.app/Contents/MacOS/xbin:$PATH"
    fi

    if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
      return
    fi

    sleep 1
  done

  echo "OrbStack Docker did not become ready within 60 seconds. Start OrbStack, then retry." >&2
  exit 1
}

ensure_docker_ready

if docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER_NAME"; then
  echo "$POSTGRES_CONTAINER_NAME is already running."
elif docker ps -a --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER_NAME"; then
  echo "Starting $POSTGRES_CONTAINER_NAME..."
  docker start "$POSTGRES_CONTAINER_NAME" >/dev/null
else
  echo "Creating $POSTGRES_CONTAINER_NAME..."
  docker volume create "$POSTGRES_VOLUME_NAME" >/dev/null
  docker run \
    --name "$POSTGRES_CONTAINER_NAME" \
    -e POSTGRES_USER="$DATABASE_USER" \
    -e POSTGRES_PASSWORD="$DATABASE_PASSWORD" \
    -e POSTGRES_DB=postgres \
    -p "$DATABASE_PORT:5432" \
    -v "$POSTGRES_VOLUME_NAME:/var/lib/postgresql/data" \
    -d "$POSTGRES_IMAGE" >/dev/null
fi

echo "Waiting for Postgres on localhost:$DATABASE_PORT..."
until docker exec "$POSTGRES_CONTAINER_NAME" pg_isready -U "$DATABASE_USER" -d postgres >/dev/null 2>&1; do
  sleep 1
done

echo "Postgres is ready."

if docker ps --format '{{.Names}}' | grep -qx "$MINIO_CONTAINER_NAME"; then
  echo "$MINIO_CONTAINER_NAME is already running."
elif docker ps -a --format '{{.Names}}' | grep -qx "$MINIO_CONTAINER_NAME"; then
  echo "Starting $MINIO_CONTAINER_NAME..."
  docker start "$MINIO_CONTAINER_NAME" >/dev/null
else
  echo "Creating $MINIO_CONTAINER_NAME..."
  docker volume create "$MINIO_VOLUME_NAME" >/dev/null
  docker run \
    --name "$MINIO_CONTAINER_NAME" \
    -e MINIO_ROOT_USER="$AWS_ACCESS_KEY_ID" \
    -e MINIO_ROOT_PASSWORD="$AWS_SECRET_ACCESS_KEY" \
    -e MINIO_API_CORS_ALLOW_ORIGIN="http://localhost:5173,http://localhost:5175" \
    -p 9000:9000 \
    -p "$MINIO_CONSOLE_PORT:9001" \
    -v "$MINIO_VOLUME_NAME:/data" \
    -d "$MINIO_IMAGE" server /data --console-address ":9001" >/dev/null
fi

echo "Waiting for MinIO on localhost:9000..."
until docker exec "$MINIO_CONTAINER_NAME" mc alias set local http://localhost:9000 "$AWS_ACCESS_KEY_ID" "$AWS_SECRET_ACCESS_KEY" >/dev/null 2>&1; do
  sleep 1
done

docker exec "$MINIO_CONTAINER_NAME" mc mb --ignore-existing "local/$EVIDENCE_BUCKET_NAME" >/dev/null
docker exec "$MINIO_CONTAINER_NAME" mc anonymous set download "local/$EVIDENCE_BUCKET_NAME" >/dev/null

echo "MinIO is ready with bucket $EVIDENCE_BUCKET_NAME."
