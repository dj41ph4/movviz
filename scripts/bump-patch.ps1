param([switch]$Commit, [string]$Message)

$versionFile = Join-Path $PSScriptRoot "..\package.json"

$json = Get-Content $versionFile -Raw | ConvertFrom-Json
$parts = $json.version -split '\.'
$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2] + 1
$newVersion = "$major.$minor.$patch"

$json.version = $newVersion
$json | ConvertTo-Json | Set-Content $versionFile

Write-Host "Bumped patch: $newVersion"

git -C (Join-Path $PSScriptRoot "..") add $versionFile

if ($Commit) {
  if ($Message) {
    git -C (Join-Path $PSScriptRoot "..") commit -m "v$newVersion - $Message"
  } else {
    git -C (Join-Path $PSScriptRoot "..") commit -m "v$newVersion"
  }
}
