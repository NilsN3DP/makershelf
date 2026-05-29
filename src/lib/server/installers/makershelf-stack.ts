import packageJson from "@/package.json";

export function buildInstallSh() {
  return `#!/usr/bin/env bash
set -euo pipefail

APP_DIR="\${MAKERSHELF_DIR:-makershelf-server}"
IMAGE_TAG="\${MAKERSHELF_IMAGE_TAG:-beta}"
IMAGE="ghcr.io/nilsn3dp/makershelf-server:\${IMAGE_TAG}"
RELEASE_VERSION="v${packageJson.version}"
IMAGE_ARCHIVE_URL="\${MAKERSHELF_IMAGE_ARCHIVE_URL:-https://github.com/NilsN3DP/makershelf-releases/releases/download/\${RELEASE_VERSION}/makershelf-server-\${RELEASE_VERSION}.tar.gz}"
DATA_DIR="\${MAKERSHELF_DATA_DIR:-}"
PORT="\${MAKERSHELF_PORT:-3000}"
BIND_IP="\${MAKERSHELF_BIND_IP:-}"

command -v docker >/dev/null 2>&1 || { echo "Docker is required."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required."; exit 1; }

random_base64() {
  local bytes="\${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 "\${bytes}" | tr -d '\\n'
  else
    head -c "\${bytes}" /dev/urandom | base64 | tr -d '\\n'
  fi
}

mkdir -p "\${APP_DIR}"
cd "\${APP_DIR}"

if [ ! -f .env ]; then
  DB_PASSWORD="$(random_base64 24 | tr '/+' 'Aa')"
  AUTH_SECRET="$(random_base64 48)"
  if [ -n "\${DATA_DIR}" ]; then
    mkdir -p "\${DATA_DIR}/postgres" "\${DATA_DIR}/config" "\${DATA_DIR}/storage" "\${DATA_DIR}/import"
    POSTGRES_VOLUME="\${DATA_DIR}/postgres"
    CONFIG_VOLUME="\${DATA_DIR}/config"
    STORAGE_VOLUME="\${DATA_DIR}/storage"
    IMPORT_VOLUME="\${DATA_DIR}/import"
  else
    POSTGRES_VOLUME="makershelf_postgres"
    CONFIG_VOLUME="makershelf_config"
    STORAGE_VOLUME="makershelf_storage"
    IMPORT_VOLUME="makershelf_import"
  fi
  if [ -n "\${BIND_IP}" ]; then
    PORT_BINDING="\${BIND_IP}:\${PORT}:3000"
  else
    PORT_BINDING="\${PORT}:3000"
  fi
  cat > .env <<EOF
MAKERSHELF_IMAGE=\${IMAGE}
MAKERSHELF_PORT=\${PORT}
MAKERSHELF_BIND_IP=\${BIND_IP}
MAKERSHELF_PORT_BINDING=\${PORT_BINDING}
POSTGRES_DB=makershelf
POSTGRES_USER=makershelf
POSTGRES_PASSWORD=\${DB_PASSWORD}
MAKERSHELF_AUTH_SECRET=\${AUTH_SECRET}
MAKERSHELF_POSTGRES_VOLUME=\${POSTGRES_VOLUME}
MAKERSHELF_CONFIG_VOLUME=\${CONFIG_VOLUME}
MAKERSHELF_STORAGE_VOLUME=\${STORAGE_VOLUME}
MAKERSHELF_IMPORT_VOLUME=\${IMPORT_VOLUME}
EOF
fi

cat > compose.yml <<'EOF'
services:
  postgres:
    image: postgres:17-alpine
    container_name: makershelf-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${POSTGRES_DB}
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - \${MAKERSHELF_POSTGRES_VOLUME}:/var/lib/postgresql/data

  makershelf:
    image: \${MAKERSHELF_IMAGE}
    container_name: makershelf-server
    restart: unless-stopped
    depends_on:
      - postgres
    ports:
      - "\${MAKERSHELF_PORT_BINDING:-3000:3000}"
    environment:
      MAKERSHELF_PRODUCT_PROFILE: server
      MAKERSHELF_APP_NAME: makershelf Server
      MAKERSHELF_DEPLOYMENT_MODE: docker-team
      MAKERSHELF_DATA_BACKEND: postgres
      MAKERSHELF_STORAGE_DRIVER: filesystem
      DATABASE_PROVIDER: postgresql
      DATABASE_URL: postgres://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}
      MAKERSHELF_APPDATA_ROOT: /config
      MAKERSHELF_STORAGE_ROOT: /storage
      MAKERSHELF_IMPORT_ROOT: /import
      MAKERSHELF_AUTH_SECRET: \${MAKERSHELF_AUTH_SECRET}
      MAKERSHELF_LICENSE_TIER: community
      MAKERSHELF_LICENSE_KEY: MAKERSHELF-COMMUNITY-beta
      MAKERSHELF_UPDATE_CHANNEL: beta
    volumes:
      - \${MAKERSHELF_CONFIG_VOLUME}:/config
      - \${MAKERSHELF_STORAGE_VOLUME}:/storage
      - \${MAKERSHELF_IMPORT_VOLUME}:/import

volumes:
  makershelf_postgres:
  makershelf_config:
  makershelf_storage:
  makershelf_import:
EOF

if docker compose pull; then
  echo "Image pull completed."
else
  echo "Image pull failed. Falling back to public release archive:"
  echo "\${IMAGE_ARCHIVE_URL}"
  TMP_ARCHIVE="$(mktemp -t makershelf-image.XXXXXX.tar.gz)"
  curl -fL "\${IMAGE_ARCHIVE_URL}" -o "\${TMP_ARCHIVE}"
  docker load -i "\${TMP_ARCHIVE}"
  rm -f "\${TMP_ARCHIVE}"
fi
docker compose up -d

echo
echo "makershelf Server ${packageJson.version} is starting."
echo "Open: http://localhost:\$(grep '^MAKERSHELF_PORT=' .env | cut -d= -f2)/setup"
`;
}

