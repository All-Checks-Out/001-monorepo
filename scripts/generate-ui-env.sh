#!/usr/bin/env bash

set -euo pipefail


ONBOARDING_SERVICE_BASE_URL_PARAMETER="/services/onboarding-service/base-url"
COGNITO_DOMAIN_PARAMETER="/cognito/domain"
COGNITO_CLIENT_ID_PARAMETER="/cognito/client-id"
COGNITO_USER_POOL_ID_PARAMETER="/cognito/user-pool-id"

TARGET_ENV="$ACO24_STAGE"
OUTPUT_FILE=".env"

case "$TARGET_ENV" in
  local|testing|staging|production)
    ;;
  *)
    echo "Usage: $0 local|testing|staging|production" >&2
    exit 1
    ;;
esac

echo ""
echo "Generating UI environment for $TARGET_ENV..."
echo ""

if [[ "$TARGET_ENV" == "local" ]]; then
  ONBOARDING_SERVICE_BASE_URL="http://localhost:3001"
  COGNITO_DOMAIN="http://localhost:3001/local-cognito-disabled"
  COGNITO_CLIENT_ID="local"
  COGNITO_USER_POOL_ID="local"
  CORE_REMOTE_ENTRY_URL="http://localhost:5174/core/remoteEntry.js"
  FORM_DESIGN_REMOTE_ENTRY_URL="http://localhost:5175/form-design/remoteEntry.js"
else
  echo "Reading onboarding service URL from SSM Parameter Store..."
  ONBOARDING_SERVICE_BASE_URL=$(aws ssm get-parameter \
    --name "$ONBOARDING_SERVICE_BASE_URL_PARAMETER" \
    --query "Parameter.Value" \
    --output text)

  echo "Reading Cognito parameters from SSM Parameter Store..."

  COGNITO_DOMAIN=$(aws ssm get-parameter \
    --name "$COGNITO_DOMAIN_PARAMETER" \
    --query "Parameter.Value" \
    --output text)

  COGNITO_CLIENT_ID=$(aws ssm get-parameter \
    --name "$COGNITO_CLIENT_ID_PARAMETER" \
    --query "Parameter.Value" \
    --output text)

  COGNITO_USER_POOL_ID=$(aws ssm get-parameter \
    --name "$COGNITO_USER_POOL_ID_PARAMETER" \
    --query "Parameter.Value" \
    --output text)

  WEBSITE_DOMAIN_NAME_PARAMETER="/stages/$TARGET_ENV/website/domain-name"
  WEBSITE_DOMAIN_NAME=$(AWS_PROFILE=management aws ssm get-parameter \
    --region "us-east-1" \
    --name "$WEBSITE_DOMAIN_NAME_PARAMETER" \
    --query "Parameter.Value" \
    --output text)
  CORE_REMOTE_ENTRY_URL="https://$WEBSITE_DOMAIN_NAME/core/remoteEntry.js"
  FORM_DESIGN_REMOTE_ENTRY_URL="https://$WEBSITE_DOMAIN_NAME/form-design/remoteEntry.js"
fi

echo "Generating $OUTPUT_FILE"

cat > "$OUTPUT_FILE" <<EOF
VITE_APP_ENV=$TARGET_ENV
VITE_ONBOARDING_SERVICE_BASE_URL=$ONBOARDING_SERVICE_BASE_URL
VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN
VITE_COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID
VITE_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_CORE_REMOTE_ENTRY_URL=$CORE_REMOTE_ENTRY_URL
VITE_FORM_DESIGN_REMOTE_ENTRY_URL=$FORM_DESIGN_REMOTE_ENTRY_URL
EOF

echo ""
echo "Generated:"
echo "$OUTPUT_FILE"
echo ""
cat "$OUTPUT_FILE"
echo ""
