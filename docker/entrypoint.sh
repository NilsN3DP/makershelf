#!/bin/sh
set -eu

APPDATA_ROOT="${MAKERSHELF_APPDATA_ROOT:-/config}"
STORAGE_ROOT="${MAKERSHELF_STORAGE_ROOT:-/storage}"

mkdir -p "$APPDATA_ROOT" "$STORAGE_ROOT"

if [ -n "${DATABASE_URL:-}" ] && [ -f "./scripts/prisma-run.mjs" ]; then
  node ./scripts/prisma-run.mjs db push --skip-generate
fi

exec "$@"
