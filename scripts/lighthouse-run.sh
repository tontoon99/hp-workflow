#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: bash scripts/lighthouse-run.sh <url>"
  exit 1
fi

TARGET_URL="$1"

echo "Stub: run lighthouse in external worker for ${TARGET_URL}"
echo "Recommendation: call containerized lighthouse service via HTTP"
