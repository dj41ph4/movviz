<#
  Movviz - build the Windows installer (.exe).

  Pipeline:
    1. Build the Next.js production bundle (standalone output).
    2. Stage the app + a bundled Node runtime + NSSM service manager.
    3. Generate the app icon.
    4. Compile the Inno Setup script into dist\Movviz-Setup-<version>.exe.

  Usage (from anywhere):
      powershell -ExecutionPolicy Bypass -File packaging\windows\installer\build.ps1
#>

$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$root = Resolve-Path (Join-Path $here "..\..\..")
$stage = Join-Path $here "stage"
$tools = Join-Path $here ".tools"
$dist = Join-Path $root "dist"

function Step($m) { Write-Host "==> $m" -ForegroundColor Cyan }

# --- Version from package.json ---------------------------------------------
$pkg = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$version = $pkg.version
Step "Building Movviz installer v$version"

# --- Locate Inno Setup compiler --------------------------------------------
$iscc = @(
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw "Inno Setup 6 (ISCC.exe) not found. Install it from https://jrsoftware.org/isdl.php" }

# --- Locate bundled Node ----------------------------------------------------
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodeExe) { throw "node.exe not found on PATH - cannot bundle the runtime." }

# --- 1. Build ---------------------------------------------------------------
Step "Building production bundle"
Push-Location $root
try {
  if (-not (Test-Path (Join-Path $root "node_modules"))) { npm install --no-audit --no-fund }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "next build failed" }
} finally { Pop-Location }

$standalone = Join-Path $root ".next\standalone"
if (-not (Test-Path (Join-Path $standalone "server.js"))) {
  throw "standalone server.js not found - ensure next.config has output:'standalone'."
}

# --- 2. Stage ---------------------------------------------------------------
Step "Staging files"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force (Join-Path $stage "app") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $stage "runtime") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $stage "service") | Out-Null

# App = standalone + static + public
Copy-Item -Recurse -Force (Join-Path $standalone "*") (Join-Path $stage "app")
Copy-Item -Recurse -Force (Join-Path $root ".next\static") (Join-Path $stage "app\.next\static")
if (Test-Path (Join-Path $root "public")) {
  Copy-Item -Recurse -Force (Join-Path $root "public") (Join-Path $stage "app\public")
}

# Download engine — bundled next to the app so the web server spawns it on boot.
Step "Staging download engine"
$engineSrc = Join-Path $root "engine"
$engineNM = Join-Path $engineSrc "node_modules"
if (-not (Test-Path $engineNM)) {
  Write-Host "  installing engine dependencies..." -ForegroundColor DarkGray
  Push-Location $engineSrc
  try { npm install --no-audit --no-fund } finally { Pop-Location }
}
# Wipe any partial engine/ copied by Next.js standalone trace (it only grabs
# the entry point index.mjs — the rest is missing). We re-copy the full source.
$stageEngine = Join-Path $stage "app\engine"
if (Test-Path $stageEngine) { Remove-Item $stageEngine -Recurse -Force }
New-Item -ItemType Directory -Force $stageEngine | Out-Null
Copy-Item -Recurse -Force (Join-Path $engineSrc "src") (Join-Path $stageEngine "src")
Copy-Item -Force (Join-Path $engineSrc "package.json") (Join-Path $stageEngine "package.json")
Copy-Item -Recurse -Force $engineNM (Join-Path $stageEngine "node_modules")

# Cloudflare resolver — built and bundled so the web server can spawn it on demand.
Step "Staging Cloudflare resolver"
$resolverSrc = Join-Path $root "resolver"
$resolverNM = Join-Path $resolverSrc "node_modules"
if (-not (Test-Path $resolverNM)) {
  Write-Host "  installing resolver dependencies..." -ForegroundColor DarkGray
  Push-Location $resolverSrc
  try { npm install --no-audit --no-fund } finally { Pop-Location }
}
Write-Host "  building resolver TypeScript..." -ForegroundColor DarkGray
Push-Location $resolverSrc
try { npm run build } finally { Pop-Location }
$stageResolver = Join-Path $stage "app\resolver"
if (Test-Path $stageResolver) { Remove-Item $stageResolver -Recurse -Force }
New-Item -ItemType Directory -Force $stageResolver | Out-Null
Copy-Item -Recurse -Force (Join-Path $resolverSrc "dist") (Join-Path $stageResolver "dist")
Copy-Item -Force (Join-Path $resolverSrc "package.json") (Join-Path $stageResolver "package.json")
Copy-Item -Recurse -Force $resolverNM (Join-Path $stageResolver "node_modules")

# Runtime = local node.exe
Copy-Item -Force $nodeExe (Join-Path $stage "runtime\node.exe")

# Service wrapper = WinSW (single exe driven by movviz-service.xml).
$winsw = Join-Path $tools "WinSW-x64.exe"
if (-not (Test-Path $winsw)) {
  Step "Fetching WinSW (service wrapper)"
  New-Item -ItemType Directory -Force $tools | Out-Null
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe" -OutFile $winsw -UseBasicParsing
  } catch {
    throw "Could not download WinSW. Place WinSW-x64.exe at $winsw and re-run. ($_)"
  }
}
Copy-Item -Force $winsw (Join-Path $stage "service\movviz-service.exe")
Copy-Item -Force (Join-Path $here "movviz-service.xml") (Join-Path $stage "service")

# --- 3. Icon ----------------------------------------------------------------
Step "Generating icon"
& (Join-Path $here "make-icon.ps1") -OutFile (Join-Path $here "movviz.ico")

# --- 4. Compile installer ---------------------------------------------------
Step "Compiling installer with Inno Setup"
New-Item -ItemType Directory -Force $dist | Out-Null
& $iscc "/DAppVersion=$version" (Join-Path $here "movviz.iss")
if ($LASTEXITCODE -ne 0) { throw "ISCC failed" }

$out = Join-Path $dist "Movviz-Setup-$version.exe"
Write-Host ""
Write-Host "Installer built: $out" -ForegroundColor Green
