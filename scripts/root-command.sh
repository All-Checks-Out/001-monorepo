#!/usr/bin/env bash

set -euo pipefail

COMMAND="${1:-}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${2:-}" == "--" ]]; then
  set -- "$1" "${@:3}"
fi

usage() {
  cat >&2 <<'EOF'
Usage:
  pnpm run app -- shell|core|form-design dev|deploy|destroy|generate-env local|testing|staging|production
  pnpm run backend -- dev local|testing|staging|production
  pnpm run service -- onboarding-service|cognito-service|document-analysis-service deploy|destroy local|testing|staging|production
  pnpm run database -- update|reset local|testing|staging|production
  pnpm run data -- export|reset|seed testing|staging|production
  pnpm run dev -- local|testing|staging|production
  pnpm run preview -- local
  pnpm run generate-env -- local|testing|staging|production
  pnpm run deploy -- local|testing|staging|production
  pnpm run destroy -- local|testing|staging|production
  pnpm run url -- local|testing|staging|production
  pnpm run bootstrap-up -- all|management|testing|staging|production
  pnpm run bootstrap-down -- management|testing|staging|production
  pnpm run dns-zone-up
  pnpm run org-redirect-up
  pnpm run org-redirect-down
EOF
  exit 1
}

stage_arg() {
  local stage="${1:-}"

  case "$stage" in
    local|testing|staging|production)
      printf '%s\n' "$stage"
      ;;
    *)
      usage
      ;;
  esac
}

deployed_stage_arg() {
  local stage="${1:-}"

  case "$stage" in
    testing|staging|production)
      printf '%s\n' "$stage"
      ;;
    *)
      usage
      ;;
  esac
}

app_dir() {
  local app="${1:-}"

  case "$app" in
    shell|core|form-design)
      printf '%s/apps/%s\n' "$ROOT_DIR" "$app"
      ;;
    *)
      usage
      ;;
  esac
}

service_dir() {
  local service="${1:-}"

  case "$service" in
    onboarding-service|cognito-service|document-analysis-service)
      printf '%s/services/%s\n' "$ROOT_DIR" "$service"
      ;;
    *)
      usage
      ;;
  esac
}

run_for_stage() {
  local stage="$1"
  shift

  if [[ "$stage" == "local" ]]; then
    ACO24_STAGE=local "$@"
  else
    AWS_PROFILE="$stage" ACO24_STAGE="$stage" "$@"
  fi
}

run_management_for_stage() {
  local stage="$1"
  shift

  AWS_PROFILE=management ACO24_STAGE="$stage" "$@"
}

run_app() {
  local app="${1:-}"
  local action="${2:-}"
  local stage
  stage="$(stage_arg "${3:-}")"
  local dir
  dir="$(app_dir "$app")"

  case "$action" in
    dev|generate-env)
      run_for_stage "$stage" pnpm -C "$dir" run "$action"
      ;;
    deploy)
      if [[ "$stage" == "local" ]]; then
        pnpm -C "$dir" run deploy:local
      else
        run_for_stage "$stage" pnpm -C "$dir" run deploy
      fi
      ;;
    destroy)
      if [[ "$stage" == "local" ]]; then
        pnpm -C "$dir" run destroy:local
      elif [[ "$app" == "shell" ]]; then
        run_management_for_stage "$stage" pnpm -C "$dir" run destroy
      else
        echo "$app is deployed into the shared website bucket; destroy shell infrastructure to remove it."
      fi
      ;;
    *)
      usage
      ;;
  esac
}

run_backend() {
  local action="${1:-}"
  local stage
  stage="$(stage_arg "${2:-}")"

  case "$action" in
    dev)
      run_for_stage "$stage" bash "$ROOT_DIR/scripts/run-backends.sh"
      ;;
    *)
      usage
      ;;
  esac
}

run_service() {
  local service="${1:-}"
  local action="${2:-}"
  local stage
  stage="$(stage_arg "${3:-}")"
  local dir
  dir="$(service_dir "$service")"

  case "$service:$action:$stage" in
    onboarding-service:deploy:local)
      run_for_stage local pnpm -C "$dir" run database:migrate
      ;;
    *:deploy:local)
      echo "No local $service infrastructure to deploy."
      ;;
    *:destroy:local)
      echo "No local $service infrastructure to destroy."
      ;;
    *:deploy:*|*:destroy:*)
      run_for_stage "$stage" pnpm -C "$dir" run "$action"
      ;;
    *)
      usage
      ;;
  esac
}

