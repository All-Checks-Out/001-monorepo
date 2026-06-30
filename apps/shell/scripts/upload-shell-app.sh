#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../../scripts/website-helpers.sh"

APP_DIST_DIR="dist"

echo ""
echo "Reading website bucket name from SSM Parameter Store..."
echo ""

WEBSITE_BUCKET_NAME=$(website_bucket_name)

echo "Uploading $APP_DIST_DIR to s3://$WEBSITE_BUCKET_NAME/"
echo ""

aws s3 sync "$APP_DIST_DIR" "s3://$WEBSITE_BUCKET_NAME" \
  --delete \
  --exclude "core/*" \
  --exclude "form-design/*"

echo ""
echo "Upload complete."
echo ""
