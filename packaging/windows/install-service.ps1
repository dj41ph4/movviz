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
