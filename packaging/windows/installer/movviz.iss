; ============================================================================
;  Movviz - Windows installer (Inno Setup 6)
;
;  Produces a clean, user-friendly setup .exe that behaves like any pro app:
;    - installs the program under Program Files\Movviz
;    - stores data & settings under ProgramData\Movviz (the service data area)
;    - bundles a Node runtime + a service wrapper so nothing else is required
;    - registers the Movviz Windows service (auto-start at boot, auto-restart)
;    - adds Start Menu shortcuts + a proper uninstaller in Add/Remove Programs
;
;  Built by packaging/windows/installer/build.ps1 (stages files, then ISCC).
; ============================================================================

#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif

#define AppName "Movviz"
#define AppPublisher "Movviz"
#define AppExeUrl "http://localhost:9810"
#define ServiceName "Movviz"

[Setup]
AppId={{7C3F2A10-9E4B-4F8A-A1D2-4B6E0C9F1A22}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\movviz.ico
OutputDir=..\..\..\dist
OutputBaseFilename=Movviz-Setup-{#AppVersion}
SetupIconFile=movviz.ico
WizardStyle=modern
Compression=lzma2/max
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
ArchitecturesAllowed=x64compatible
PrivilegesRequired=admin
CloseApplications=yes
; --- Data/settings live outside Program Files, like any pro app ---
UsePreviousAppDir=yes

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "italian"; MessagesFile: "compiler:Languages\Italian.isl"
Name: "dutch"; MessagesFile: "compiler:Languages\Dutch.isl"
Name: "german"; MessagesFile: "compiler:Languages\German.isl"

[Dirs]
; Data directory (config, library index, logs) - the service data area.
Name: "{commonappdata}\{#AppName}"; Permissions: users-modify
Name: "{commonappdata}\{#AppName}\logs"; Permissions: users-modify

[InstallDelete]
; Wipe the app + service payload before recopying on every install/update, so
; a version that drops a dependency doesn't leave stale files behind. Runs
; after the service is already stopped (see the CurStepChanged handler in the
; [Code] section), so nothing is locked. User data in ProgramData is untouched.
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\runtime"
Type: filesandordirs; Name: "{app}\service"

[Files]
; Bundled Node runtime.
Source: "stage\runtime\*"; DestDir: "{app}\runtime"; Flags: recursesubdirs ignoreversion
; Service manager (NSSM).
Source: "stage\service\*"; DestDir: "{app}\service"; Flags: recursesubdirs ignoreversion
; The application (Next.js standalone server + assets).
Source: "stage\app\*"; DestDir: "{app}\app"; Flags: recursesubdirs ignoreversion createallsubdirs
; Icon + web shortcut.
Source: "movviz.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "Movviz.url"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Movviz"; Filename: "{app}\Movviz.url"; IconFilename: "{app}\movviz.ico"
Name: "{group}\Uninstall Movviz"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Movviz"; Filename: "{app}\Movviz.url"; IconFilename: "{app}\movviz.ico"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Code]
{ The web server spawns the download engine as a detached child process
  (see src/lib/engine/bootstrap.ts) so it survives web server restarts - but
  that also means stopping the Windows service does NOT stop the engine's
  node.exe, since it was never a child of the service process to begin with.
  A leftover engine process, or a node.exe from a manual dev run, keeps
  files inside the install directory open, which is exactly what makes the
  installer fail with a file-in-use error. Force-killing every node.exe
  whose command line points inside the install directory closes that gap
  without touching unrelated node processes elsewhere on the machine. }
procedure KillMovvizNodeProcesses();
var
  ResultCode: Integer;
  AppPath: String;
  Q: String;
  Script: String;
begin
  AppPath := ExpandConstant('{app}');
  Q := Chr(39); { single quote — sidesteps Pascal-string escaping entirely }
  Script :=
    '$ErrorActionPreference=' + Q + 'SilentlyContinue' + Q + '; ' +
    'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq ' + Q + 'node.exe' + Q +
    ' -and $_.CommandLine -like ' + Q + '*' + AppPath + '*' + Q + ' } | ' +
    'ForEach-Object { Stop-Process -Id $_.ProcessId -Force }';

  Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -Command "' + Script + '"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  { Belt and braces: force-kill the service wrapper itself and anything it
    spawned, by name, in case "stop" didn't fully take. }
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM movviz-service.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

  { Give Windows a moment to actually release the file handles before the
    installer starts copying/deleting. }
  Sleep(500);
end;

{ Runs before any file is copied. If a previous install's service is still
  running, stop and unregister it now — otherwise the running node.exe and
  its loaded files would be locked and the update's file copy could fail
  partway through. Safe to call on a fresh install too: FileExists guards it,
  and stopping/uninstalling an already-absent service is a harmless no-op. }
procedure StopAndRemoveExistingService();
var
  ServiceExe: String;
  ResultCode: Integer;
begin
  ServiceExe := ExpandConstant('{app}\service\movviz-service.exe');
  if FileExists(ServiceExe) then
  begin
    Exec(ServiceExe, 'stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Exec(ServiceExe, 'uninstall', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
  KillMovvizNodeProcesses();
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
    StopAndRemoveExistingService();
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  { [UninstallRun] already asks the service to stop/uninstall before files are
    removed; also force-kill any straggling node.exe (detached engine,
    manually-started dev processes) so file deletion never hits a lock. }
  if CurUninstallStep = usUninstall then
    KillMovvizNodeProcesses();
end;

[Run]
; Defense in depth: the [Code] section above already stopped/unregistered any
; previous service before files were copied. Re-run stop/uninstall here too
; (harmless no-op if already gone) before registering the new one, in case the
; service's own config (movviz-service.xml) changed between versions.
Filename: "{app}\service\movviz-service.exe"; Parameters: "stop"; Flags: runhidden waituntilterminated skipifdoesntexist
Filename: "{app}\service\movviz-service.exe"; Parameters: "uninstall"; Flags: runhidden waituntilterminated skipifdoesntexist
Filename: "{app}\service\movviz-service.exe"; Parameters: "install"; \
  StatusMsg: "Registering the Movviz service..."; Flags: runhidden waituntilterminated
Filename: "{app}\service\movviz-service.exe"; Parameters: "start"; \
  StatusMsg: "Starting Movviz..."; Flags: runhidden waituntilterminated
; Offer to open Movviz in the browser after install.
Filename: "{app}\Movviz.url"; Description: "Open Movviz"; \
  Flags: postinstall shellexec skipifsilent nowait

[UninstallRun]
; Stop + remove the service before files are deleted.
Filename: "{app}\service\movviz-service.exe"; Parameters: "stop"; \
  Flags: runhidden waituntilterminated; RunOnceId: "StopMovvizService"
Filename: "{app}\service\movviz-service.exe"; Parameters: "uninstall"; \
  Flags: runhidden waituntilterminated; RunOnceId: "RemoveMovvizService"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\app\.next\cache"
