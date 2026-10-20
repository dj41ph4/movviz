$ErrorActionPreference = 'Stop'
$StateDirectory = Join-Path $env:ProgramData 'MovvizUpdater'
$InstallDirectory = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'update-worker.ps1')
$request = Join-Path $StateDirectory 'request.json'
$active = Join-Path $StateDirectory 'active.json'
$pending = Join-Path $StateDirectory 'pending'
function Remove-PendingSlot {
    if (Test-Path -LiteralPath $pending) {
        # A crash just after publication can leave the temporary hard-link
        # name behind. Remove only our known leaf filenames, never recurse.
        Get-ChildItem -LiteralPath $pending -File | Where-Object { $_.Name -match '^[a-fA-F0-9-]{36}\.tmp$' } | Remove-Item -Force
        [IO.Directory]::Delete($pending)
    }
}
# Never silently replay an interrupted installation after a machine restart.
if (Test-Path -LiteralPath $active) {
    $interruptedVersion = ''
    try { $interruptedVersion = [string](Get-Content -LiteralPath $active -Raw | ConvertFrom-Json).version } catch { }
    Write-UpdateStatus 'error' $interruptedVersion 'Update interrupted. Check setup logs before retrying.'
    try { Start-Service -Name Movviz -ErrorAction Stop } catch { }
    Remove-Item -LiteralPath $active -Force
    Remove-PendingSlot
}
while ($true) {
    [IO.File]::WriteAllText((Join-Path $StateDirectory 'heartbeat'), [DateTime]::UtcNow.ToString('o'))
    if (Test-Path -LiteralPath $request) {
        $version = ''
        try {
            Move-Item -LiteralPath $request -Destination $active
            $job = Get-Content -LiteralPath $active -Raw | ConvertFrom-Json
            $version = [string]$job.version
            Invoke-MovvizUpdate $version
        } catch {
            Write-UpdateStatus 'error' $version $_.Exception.Message
            # Best-effort recovery even when the installer failed after stop.
            try { Start-Service -Name Movviz -ErrorAction Stop } catch { }
        } finally {
            if (Test-Path -LiteralPath $active) { Remove-Item -LiteralPath $active -Force }
            Remove-PendingSlot
        }
    }
    # A web crash between reserving the slot and publishing the request must
    # not block future updates forever. Only our stale slot is removed.
    if ((Test-Path -LiteralPath $pending) -and -not (Test-Path -LiteralPath $request)) {
        if ((Get-Item -LiteralPath $pending).LastWriteTimeUtc -lt [DateTime]::UtcNow.AddMinutes(-1)) {
            Remove-PendingSlot
        }
    }
    Start-Sleep -Seconds 3
}
