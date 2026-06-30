#!/usr/bin/env bash

set -euo pipefail

WEBSITE_REGION="us-east-1"
TARGET_ENV="$ACO24_STAGE"

case "$TARGET_ENV" in
  testing|staging|production)
    ;;
  *)
    echo "Usage: $0 testing|staging|production" >&2
    exit 1
    ;;
esac

website_parameter() {
  local name="$1"

  aws ssm get-parameter \
    --region "$WEBSITE_REGION" \
    --name "/stages/$TARGET_ENV/website/$name" \
    --query "Parameter.Value" \
    --output text
}

optional_website_parameter() {
  local name="$1"

  aws ssm get-parameter \
    --region "$WEBSITE_REGION" \
    --name "/stages/$TARGET_ENV/website/$name" \
    --query "Parameter.Value" \
    --output text 2>/dev/null
}

website_bucket_name() {
  website_parameter "bucket-name"
}

cloudfront_distribution_id() {
  website_parameter "distribution-id"
}

create_cloudfront_invalidation() {
  local distribution_id="$1"
  shift

  aws cloudfront create-invalidation \
    --distribution-id "$distribution_id" \
    --paths "$@"
}
