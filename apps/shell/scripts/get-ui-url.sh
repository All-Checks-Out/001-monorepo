#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../../scripts/website-helpers.sh"

echo ""
echo "Reading website URL from SSM Parameter Store..."
echo ""

WEBSITE_URL=$(website_parameter "distribution-url")

echo "$WEBSITE_URL"
echo ""
