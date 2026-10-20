param([string]$Compiler = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'packaging\windows\installer'
$fixture = Join-Path $root ('.scratch\installer-compile-' + [guid]::NewGuid())
foreach ($directory in @('stage\runtime', 'stage\service', 'stage\app', 'stage\updater', 'output')) {
    New-Item -ItemType Directory -Path (Join-Path $fixture $directory) -Force | Out-Null
}
# Compile the real installer logic with tiny inert payloads. NEVER install this
# fixture: full production packaging remains the release workflow's job.
foreach ($file in @('runtime\node.exe', 'service\movviz-service.exe', 'app\server.js', 'updater\movviz-updater.exe')) {
    [IO.File]::WriteAllText((Join-Path $fixture "stage\$file"), 'COMPILE TEST ONLY')
}
foreach ($file in @('movviz-updater.xml', 'register-updater.ps1', 'update-service.ps1', 'update-worker.ps1')) {
    Copy-Item -LiteralPath (Join-Path $source $file) -Destination (Join-Path $fixture 'stage\updater')
}
foreach ($file in @('movviz.ico', 'Movviz.url', 'movviz.iss')) {
    Copy-Item -LiteralPath (Join-Path $source $file) -Destination $fixture
}
& $Compiler /Q '/DAppVersion=0.0.0' ("/O{0}" -f (Join-Path $fixture 'output')) (Join-Path $fixture 'movviz.iss')
if ($LASTEXITCODE -ne 0) { throw "Installer compilation failed: $LASTEXITCODE" }
Write-Host 'PASS: real Inno Setup script compiled with inert test payloads (not installed).'
