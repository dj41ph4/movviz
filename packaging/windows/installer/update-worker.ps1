# Loaded once by update-service.ps1. No automatic release polling: a request
# from the authenticated Movviz API is required for every installation.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-UpdateStatus([string]$Status, [string]$Version, [string]$Message = '') {
    $state = @{ status = $Status; version = $Version; error = $Message; updatedAt = [DateTime]::UtcNow.ToString('o') }
    $temp = Join-Path $StateDirectory 'status.tmp'
    [IO.File]::WriteAllText($temp, ($state | ConvertTo-Json -Compress))
    Move-Item -LiteralPath $temp -Destination (Join-Path $StateDirectory 'status.json') -Force
}

function Invoke-MovvizUpdate([string]$Version, [int]$VerificationTimeoutSeconds = 300, [int]$PollSeconds = 3) {
    if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid update version' }
    $package = Get-Content -LiteralPath (Join-Path $InstallDirectory 'app\package.json') -Raw | ConvertFrom-Json
    if ([version]$Version -le [version]$package.version) { throw 'Refusing an older or already installed version' }
    Write-UpdateStatus 'downloading' $Version
    $headers = @{ 'User-Agent' = 'Movviz-Updater'; Accept = 'application/vnd.github+json' }
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/dj41ph4/movviz/releases/tags/v$Version" -Headers $headers -TimeoutSec 30
    if ($release.draft -or $release.prerelease -or $release.tag_name -cne "v$Version") { throw 'Invalid release' }
    $name = "Movviz-Setup-$Version.exe"
    $assets = @($release.assets | Where-Object { $_.name -ceq $name })
    if ($assets.Count -ne 1) { throw 'Installer asset missing or ambiguous' }
    $asset = $assets[0]
    $expectedUrl = "https://github.com/dj41ph4/movviz/releases/download/v$Version/$name"
    if ($asset.browser_download_url -cne $expectedUrl -or $asset.digest -notmatch '^sha256:[a-fA-F0-9]{64}$') { throw 'Invalid installer URL or missing SHA256 digest' }
    $installer = Join-Path $StateDirectory $name
    $log = Join-Path $StateDirectory ("setup-{0}-{1}.log" -f $Version, [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))
    try {
        Invoke-WebRequest -Uri $expectedUrl -OutFile $installer -UseBasicParsing -TimeoutSec 1800
        if ((Get-Item -LiteralPath $installer).Length -ne $asset.size) { throw 'Installer size mismatch' }
        $hash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash
        if ($hash -ine $asset.digest.Substring(7)) { throw 'Installer SHA256 mismatch' }
        Write-UpdateStatus 'installing' $Version
        # This process belongs to MovvizUpdate, never to Movviz. Neither the
        # application's runtime nor its WinSW executable hosts this updater.
        $arguments = @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/NOCLOSEAPPLICATIONS', '/NORESTARTAPPLICATIONS', '/SP-', ('/DIR="{0}"' -f $InstallDirectory), ('/LOG="{0}"' -f $log))
        $setup = Start-Process -FilePath $installer -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
        if ($setup.ExitCode -ne 0) { throw "Installer failed with exit code $($setup.ExitCode). See $log" }
        Write-UpdateStatus 'verifying' $Version
        $service = Get-Service -Name Movviz
        if ($service.Status -ne 'Running') { Start-Service -Name Movviz }
        $deadline = [DateTime]::UtcNow.AddSeconds($VerificationTimeoutSeconds)
        do {
            try {
                $health = Invoke-RestMethod -Uri 'http://127.0.0.1:9810/api/healthz' -TimeoutSec 5
                if ($health.ok -and $health.version -ceq $Version) {
                    Write-UpdateStatus 'complete' $Version
                    return
                }
            } catch { }
            Start-Sleep -Seconds $PollSeconds
        } while ([DateTime]::UtcNow -lt $deadline)
        throw 'Movviz did not respond with the expected version within five minutes'
    } finally {
        if (Test-Path -LiteralPath $installer) { Remove-Item -LiteralPath $installer -Force }
    }
}
