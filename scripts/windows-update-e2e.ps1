param([Parameter(Mandatory = $true)][string]$Installer, [Parameter(Mandatory = $true)][string]$Version)
$ErrorActionPreference = 'Stop'
# This installs real services. Never run it against a developer/user machine.
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'This test is restricted to disposable GitHub Actions runners' }
if (Get-Service -Name Movviz, MovvizUpdate -ErrorAction SilentlyContinue) { throw 'Refusing to overwrite existing services' }
$installRoot = Join-Path $env:RUNNER_TEMP 'Movviz-Updater-E2E'
$state = Join-Path $env:ProgramData 'MovvizUpdater'
$setup = Start-Process -FilePath $Installer -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', ('/DIR="{0}"' -f $installRoot), ('/LOG="{0}"' -f (Join-Path $env:RUNNER_TEMP 'movviz-bootstrap.log'))) -WindowStyle Hidden -PassThru -Wait
if ($setup.ExitCode -ne 0) { throw "Bootstrap installer failed: $($setup.ExitCode)" }
foreach ($name in @('Movviz', 'MovvizUpdate')) {
    if ((Get-Service -Name $name).Status -ne 'Running') { throw "$name did not start" }
}
$updaterPid = (Get-CimInstance Win32_Service -Filter "Name='MovvizUpdate'").ProcessId
# Simulate older installed metadata, then restart to invalidate the app's
# cached version. The update below downloads and runs the real published EXE.
Stop-Service -Name Movviz
$packageFile = Join-Path $installRoot 'app\package.json'
$package = Get-Content -LiteralPath $packageFile -Raw | ConvertFrom-Json
$package.version = '0.0.0'
[IO.File]::WriteAllText($packageFile, ($package | ConvertTo-Json -Depth 100))
Start-Service -Name Movviz
[IO.File]::WriteAllText((Join-Path $state 'request.json'), (@{ version = $Version } | ConvertTo-Json -Compress))
$deadline = [DateTime]::UtcNow.AddMinutes(15)
do {
    Start-Sleep -Seconds 3
    if (Test-Path -LiteralPath (Join-Path $state 'status.json')) {
        try { $status = Get-Content -LiteralPath (Join-Path $state 'status.json') -Raw | ConvertFrom-Json } catch { continue }
        if ($status.status -eq 'error') { throw "Update failed: $($status.error)" }
        if ($status.status -eq 'complete' -and $status.version -ceq $Version) {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:9810/api/healthz' -TimeoutSec 10
            if (-not $health.ok -or $health.version -cne $Version) { throw 'Wrong running version after update' }
            if ((Get-Service -Name Movviz).Status -ne 'Running') { throw 'Movviz service did not recover' }
            if ((Get-CimInstance Win32_Service -Filter "Name='MovvizUpdate'").ProcessId -ne $updaterPid) { throw 'Updater was killed or restarted during installation' }
            Write-Host "PASS: published $Version installed by Movviz Update, same updater PID $updaterPid, Movviz running and correct HTTP version."
            exit 0
        }
    }
} while ([DateTime]::UtcNow -lt $deadline)
throw 'Timed out waiting for real Windows update'