run_database() {
  local action="${1:-}"
  local stage
  stage="$(stage_arg "${2:-}")"

  case "$action" in
    update)
      run_for_stage "$stage" bash "$ROOT_DIR/scripts/update-database.sh"
      ;;
    reset)
      run_for_stage "$stage" bash "$ROOT_DIR/scripts/reset-database.sh"
      ;;
    *)
      usage
      ;;
  esac
}

run_data() {
  local action="${1:-}"
  local stage
  stage="$(deployed_stage_arg "${2:-}")"

  case "$action" in
    export|reset|seed)
      run_for_stage "$stage" pnpm -C "$ROOT_DIR/services/onboarding-service" run "data:$action"
      ;;
    *)
      usage
      ;;
  esac
}

run_all_frontends() {
  local action="$1"
  local stage
  stage="$(stage_arg "$2")"

  case "$action" in
    dev)
      run_for_stage "$stage" pnpm --parallel -F @apps/shell -F @apps/core -F @apps/form-design run dev
      ;;
    generate-env)
      run_app shell generate-env "$stage"
      run_app core generate-env "$stage"
      run_app form-design generate-env "$stage"
      ;;
    *)
      usage
      ;;
  esac
}

run_preview() {
  local stage
  stage="$(stage_arg "${1:-}")"

  case "$stage" in
    local)
      ACO24_STAGE=local bash "$ROOT_DIR/scripts/local-preview.sh"
      ;;
    *)
      echo "Preview is only supported for local. Use pnpm run dev -- $stage for deployed environments." >&2
      exit 1
      ;;
  esac
}

run_full_deploy() {
  local stage
  stage="$(stage_arg "${1:-}")"

  if [[ "$stage" == "local" ]]; then
    run_all_frontends generate-env local
    pnpm -C "$ROOT_DIR" run build
  else
    bash "$ROOT_DIR/scripts/deploy-stage.sh" "$stage"
  fi
}

run_full_destroy() {
  local stage
  stage="$(stage_arg "${1:-}")"

  if [[ "$stage" == "local" ]]; then
    pnpm -C "$ROOT_DIR" run docker:down
  else
    bash "$ROOT_DIR/scripts/destroy-stage.sh" "$stage"
  fi
}

run_url() {
  local stage
  stage="$(stage_arg "${1:-}")"

  if [[ "$stage" == "local" ]]; then
    echo "http://localhost:5173"
  else
    run_management_for_stage "$stage" pnpm -C "$ROOT_DIR/apps/shell" run url
  fi
}

case "$COMMAND" in
  app)
    run_app "${2:-}" "${3:-}" "${4:-}"
    ;;
  backend)
    run_backend "${2:-}" "${3:-}"
    ;;
  service)
    run_service "${2:-}" "${3:-}" "${4:-}"
    ;;
  database)
    run_database "${2:-}" "${3:-}"
    ;;
  data)
    run_data "${2:-}" "${3:-}"
    ;;
  dev)
    run_all_frontends dev "${2:-}"
    ;;
  preview)
    run_preview "${2:-}"
    ;;
  generate-env)
    run_all_frontends generate-env "${2:-}"
    ;;
  deploy)
    run_full_deploy "${2:-}"
    ;;
  destroy)
    run_full_destroy "${2:-}"
    ;;
  url)
    run_url "${2:-}"
    ;;
  bootstrap-up)
    bash "$ROOT_DIR/scripts/bootstrap-up.sh" "${2:-all}"
    ;;
  bootstrap-down)
    bash "$ROOT_DIR/scripts/bootstrap-down.sh" "${2:-}"
    ;;
  dns-zone-up)
    AWS_PROFILE=management pnpm -C "$ROOT_DIR/apps/shell" run dns-zone-up
    ;;
  org-redirect-up)
    AWS_PROFILE=management pnpm -C "$ROOT_DIR/apps/shell" run org-redirect-up
    ;;
  org-redirect-down)
    AWS_PROFILE=management pnpm -C "$ROOT_DIR/apps/shell" run org-redirect-down
    ;;
  *)
    usage
    ;;
esac
