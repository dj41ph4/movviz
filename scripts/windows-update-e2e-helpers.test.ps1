$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'windows-update-e2e-helpers.ps1')

function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
$script:scenario = 'delayed'
$script:checks = 0
function Get-Service {
    param($Name, $ErrorAction)
    if ($script:scenario -eq 'missing') { return $null }
    $status = 'Running'
    if ($script:scenario -eq 'delayed' -and $script:checks -eq 0) { $status = 'StartPending' }
    if ($script:scenario -eq 'stopped' -or ($script:scenario -eq 'crash' -and $script:checks -eq 2)) { $status = 'Stopped' }
    return @{ Status = $status }
}
function Invoke-RestMethod {
    param($Uri, $TimeoutSec)
    $script:checks++
    if ($script:scenario -eq 'network' -or ($script:scenario -eq 'delayed' -and $script:checks -le 2)) { throw 'Connection refused' }
    if ($script:scenario -eq 'wrong-version') { return @{ ok = $true; version = '1.27.18' } }
    return @{ ok = $true; version = '1.27.19' }
}
function Start-Sleep { param($Seconds) }
foreach ($scenario in @('delayed', 'crash')) {
    $script:scenario = $scenario
    $script:checks = 0
    Wait-MovvizServicesReady -Version '1.27.19' -TimeoutSeconds 5 -PollSeconds 0
    Assert ($script:checks -ge 5) "$scenario was accepted before stable HTTP and services"
}
foreach ($scenario in @('missing', 'stopped', 'wrong-version', 'network')) {
    $script:scenario = $scenario
    $script:checks = 0
    $message = ''
    try { Wait-MovvizServicesReady -Version '1.27.19' -TimeoutSeconds 0 -PollSeconds 0 }
    catch { $message = $_.Exception.Message }
    Assert ($message -match 'startup verification failed' -and $message -match 'HTTP:') "$scenario did not fail with actionable state"
    if ($scenario -eq 'missing') { Assert ($message -match 'Movviz=Missing') 'Missing service state was lost' }
    if ($scenario -eq 'wrong-version') { Assert ($message -match 'version=1.27.18') 'Wrong version was lost' }
    if ($scenario -eq 'network') { Assert ($message -match 'Connection refused') 'HTTP error was lost' }
}

# Exercise actual filesystem copies, including spaces, missing source paths,
# the old beside-EXE log location and files that must never be uploaded.
$fixture = Join-Path $PSScriptRoot ('.windows-diagnostics-qa-' + [guid]::NewGuid())
function Get-CimInstance {
    param($ClassName, $Filter)
    return [pscustomobject]@{ Name = 'Movviz'; State = 'Stopped'; ExitCode = 1067; ProcessId = 0 }
}
function Get-WinEvent {
    param($FilterHashtable, $ErrorAction)
    return @(
        [pscustomobject]@{ Id = 7034; Message = 'Movviz terminated unexpectedly'; ProviderName = 'Service Control Manager' },
        [pscustomobject]@{ Id = 1; Message = 'Unrelated service'; ProviderName = 'Other' }
    )
}
try {
    $dataRoot = Join-Path $fixture 'Program Data'
    $runnerTemp = Join-Path $fixture 'runner temp'
    $destination = Join-Path $fixture 'artifact'
    $files = @{
        'Program Data\MovvizUpdater\movviz-updater.err.log' = 'updater failure'
        'Program Data\MovvizUpdater\status.json' = '{"status":"error"}'
        'Program Data\Movviz\logs\movviz-service.err.log' = 'node failure'
        'runner temp\Movviz-Updater-E2E\service\movviz-service.wrapper.log' = 'wrapper failure'
        'runner temp\Movviz-Updater-E2E\service\movviz-service.xml' = '<service />'
        'runner temp\Movviz-Updater-E2E\updater\movviz-updater.wrapper.log' = 'updater wrapper'
        'runner temp\movviz-bootstrap.log' = 'installer log'
        'Program Data\MovvizUpdater\request.json' = 'do not collect'
        'Program Data\Movviz\users.json' = 'do not collect'
    }
    foreach ($entry in $files.GetEnumerator()) {
        $file = Join-Path $fixture $entry.Key
        New-Item -ItemType Directory -Path (Split-Path -Parent $file) -Force | Out-Null
        [IO.File]::WriteAllText($file, $entry.Value)
    }
    Save-MovvizUpdateDiagnostics -Destination $destination -DataRoot $dataRoot -RunnerTemp $runnerTemp
    foreach ($entry in @{
        'updater\movviz-updater.err.log' = 'updater failure'
        'updater\status.json' = '{"status":"error"}'
        'movviz\movviz-service.err.log' = 'node failure'
        'service\movviz-service.wrapper.log' = 'wrapper failure'
        'service\movviz-service.xml' = '<service />'
        'updater-service\movviz-updater.wrapper.log' = 'updater wrapper'
        'bootstrap\movviz-bootstrap.log' = 'installer log'
    }.GetEnumerator()) {
        Assert ((Get-Content -LiteralPath (Join-Path $destination $entry.Key) -Raw) -ceq $entry.Value) "Missing or damaged diagnostic: $($entry.Key)"
    }
    Assert (-not (Get-ChildItem -LiteralPath $destination -Recurse -Filter 'request.json')) 'Request was collected'
    Assert (-not (Get-ChildItem -LiteralPath $destination -Recurse -Filter 'users.json')) 'User data was collected'
    Assert ((Get-Content -LiteralPath (Join-Path $destination 'services.txt') -Raw) -match '1067') 'Service exit code missing'
    $events = Get-Content -LiteralPath (Join-Path $destination 'System-events.txt') -Raw
    Assert ($events -match 'Movviz terminated' -and $events -notmatch 'Unrelated') 'Event selection is incorrect'
    Save-MovvizUpdateDiagnostics -Destination (Join-Path $fixture 'empty artifact') -DataRoot (Join-Path $fixture 'absent data') -RunnerTemp (Join-Path $fixture 'absent runner')
    Assert (Test-Path -LiteralPath (Join-Path $fixture 'empty artifact\services.txt')) 'Diagnostics failed before installation'
} finally {
    # Delete only this test's files and empty directories, without recursive rm.
    if (Test-Path -LiteralPath $fixture) {
        Get-ChildItem -LiteralPath $fixture -Recurse -File | Remove-Item -Force
        Get-ChildItem -LiteralPath $fixture -Recurse -Directory | Sort-Object { $_.FullName.Length } -Descending |
            ForEach-Object { [IO.Directory]::Delete($_.FullName) }
        [IO.Directory]::Delete($fixture)
    }
}
$xmlPath = Join-Path $PSScriptRoot '..\packaging\windows\installer\movviz-service.xml'
[xml]$config = Get-Content -LiteralPath $xmlPath -Raw
Assert ($config.service.logpath -ceq '%ProgramData%\Movviz\logs') 'WinSW logpath must be a direct service child'
Assert (-not $config.service.log.logpath) 'Nested logpath is ignored by WinSW'
Write-Host 'PASS: readiness (six scenarios), diagnostic staging (populated and absent paths), WinSW log configuration.'
