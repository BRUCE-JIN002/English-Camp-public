#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
release=${1:?release required}
bundle=${2:?bundle required}
[[ "$release" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || { echo 'Invalid release ID' >&2; exit 1; }
cd /opt/english-ai/deploy
exec 9>/opt/english-ai/deploy/.release.lock
flock -n 9 || { echo 'Another deployment is running' >&2; exit 1; }
test -s .env && test -s runtime.env
(cd "$bundle" && sha256sum -c images.tar.gz.sha256)
backup="backups/releases/$release"
mkdir -p "$backup"
cp compose.yaml .env "$backup/"
docker compose exec -T postgres pg_dump -U english -d english -Fc > "$backup/english.dump"
docker compose exec -T postgres pg_dump -U english -d english_chat -Fc > "$backup/chat.dump"
# Keep the old images addressable for rollback, including the initial :local release.
for svc in server web; do
  image=$(docker inspect "$(docker compose ps -q "$svc")" --format '{{.Image}}')
  docker tag "$image" "english-ai-rollback-$svc:$release"
done
docker load -i "$bundle/images.tar.gz"
rollback() {
  status=$?
  trap - ERR
  echo 'Deployment failed; restoring previous application configuration.' >&2
  cp "$backup/compose.yaml" compose.yaml
  cp "$backup/.env" .env
  docker compose up -d --no-build --no-deps --force-recreate server ai web || true
  echo "Database backups retained at $backup; schema migrations are not automatically reversed." >&2
  exit "$status"
}
trap rollback ERR
install -m 644 "$bundle/compose.yaml" compose.yaml
python3 - "$release" <<'PY'
from pathlib import Path
import sys
p=Path('.env')
s='\n'.join(line for line in p.read_text().splitlines() if not line.startswith(('BACKEND_IMAGE=', 'WEB_IMAGE=')))
s+=f'\nBACKEND_IMAGE=english-ai-backend:{sys.argv[1]}\nWEB_IMAGE=english-ai-web:{sys.argv[1]}\n'
p.write_text(s)
PY
docker compose run --rm --no-deps migrate node /app/deploy/migrate-with-retry.cjs
docker compose up -d --no-build --no-deps --force-recreate server ai web
healthy=0
for attempt in $(seq 1 40); do
  if curl -fsS http://127.0.0.1:18082/api/v1/course/list > /dev/null &&
     curl -fsS http://127.0.0.1:18082/ai/v1 > /dev/null &&
     curl -fsS http://127.0.0.1:18082/ > /dev/null; then
    healthy=1; break
  fi
  sleep 3
done
[[ "$healthy" == 1 ]]
# Also verify the host proxy, without depending on public network routing.
curl -fsS http://127.0.0.1/english/ > /dev/null
curl -fsS http://127.0.0.1/api/v1/course/list > /dev/null
curl -fsS http://127.0.0.1/ai/v1 > /dev/null
curl -fsS http://127.0.0.1/english/release.json | python3 -c 'import json,sys; assert json.load(sys.stdin)["release"] == sys.argv[1]' "$release"
printf '%s\n' "$release" > current-release
trap - ERR
docker compose ps
echo "Deployed $release"
