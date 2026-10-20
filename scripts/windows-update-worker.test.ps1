$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\packaging\windows\installer\update-worker.ps1')
$StateDirectory = Join-Path ([IO.Path]::GetTempPath()) ('movviz-updater-qa-' + [guid]::NewGuid())
$InstallDirectory = Join-Path $StateDirectory 'installation'
New-Item -ItemType Directory -Path (Join-Path $InstallDirectory 'app') -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $InstallDirectory 'app\package.json'), '{"version":"1.27.06"}')
$script:mode = 'ok'
$script:installs = 0
$bytes = [Text.Encoding]::UTF8.GetBytes('test installer fixture')
$sha = [Security.Cryptography.SHA256]::Create()
$digest = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
$sha.Dispose()
function Invoke-RestMethod {
    param($Uri, $Headers, $TimeoutSec)
    if ($Uri -like 'https://api.github.com/*') {
        $url = 'https://github.com/dj41ph4/movviz/releases/download/v1.27.07/Movviz-Setup-1.27.07.exe'
        if ($script:mode -eq 'url') { $url = 'https://example.com/untrusted.exe' }
        return @{ tag_name = 'v1.27.07'; draft = $false; prerelease = $false; assets = @(@{ name = 'Movviz-Setup-1.27.07.exe'; browser_download_url = $url; size = $bytes.Length; digest = "sha256:$digest" }) }
    }
    if ($script:mode -eq 'health') { return @{ ok = $true; version = '1.27.06' } }
    return @{ ok = $true; version = '1.27.07' }
}
function Invoke-WebRequest {
    param($Uri, $OutFile, [switch]$UseBasicParsing, $TimeoutSec)
    $content = $bytes.Clone()
    if ($script:mode -eq 'hash') { $content[0] = 0 }
    [IO.File]::WriteAllBytes($OutFile, $content)
}
function Start-Process {
    param($FilePath, $ArgumentList, $WindowStyle, [switch]$PassThru, [switch]$Wait)
    if (-not ($ArgumentList -contains '/VERYSILENT')) { throw 'Missing silent flag' }
    if (-not ($ArgumentList -contains '/NOCLOSEAPPLICATIONS') -or -not ($ArgumentList -contains '/NORESTARTAPPLICATIONS')) { throw 'Restart Manager must not stop the updater' }
    if (-not (($ArgumentList -join ' ') -match '/LOG=')) { throw 'Missing installation log' }
    if (-not (($ArgumentList -join ' ') -match '/DIR=')) { throw 'Missing installation directory' }
    $script:installs++
    if ($script:mode -eq 'exit') { return @{ ExitCode = 5 } }
    return @{ ExitCode = 0 }
}
function Get-Service { param($Name) return @{ Status = 'Running' } }
function Start-Service { param($Name) throw 'Unexpected service start in successful fixture' }
function Start-Sleep { param($Seconds) }
try {
    foreach ($case in @('ok', 'url', 'hash', 'exit', 'health', 'downgrade', 'invalid')) {
        $script:mode = $case
        $script:installs = 0
        $version = '1.27.07'
        if ($case -eq 'downgrade') { $version = '1.27.05' }
        if ($case -eq 'invalid') { $version = '../evil' }
        $failed = $false
        try { Invoke-MovvizUpdate $version -VerificationTimeoutSeconds 0 -PollSeconds 0 } catch { $failed = $true; Write-Host "$case rejected: $($_.Exception.Message)" }
        if (($case -eq 'ok') -eq $failed) { throw "Unexpected result for $case" }
        if ($case -in @('url', 'hash', 'downgrade', 'invalid') -and $script:installs -ne 0) { throw "Unsafe installer launched for $case" }
        if ($case -eq 'ok') {
            $status = Get-Content -LiteralPath (Join-Path $StateDirectory 'status.json') -Raw | ConvertFrom-Json
            if ($status.status -ne 'complete' -or $status.version -ne '1.27.07') { throw 'Success was not persisted' }
        }
    }
    Write-Host 'PASS: seven update worker scenarios (mocked installer/network/services).'
} finally {
    # Known fixture files only; no recursive deletion of computed paths.
    Get-ChildItem -LiteralPath $StateDirectory -File | Remove-Item -Force
    Remove-Item -LiteralPath (Join-Path $InstallDirectory 'app\package.json') -Force
    [IO.Directory]::Delete((Join-Path $InstallDirectory 'app'))
    [IO.Directory]::Delete($InstallDirectory)
    [IO.Directory]::Delete($StateDirectory)
}