export function buildInstallPs1() {
  return `$ErrorActionPreference = "Stop"

$AppDir = if ($env:MAKERSHELF_DIR) { $env:MAKERSHELF_DIR } else { "makershelf-server" }
$ImageTag = if ($env:MAKERSHELF_IMAGE_TAG) { $env:MAKERSHELF_IMAGE_TAG } else { "beta" }
$Image = "ghcr.io/nilsn3dp/makershelf-server:$ImageTag"
$ReleaseVersion = "v${packageJson.version}"
$ImageArchiveUrl = if ($env:MAKERSHELF_IMAGE_ARCHIVE_URL) { $env:MAKERSHELF_IMAGE_ARCHIVE_URL } else { "https://github.com/NilsN3DP/makershelf-releases/releases/download/$ReleaseVersion/makershelf-server-$ReleaseVersion.tar.gz" }
$DataDir = if ($env:MAKERSHELF_DATA_DIR) { $env:MAKERSHELF_DATA_DIR } else { "" }
$Port = if ($env:MAKERSHELF_PORT) { $env:MAKERSHELF_PORT } else { "3000" }
$BindIp = if ($env:MAKERSHELF_BIND_IP) { $env:MAKERSHELF_BIND_IP } else { "" }

docker --version | Out-Null
docker compose version | Out-Null

New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
Set-Location $AppDir

if (-not (Test-Path ".env")) {
  $dbPassword = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)).Replace("/", "A").Replace("+", "a")
  $authSecret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
  if ($DataDir) {
    $postgresVolume = Join-Path $DataDir "postgres"
    $configVolume = Join-Path $DataDir "config"
    $storageVolume = Join-Path $DataDir "storage"
    $importVolume = Join-Path $DataDir "import"
    New-Item -ItemType Directory -Path $postgresVolume, $configVolume, $storageVolume, $importVolume -Force | Out-Null
  } else {
    $postgresVolume = "makershelf_postgres"
    $configVolume = "makershelf_config"
    $storageVolume = "makershelf_storage"
    $importVolume = "makershelf_import"
  }
  if ($BindIp) {
    $portBinding = "{0}:{1}:3000" -f $BindIp, $Port
  } else {
    $portBinding = "{0}:3000" -f $Port
  }
  @"
MAKERSHELF_IMAGE=$Image
MAKERSHELF_PORT=$Port
MAKERSHELF_BIND_IP=$BindIp
MAKERSHELF_PORT_BINDING=$portBinding
POSTGRES_DB=makershelf
POSTGRES_USER=makershelf
POSTGRES_PASSWORD=$dbPassword
MAKERSHELF_AUTH_SECRET=$authSecret
MAKERSHELF_POSTGRES_VOLUME=$postgresVolume
MAKERSHELF_CONFIG_VOLUME=$configVolume
MAKERSHELF_STORAGE_VOLUME=$storageVolume
MAKERSHELF_IMPORT_VOLUME=$importVolume
"@ | Set-Content -Path ".env" -Encoding UTF8
}

@"
services:
  postgres:
    image: postgres:17-alpine
    container_name: makershelf-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${POSTGRES_DB}
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
    volumes:
      - \${MAKERSHELF_POSTGRES_VOLUME}:/var/lib/postgresql/data

  makershelf:
    image: \${MAKERSHELF_IMAGE}
    container_name: makershelf-server
    restart: unless-stopped
    depends_on:
      - postgres
    ports:
      - "\${MAKERSHELF_PORT_BINDING:-3000:3000}"
    environment:
      MAKERSHELF_PRODUCT_PROFILE: server
      MAKERSHELF_APP_NAME: makershelf Server
      MAKERSHELF_DEPLOYMENT_MODE: docker-team
      MAKERSHELF_DATA_BACKEND: postgres
      MAKERSHELF_STORAGE_DRIVER: filesystem
      DATABASE_PROVIDER: postgresql
      DATABASE_URL: postgres://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}
      MAKERSHELF_APPDATA_ROOT: /config
      MAKERSHELF_STORAGE_ROOT: /storage
      MAKERSHELF_IMPORT_ROOT: /import
      MAKERSHELF_AUTH_SECRET: \${MAKERSHELF_AUTH_SECRET}
      MAKERSHELF_LICENSE_TIER: community
      MAKERSHELF_LICENSE_KEY: MAKERSHELF-COMMUNITY-beta
      MAKERSHELF_UPDATE_CHANNEL: beta
    volumes:
      - \${MAKERSHELF_CONFIG_VOLUME}:/config
      - \${MAKERSHELF_STORAGE_VOLUME}:/storage
      - \${MAKERSHELF_IMPORT_VOLUME}:/import

volumes:
  makershelf_postgres:
  makershelf_config:
  makershelf_storage:
  makershelf_import:
"@ | Set-Content -Path "compose.yml" -Encoding UTF8

try {
  docker compose pull
  Write-Host "Image pull completed."
} catch {
  Write-Host "Image pull failed. Falling back to public release archive:"
  Write-Host $ImageArchiveUrl
  $archive = Join-Path ([IO.Path]::GetTempPath()) "makershelf-server-image.tar.gz"
  Invoke-WebRequest -Uri $ImageArchiveUrl -OutFile $archive
  docker load -i $archive
  Remove-Item $archive -Force
}
docker compose up -d

$port = (Get-Content ".env" | Where-Object { $_ -like "MAKERSHELF_PORT=*" } | Select-Object -First 1).Split("=")[1]
Write-Host ""
Write-Host "makershelf Server ${packageJson.version} is starting."
Write-Host "Open: http://localhost:$port/setup"
`;
}
