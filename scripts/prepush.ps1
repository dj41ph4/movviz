param([string]$Message)

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

# Bump patch and commit
& "$PSScriptRoot\bump-patch.ps1" -Commit -Message $Message
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Push
git push
