$ErrorActionPreference = "Stop"

$AppDir = if ($env:MAKERSHELF_DIR) { $env:MAKERSHELF_DIR } else { "makershelf-server" }

if (-not (Test-Path (Join-Path $AppDir "compose.yml"))) {
  Write-Host "makershelf-server nicht gefunden unter: $AppDir" -ForegroundColor Red
  Write-Host "Bitte zuerst den Installer ausführen:"
  Write-Host "  powershell -ExecutionPolicy Bypass -Command `"irm https://github.com/NilsN3DP/makershelf-releases/raw/main/install-makershelf-server.ps1 | iex`""
  exit 1
}

Set-Location $AppDir

Write-Host "makershelf Server wird aktualisiert..."
Write-Host ""

# Clear cached credentials to avoid pull errors
docker logout ghcr.io 2>$null | Out-Null

docker compose pull
docker compose up -d

Write-Host ""
Write-Host "Update abgeschlossen. makershelf Server läuft."
$port = (Get-Content ".env" -ErrorAction SilentlyContinue | Where-Object { $_ -like "MAKERSHELF_PORT=*" } | Select-Object -First 1)?.Split("=")[1]
if (-not $port) { $port = "3000" }
Write-Host "Öffne: http://localhost:$port"
