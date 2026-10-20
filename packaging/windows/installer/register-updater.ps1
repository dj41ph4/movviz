$ErrorActionPreference = 'Stop'
$directory = Join-Path $env:ProgramData 'MovvizUpdater'
New-Item -ItemType Directory -Path $directory -Force | Out-Null
# Do not inherit users-modify permissions from Movviz's data directory.
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
    $identity = New-Object Security.Principal.SecurityIdentifier($sid)
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $directory -AclObject $acl
$wrapper = Join-Path $PSScriptRoot 'movviz-updater.exe'
$service = Get-Service -Name MovvizUpdate -ErrorAction SilentlyContinue
if (-not $service) {
    & $wrapper install
    if ($LASTEXITCODE -ne 0) { throw "Cannot register Movviz Update: $LASTEXITCODE" }
}
if ((Get-Service -Name MovvizUpdate).Status -ne 'Running') { Start-Service -Name MovvizUpdate }
