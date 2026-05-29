#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${MAKERSHELF_DIR:-makershelf-server}"

if [ ! -d "${APP_DIR}" ] || [ ! -f "${APP_DIR}/compose.yml" ]; then
  echo "makershelf-server nicht gefunden unter: ${APP_DIR}"
  echo "Bitte zuerst den Installer ausführen:"
  echo "  bash <(curl -fsSL https://github.com/NilsN3DP/makershelf-releases/raw/main/install-makershelf-server.sh)"
  exit 1
fi

cd "${APP_DIR}"

echo "makershelf Server wird aktualisiert..."
echo ""

# Clear cached credentials to avoid pull errors
docker logout ghcr.io 2>/dev/null || true

docker compose pull
docker compose up -d

echo ""
echo "Update abgeschlossen. makershelf Server läuft."
PORT="$(grep '^MAKERSHELF_PORT=' .env 2>/dev/null | cut -d= -f2 || echo 3000)"
echo "Öffne: http://localhost:${PORT}"
