#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../../scripts/website-helpers.sh"

echo ""
echo "Reading website bucket name from SSM Parameter Store..."
echo ""

if ! WEBSITE_BUCKET_NAME=$(optional_website_parameter "bucket-name"); then
  echo "No website bucket parameter found for $TARGET_ENV. Nothing to empty."
  echo ""
  exit 0
fi

if [[ -z "$WEBSITE_BUCKET_NAME" || "$WEBSITE_BUCKET_NAME" == "None" ]]; then
  echo "Website bucket parameter was empty for $TARGET_ENV. Nothing to empty."
  echo ""
  exit 0
fi

echo "Emptying s3://$WEBSITE_BUCKET_NAME before stack destroy..."
echo ""

aws s3 rm "s3://$WEBSITE_BUCKET_NAME" --recursive

echo ""
echo "Bucket emptied."
echo ""
