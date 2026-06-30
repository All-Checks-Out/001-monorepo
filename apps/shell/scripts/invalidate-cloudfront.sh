#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../../scripts/website-helpers.sh"

echo ""
echo "Reading CloudFront distribution ID from SSM Parameter Store..."
echo ""

DISTRIBUTION_ID=$(cloudfront_distribution_id)

echo "Creating CloudFront invalidation for distribution:"
echo "$DISTRIBUTION_ID"
echo ""

create_cloudfront_invalidation "$DISTRIBUTION_ID" "/*"

echo ""
echo "Invalidation requested."
echo ""
