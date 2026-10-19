#!/usr/bin/env bash
# Avvia un Jellyfin 12.2 LOCALE e isolato per sviluppo/test di Biaflix Nebula.
# Non tocca in alcun modo il server di produzione: porta 8097, dati in dev/.data.
set -euo pipefail
cd "$(dirname "$0")"

IMAGE="jellyfin/jellyfin:12.2.20261005-225228"
NAME="biaflix-nebula-dev"
PORT="${NEBULA_DEV_PORT:-8097}"

mkdir -p .data/config .data/cache .data/media
bash ./gen-media.sh "$PWD/.data/media"

if docker ps -a --format '{{.Names}}' | grep -qx "$NAME"; then
  docker start "$NAME" >/dev/null
else
  docker run -d --name "$NAME" \
    --user "$(id -u):$(id -g)" \
    -p "127.0.0.1:${PORT}:8096" \
    -v "$PWD/.data/config:/config" \
    -v "$PWD/.data/cache:/cache" \
    -v "$PWD/.data/media:/media:ro" \
    -v "$PWD/../dist:/nebula-dist:ro" \
    "$IMAGE" >/dev/null
fi

printf 'Attendo Jellyfin su http://127.0.0.1:%s ' "$PORT"
for _ in $(seq 1 90); do
  if curl -fs "http://127.0.0.1:${PORT}/System/Info/Public" >/dev/null 2>&1; then
    echo "OK"
    exit 0
  fi
  printf '.'
  sleep 1
done
echo " timeout" >&2
exit 1
