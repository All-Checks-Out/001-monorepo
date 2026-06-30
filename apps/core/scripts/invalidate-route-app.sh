#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../../scripts/website-helpers.sh"

APP_PREFIX="core"

echo ""
echo "Reading CloudFront distribution ID from SSM Parameter Store..."
echo ""

DISTRIBUTION_ID=$(cloudfront_distribution_id)

echo "Creating CloudFront invalidation for /$APP_PREFIX/*"
echo ""

create_cloudfront_invalidation "$DISTRIBUTION_ID" "/$APP_PREFIX" "/$APP_PREFIX/*"

echo ""
echo "Invalidation requested."
echo ""
