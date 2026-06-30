#!/usr/bin/env bash
set -euo pipefail

TARGET_STAGE="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$TARGET_STAGE" in
  management|testing|staging|production)
    ;;
  *)
    echo "Usage: $0 management|testing|staging|production" >&2
    exit 1
    ;;
esac

PROFILE="$TARGET_STAGE"
echo "Using AWS_PROFILE=$PROFILE for $TARGET_STAGE bootstrap deletion."

delete_bootstrap_stack() {
  local region="$1"

  AWS_PROFILE="$PROFILE" aws cloudformation delete-stack \
    --stack-name "CDKToolkit" \
    --region "$region"
}

delete_bootstrap_stack "eu-west-2"
delete_bootstrap_stack "us-east-1"

# -----------------------------------------------------------------------------
# CDK BOOTSTRAP ASSET CLEANUP
# -----------------------------------------------------------------------------
#
# The CDK bootstrap process may leave behind:
#
# - Versioned S3 buckets containing old deployment assets
# - ECR repositories containing container images
#
# These resources can incur small ongoing storage costs. The cleanup scripts
# below remove CDK bootstrap buckets and container images for the selected
# account after the bootstrap stack deletion has been requested.
#
"$SCRIPT_DIR/bootstrap-delete-buckets.sh"
"$SCRIPT_DIR/bootstrap-delete-containers.sh"
#
# -----------------------------------------------------------------------------
