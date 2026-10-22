$ErrorActionPreference = 'Stop'

function Wait-MovvizServicesReady([string]$Version, [int]$TimeoutSeconds = 120, [int]$PollSeconds = 2) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $lastHealth = 'not checked'
    $consecutiveReady = 0
    do {
        $states = @()
        foreach ($name in @('Movviz', 'MovvizUpdate')) {
            $service = Get-Service -Name $name -ErrorAction SilentlyContinue
            $states += if ($service) { "$name=$($service.Status)" } else { "$name=Missing" }
        }
        $servicesReady = ($states -join ', ') -ceq 'Movviz=Running, MovvizUpdate=Running'
        $httpReady = $false
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:9810/api/healthz' -TimeoutSec 5
            $lastHealth = "ok=$($health.ok), version=$($health.version)"
            $httpReady = $health.ok -and $health.version -ceq $Version
        } catch { $lastHealth = $_.Exception.Message }
        if ($servicesReady -and $httpReady) { $consecutiveReady++ } else { $consecutiveReady = 0 }
        # WinSW can briefly report Running before its child crashes. Require
        # several healthy observations, including the exact packaged version.
        if ($consecutiveReady -ge 3) { return }
        if ([DateTime]::UtcNow -ge $deadline) { break }
        Start-Sleep -Seconds $PollSeconds
    } while ($true)
    throw "Movviz startup verification failed after $TimeoutSeconds seconds: $($states -join ', '); HTTP: $lastHealth. See Windows-update-diagnostics."
}

function Save-MovvizUpdateDiagnostics(
    [string]$Destination,
    [string]$DataRoot = $env:ProgramData,
    [string]$RunnerTemp = $env:RUNNER_TEMP
) {
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    $installRoot = Join-Path $RunnerTemp 'Movviz-Updater-E2E'
    # Stage every source on the destination volume: upload-artifact cannot
    # compute a common parent for ProgramData on C: and runner.temp on D:.
    $sources = @(
        @{ Path = (Join-Path $DataRoot 'MovvizUpdater'); Group = 'updater'; Pattern = '*.log', 'status.json' },
        @{ Path = (Join-Path $DataRoot 'Movviz\logs'); Group = 'movviz'; Pattern = '*.log' },
        # Older service XML put logpath under log, so WinSW wrote beside its EXE.
        @{ Path = (Join-Path $installRoot 'service'); Group = 'service'; Pattern = '*.log', '*.xml' },
        @{ Path = (Join-Path $installRoot 'updater'); Group = 'updater-service'; Pattern = '*.log', '*.xml' },
        @{ Path = $RunnerTemp; Group = 'bootstrap'; Pattern = 'movviz-bootstrap.log' }
    )
    foreach ($source in $sources) {
        if (-not (Test-Path -LiteralPath $source.Path)) { continue }
        $target = Join-Path $Destination $source.Group
        New-Item -ItemType Directory -Path $target -Force | Out-Null
        foreach ($pattern in $source.Pattern) {
            Get-ChildItem -LiteralPath $source.Path -Filter $pattern -File | ForEach-Object {
                try { Copy-Item -LiteralPath $_.FullName -Destination $target -Force }
                catch { Write-Warning "Cannot collect $($_.Exception.Message)" }
            }
        }
    }
    try {
        Get-CimInstance Win32_Service -Filter "Name='Movviz' OR Name='MovvizUpdate'" |
            Select-Object Name, State, ProcessId, ExitCode, ServiceSpecificExitCode, PathName |
            Format-List | Out-File -LiteralPath (Join-Path $Destination 'services.txt') -Encoding utf8
    } catch { Write-Warning "Cannot collect service state: $($_.Exception.Message)" }
    foreach ($logName in @('System', 'Application')) {
        try {
            Get-WinEvent -FilterHashtable @{ LogName = $logName; StartTime = (Get-Date).AddMinutes(-30) } -ErrorAction Stop |
                Where-Object { $_.Message -match 'Movviz|movviz-service|movviz-updater' } |
                Select-Object -First 50 TimeCreated, Id, ProviderName, Message |
                Format-List | Out-File -LiteralPath (Join-Path $Destination "$logName-events.txt") -Encoding utf8
        } catch { Write-Warning "Cannot collect $logName events: $($_.Exception.Message)" }
    }
}
