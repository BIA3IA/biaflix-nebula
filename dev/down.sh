#!/usr/bin/env bash
# Ferma l'istanza Jellyfin locale di sviluppo. Con --purge rimuove anche container e dati locali.
set -euo pipefail
cd "$(dirname "$0")"
NAME="biaflix-nebula-dev"
docker stop "$NAME" >/dev/null 2>&1 || true
if [[ "${1:-}" == "--purge" ]]; then
  docker rm "$NAME" >/dev/null 2>&1 || true
  rm -rf .data/config .data/cache
  echo "Istanza di sviluppo rimossa (media sintetici conservati in dev/.data/media)."
fi
