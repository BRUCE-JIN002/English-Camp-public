#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
test -f .env && test -f runtime.env || {
  echo 'Run node deploy/prepare-env.mjs from the repository root first.' >&2
  exit 1
}
if [[ "${BUILD_IMAGES:-0}" == "1" ]]; then docker compose build; fi
docker compose up -d postgres redis minio
docker compose run --rm migrate
docker compose up -d --no-build server ai web
docker compose ps
