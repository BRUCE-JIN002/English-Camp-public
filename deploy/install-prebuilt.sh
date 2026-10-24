#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
docker load -i ../app-images.tar.gz
docker load -i ../minio-image.tar.gz
docker compose up -d --no-build postgres redis minio
for attempt in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U english -d english >/dev/null; then break; fi
  sleep 2
done
existing=$(docker compose exec -T postgres psql -U english -d english -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
if [[ "$existing" == "0" && -f backups/english.dump ]]; then
  docker compose exec -T postgres pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U english -d english < backups/english.dump
fi
existing_chat=$(docker compose exec -T postgres psql -U english -d english_chat -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
if [[ "$existing_chat" == "0" && -f backups/chat.dump ]]; then
  docker compose exec -T postgres pg_restore --exit-on-error --single-transaction --no-owner --no-acl -U english -d english_chat < backups/chat.dump
fi
docker compose run --rm migrate
if [[ -d backups/media ]]; then
  docker compose run --rm -T --no-deps -v "$PWD/backups/media:/import:ro" server node < import-media.cjs
fi
docker compose up -d --no-build server ai web
curl --retry 15 --retry-connrefused --retry-all-errors --retry-delay 2 -fsS http://127.0.0.1:18082/api/v1/course/list >/dev/null
curl --retry 15 --retry-connrefused --retry-all-errors --retry-delay 2 -fsS http://127.0.0.1:18082/ai/v1 >/dev/null
docker compose ps
