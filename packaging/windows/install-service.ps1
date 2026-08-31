<#
  Movviz - one-shot Windows installer.

  Builds the app, prepares the standalone server, and registers the Movviz
  service so it starts automatically at every boot and restarts on failure.

  Run in an ELEVATED PowerShell (Run as Administrator), from the project root:
      powershell -ExecutionPolicy Bypass -File packaging\windows\install-service.ps1
#>

$ErrorActionPreference = "Stop"

# --- Require administrator -------------------------------------------------
$admin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Write-Error "This installer must be run as Administrator."
  exit 1
}

# Move to project root (two levels up from this script).
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root
Write-Host "Movviz - installing from $root" -ForegroundColor Cyan

# --- Dependencies + build --------------------------------------------------
Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "Building production bundle..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

# --- Assemble standalone output -------------------------------------------
# Next's standalone output needs static assets copied alongside the server.
$standalone = Join-Path $root ".next\standalone"
Copy-Item -Recurse -Force (Join-Path $root ".next\static") (Join-Path $standalone ".next\static")
if (Test-Path (Join-Path $root "public")) {
  Copy-Item -Recurse -Force (Join-Path $root "public") (Join-Path $standalone "public")
}

# --- FFmpeg (moteur de remux local, optionnel) ------------------------------
# Le binaire n'est pas telecharge automatiquement en v1 : on prepare juste le
# dossier cible et on avertit si le binaire est absent. L'app se rabat en
# silence sur le transcodage Plex tant qu'il manque, donc ce n'est jamais
# bloquant pour l'installation.
$ffmpegDir = Join-Path $env:ProgramData "Movviz\bin"
$ffmpegPath = Join-Path $ffmpegDir "ffmpeg.exe"
if (-not (Test-Path $ffmpegDir)) {
  New-Item -ItemType Directory -Force -Path $ffmpegDir | Out-Null
}
if (-not (Test-Path $ffmpegPath)) {
  Write-Warning "ffmpeg.exe est introuvable dans $ffmpegDir"
  Write-Host "  Le moteur de lecture 'remux local' restera desactive tant que ce binaire n'est pas installe." -ForegroundColor Yellow
  Write-Host "  Placez un ffmpeg.exe Windows a cet emplacement pour l'activer (ex. build 'essentials' officiel de gyan.dev : https://www.gyan.dev/ffmpeg/builds/)." -ForegroundColor Yellow
  Write-Host "  Sans lui, Movviz continue de fonctionner normalement et se rabat sur le transcodage Plex." -ForegroundColor DarkGray
}

# --- Register the service --------------------------------------------------
Write-Host "Registering the Movviz Windows service..." -ForegroundColor Cyan
node packaging\windows\service.js install
if ($LASTEXITCODE -ne 0) { throw "service registration failed" }

$port = if ($env:MOVVIZ_WEB_PORT) { $env:MOVVIZ_WEB_PORT } else { "9810" }
Write-Host ""
Write-Host "Movviz installed and running." -ForegroundColor Green
Write-Host "  Interface : http://localhost:$port" -ForegroundColor Green
Write-Host "  Service   : starts automatically at boot, restarts on failure." -ForegroundColor Green
Write-Host "  Remove    : npm run service:uninstall" -ForegroundColor DarkGray
