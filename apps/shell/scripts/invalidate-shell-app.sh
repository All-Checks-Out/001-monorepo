#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../../scripts/website-helpers.sh"

echo ""
echo "Reading CloudFront distribution ID from SSM Parameter Store..."
echo ""

DISTRIBUTION_ID=$(cloudfront_distribution_id)

echo "Creating CloudFront invalidation for shell paths"
echo ""

create_cloudfront_invalidation "$DISTRIBUTION_ID" "/" "/index.html" "/assets/*"

echo ""
echo "Invalidation requested."
echo ""
