#!/usr/bin/env bash

set -euo pipefail

playwright_args=()

if [[ "${1:-}" == "--headed" || "${1:-}" == "--debug" ]]; then
  playwright_args+=("$1")
  shift
fi

if [[ "${1:-}" == "--" ]]; then
  shift
fi

playwright test --config ui-testing/playwright/playwright.config.ts ${playwright_args+"${playwright_args[@]}"} "$@"
